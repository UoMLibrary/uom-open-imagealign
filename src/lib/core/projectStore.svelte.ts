import type { ImageAlignmentProject as Project } from '$lib/core/types';
import {
    buildProjectFromFolderHandle,
    buildProjectFromSpreadsheetHandle,
    type GroupingStrategy
} from '$lib/core/projectImport';
import { getDerivedBlob } from '$lib/image/derivationService';
import {
    pickDirectoryHandle,
    pickProjectFileHandle,
    pickSaveProjectHandle,
    pickSpreadsheetHandle,
    readJsonFile,
    supportsFileSystemAccess,
    writeJsonFile
} from '$lib/core/projectFileActions';

type BusyAction =
    | null
    | 'new-from-folder'
    | 'new-from-spreadsheet'
    | 'open-project'
    | 'save'
    | 'save-as'
    | 'relink-asset-folder';

type ProjectRuntimeState = {
    project: Project | null;
    projectHandle: FileSystemFileHandle | null;
    assetRootHandles: Record<string, FileSystemDirectoryHandle>;
    dirty: boolean;
    busyAction: BusyAction;
    lastError: string | null;
    lastInfo: string | null;
    defaultGroupingStrategy: GroupingStrategy;
    supportsFsAccess: boolean;
};

function nowIso(): string {
    return new Date().toISOString();
}

function suggestedProjectFilename(project: Project | null): string {
    const base =
        project?.title?.trim().replace(/[^\w.-]+/g, '-').replace(/-+/g, '-') || 'project';

    return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
}

function withUpdatedAt(project: Project): Project {
    return {
        ...project,
        updatedAt: nowIso()
    };
}

export const projectState = $state<ProjectRuntimeState>({
    project: null,
    projectHandle: null,
    assetRootHandles: {},
    dirty: false,
    busyAction: null,
    lastError: null,
    lastInfo: null,
    defaultGroupingStrategy: 'leaf-folder',
    supportsFsAccess: supportsFileSystemAccess()
});

function begin(action: BusyAction) {
    projectState.busyAction = action;
    projectState.lastError = null;
    projectState.lastInfo = null;
}

function finish(info?: string) {
    projectState.busyAction = null;
    if (info) projectState.lastInfo = info;
}

function fail(error: unknown) {
    projectState.busyAction = null;
    projectState.lastError =
        error instanceof Error ? error.message : 'An unknown error occurred.';
}

async function getFileFromRelativePath(
    rootHandle: FileSystemDirectoryHandle,
    relativePath: string
): Promise<File> {
    const parts = relativePath.split('/').filter(Boolean);

    let dir = rootHandle;

    for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
    }

    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
    return await fileHandle.getFile();
}

async function rebuildLocalAssetCacheForRoot(
    rootId: string,
    rootHandle: FileSystemDirectoryHandle
): Promise<{ rebuilt: number; failed: number }> {
    const project = projectState.project;
    if (!project) return { rebuilt: 0, failed: 0 };

    const localImages = project.images.filter(
        (img) => img.source.kind === 'local' && img.source.rootId === rootId
    );

    let rebuilt = 0;
    let failed = 0;

    for (const image of localImages) {
        try {
            const file = await getFileFromRelativePath(rootHandle, image.source.imageRef);
            await getDerivedBlob(image.contentHash, 'work', file);
            await getDerivedBlob(image.contentHash, 'thumb', file);
            rebuilt++;
        } catch (error) {
            failed++;
            console.warn(`Failed to rebuild cache for image ${image.id}`, error);
        }
    }

    return { rebuilt, failed };
}

export function replaceProject(project: Project, handle: FileSystemFileHandle | null = null) {
    projectState.project = project;
    projectState.projectHandle = handle;
    projectState.dirty = false;
    projectState.lastError = null;
    projectState.lastInfo = null;
}

export function clearProjectRuntimeHandles() {
    projectState.assetRootHandles = {};
}

export function markProjectDirty() {
    if (!projectState.project) return;
    projectState.project.updatedAt = nowIso();
    projectState.dirty = true;
}

export function mutateProject(mutator: (project: Project) => void) {
    if (!projectState.project) return;
    mutator(projectState.project);
    projectState.project.updatedAt = nowIso();
    projectState.dirty = true;
}

