import { bumpDerivationCacheGlobal } from '$lib/images/derivationState.svelte';
import type { ImageAlignmentProject as Project } from '$lib/project/types';
import { buildProjectFromFolderHandle, buildProjectFromSpreadsheetHandle } from '$lib/project/projectImport';
import { getDerivedBlob } from '$lib/images/derivationService';
import {
    pickDirectoryHandle,
    pickProjectFileHandle,
    pickSaveProjectHandle,
    pickSpreadsheetHandle,
    readJsonFile,
    supportsFileSystemAccess,
    writeJsonFile
} from '$lib/project/projectFileActions';
import { settingsState } from '$lib/config/settingsStore.svelte';
import type { LocalImageSource } from '$lib/project/types';

type BusyAction =
    | null
    | 'new-from-folder'
    | 'new-from-spreadsheet'
    | 'open-project'
    | 'save'
    | 'save-as'
    | 'relink-asset-folder';

type AnnotationConfigSnapshot = {
    sourceProfileId?: string | null;
    sourceProfileName?: string | null;
    schema: Record<string, unknown>;
    defaultData: Record<string, unknown>;
    uiSchema?: Record<string, unknown> | null;
};

type ImportInfoSnapshot = {
    groupingProfileId?: string | null;
    groupingProfileName?: string | null;
    groupingScriptHash?: string | null;
    importedAt?: string;
};

type ProjectWithConfig = Project & {
    config?: {
        importInfo?: ImportInfoSnapshot;
        annotationConfig?: AnnotationConfigSnapshot;
    };
};

export type NewProjectFromFolderOptions = {
    importGroupingProfileId?: string | null;
    annotationSchemaProfileId?: string | null;
};

export type NewProjectFromSpreadsheetOptions = {
    annotationSchemaProfileId?: string | null;
};

type ProjectRuntimeState = {
    project: Project | null;
    projectHandle: FileSystemFileHandle | null;
    assetRootHandles: Record<string, FileSystemDirectoryHandle>;
    dirty: boolean;
    busyAction: BusyAction;
    lastError: string | null;
    lastInfo: string | null;
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

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function getDefaultAnnotationProfile() {
    const profile = settingsState.annotationSchemaProfiles[0] ?? null;

    if (!profile) {
        throw new Error('No annotation schema profiles are available in Settings.');
    }

    return profile;
}

function buildAnnotationConfigSnapshot(
    profileId?: string | null
): AnnotationConfigSnapshot {
    const profile =
        settingsState.getAnnotationSchemaProfile(profileId) ?? getDefaultAnnotationProfile();

    return {
        sourceProfileId: profile.id,
        sourceProfileName: profile.name,
        schema: clone(profile.schema),
        defaultData: clone(profile.defaultData),
        uiSchema: null
    };
}

async function hashText(value: string): Promise<string | null> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;

    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function buildImportInfoSnapshot(
    groupingProfileId?: string | null
): Promise<ImportInfoSnapshot | undefined> {
    const profile = settingsState.getImportGroupingProfile(groupingProfileId);
    if (!profile) return undefined;

    return {
        groupingProfileId: profile.id,
        groupingProfileName: profile.name,
        groupingScriptHash: await hashText(profile.script),
        importedAt: nowIso()
    };
}

function normaliseProject(project: Project): Project {
    const typed = project as ProjectWithConfig;

    if (typed.config?.annotationConfig) {
        return typed;
    }

    const withConfig: ProjectWithConfig = {
        ...typed,
        config: {
            ...(typed.config ?? {}),
            annotationConfig: buildAnnotationConfigSnapshot(null)
        }
    };

    return withConfig as Project;
}

export function getProjectAnnotationConfig(
    project: Project | null | undefined
): AnnotationConfigSnapshot | null {
    if (!project) return null;

    const typed = project as ProjectWithConfig;

    return typed.config?.annotationConfig ?? buildAnnotationConfigSnapshot(null);
}

export function replaceProjectAnnotationSchemaFromProfile(profileId?: string | null) {
    if (!projectState.project) return;

    const nextConfig = buildAnnotationConfigSnapshot(profileId);

    projectState.project = {
        ...(projectState.project as ProjectWithConfig),
        config: {
            ...((projectState.project as ProjectWithConfig).config ?? {}),
            annotationConfig: nextConfig
        },
        updatedAt: nowIso()
    } as Project;

    projectState.dirty = true;
    projectState.lastInfo = `Updated project annotation schema to "${nextConfig.sourceProfileName ?? 'Unnamed schema'}".`;
}

export const projectState = $state<ProjectRuntimeState>({
    project: null,
    projectHandle: null,
    assetRootHandles: {},
    dirty: false,
    busyAction: null,
    lastError: null,
    lastInfo: null,
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
            const localSource = image.source as LocalImageSource;
            const file = await getFileFromRelativePath(rootHandle, localSource.imageRef);
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
    projectState.project = normaliseProject(project);
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

export async function newProjectFromFolder(options: NewProjectFromFolderOptions = {}) {
    try {
        begin('new-from-folder');

        const rootHandle = await pickDirectoryHandle('read');

        if (!rootHandle) {
            finish();
            return;
        }

        const groupingProfile =
            settingsState.getImportGroupingProfile(options.importGroupingProfileId) ??
            settingsState.importGroupingProfiles[0] ??
            null;

        if (!groupingProfile) {
            throw new Error('No import grouping profiles are available in Settings.');
        }

        const annotationConfig = buildAnnotationConfigSnapshot(
            options.annotationSchemaProfileId
        );

        const importInfo = await buildImportInfoSnapshot(groupingProfile.id);

        // IMPORTANT:
        // This assumes buildProjectFromFolderHandle is updated next so it can accept
        // a Python grouping profile or grouping definition rather than a simple legacy strategy.
        const project = await buildProjectFromFolderHandle(rootHandle, {
            id: groupingProfile.id,
            name: groupingProfile.name,
            script: groupingProfile.script
        } as any);

        const nextProject = normaliseProject({
            ...(project as ProjectWithConfig),
            config: {
                ...((project as ProjectWithConfig).config ?? {}),
                importInfo,
                annotationConfig
            }
        } as Project);

        projectState.project = nextProject;
        projectState.projectHandle = null;
        projectState.assetRootHandles = {
            main: rootHandle
        };
        projectState.dirty = true;

        finish(
            `Created new project from folder "${rootHandle.name}" using grouping profile "${groupingProfile.name}".`
        );
    } catch (error) {
        fail(error);
    }
}

export async function newProjectFromSpreadsheet(
    options: NewProjectFromSpreadsheetOptions = {}
) {
    try {
        begin('new-from-spreadsheet');

        const handle = await pickSpreadsheetHandle();

        if (!handle) {
            finish();
            return;
        }

        const project = await buildProjectFromSpreadsheetHandle(handle);

        const annotationConfig = buildAnnotationConfigSnapshot(
            options.annotationSchemaProfileId
        );

        const nextProject = normaliseProject({
            ...(project as ProjectWithConfig),
            config: {
                ...((project as ProjectWithConfig).config ?? {}),
                annotationConfig
            }
        } as Project);

        projectState.project = nextProject;
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

        projectState.project = normaliseProject(project);
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

        if (rebuilt > 0) {
            bumpDerivationCacheGlobal();
        }

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