export function setDefaultGroupingStrategy(strategy: GroupingStrategy) {
    projectState.defaultGroupingStrategy = strategy;
}

export async function newProjectFromFolder(
    strategy: GroupingStrategy = projectState.defaultGroupingStrategy
) {
    try {
        begin('new-from-folder');

        const rootHandle = await pickDirectoryHandle('read');

        if (!rootHandle) {
            finish();
            return;
        }

        const project = await buildProjectFromFolderHandle(rootHandle, strategy);

        projectState.project = project;
        projectState.projectHandle = null;
        projectState.assetRootHandles = {
            main: rootHandle
        };
        projectState.dirty = true;

        finish(`Created new project from folder "${rootHandle.name}".`);
    } catch (error) {
        fail(error);
    }
}

export async function newProjectFromSpreadsheet() {
    try {
        begin('new-from-spreadsheet');

        const handle = await pickSpreadsheetHandle();

        if (!handle) {
            finish();
            return;
        }

        const project = await buildProjectFromSpreadsheetHandle(handle);

        projectState.project = project;
        projectState.projectHandle = null;
        projectState.assetRootHandles = {};
        projectState.dirty = true;

        finish(`Created new project from spreadsheet "${handle.name}".`);
    } catch (error) {
        fail(error);
    }
}

export async function openProject() {
    try {
        begin('open-project');

        const handle = await pickProjectFileHandle();

        if (!handle) {
            finish();
            return;
        }

        const project = await readJsonFile<Project>(handle);

        projectState.project = project;
        projectState.projectHandle = handle;
        projectState.assetRootHandles = {};
        projectState.dirty = false;

        finish(
            `Opened project "${handle.name}". Local thumbnails/work images may need ` +
            `"Rebuild Asset Cache" if the browser cache was cleared.`
        );
    } catch (error) {
        fail(error);
    }
}

export async function saveProject() {
    try {
        if (!projectState.project) return;

        begin('save');

        if (!projectState.projectHandle) {
            await saveProjectAs();
            return;
        }

        const next = withUpdatedAt(projectState.project);
        await writeJsonFile(projectState.projectHandle, next);

        projectState.project = next;
        projectState.dirty = false;

        finish(`Saved "${projectState.projectHandle.name}".`);
    } catch (error) {
        fail(error);
    }
}

export async function saveProjectAs() {
    try {
        if (!projectState.project) return;

        begin('save-as');

        const handle = await pickSaveProjectHandle(suggestedProjectFilename(projectState.project));

        if (!handle) {
            finish();
            return;
        }

        const next = withUpdatedAt(projectState.project);
        await writeJsonFile(handle, next);

        projectState.project = next;
        projectState.projectHandle = handle;
        projectState.dirty = false;

        finish(`Saved as "${handle.name}".`);
    } catch (error) {
        fail(error);
    }
}

export async function rebuildAssetCache(rootId?: string) {
    try {
        if (!projectState.project) return;
        if (projectState.project.assetRoots.length === 0) return;

        begin('relink-asset-folder');

        const targetRoot =
            (rootId
                ? projectState.project.assetRoots.find((root) => root.id === rootId)
                : projectState.project.assetRoots[0]) ?? null;

        if (!targetRoot) {
            finish();
            return;
        }

        const handle = await pickDirectoryHandle('read');

        if (!handle) {
            finish();
            return;
        }

        projectState.assetRootHandles[targetRoot.id] = handle;

        const { rebuilt, failed } = await rebuildLocalAssetCacheForRoot(targetRoot.id, handle);

        finish(
            `Rebuilt asset cache for "${targetRoot.label}" from folder "${handle.name}". ` +
            `${rebuilt} rebuilt${failed ? `, ${failed} failed` : ''}.`
        );
    } catch (error) {
        fail(error);
    }
}

// Backwards-compatible name for existing callers/buttons
export async function relinkAssetFolder(rootId?: string) {
    await rebuildAssetCache(rootId);
}

export function closeProject() {
    projectState.project = null;
    projectState.projectHandle = null;
    projectState.assetRootHandles = {};
    projectState.dirty = false;
    projectState.lastError = null;
    projectState.lastInfo = null;
    projectState.busyAction = null;
}