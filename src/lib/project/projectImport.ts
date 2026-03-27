// $lib/project/projectImport.ts

import { getDerivedBlob } from '$lib/images/derivationService';
import { runPython } from '$lib/python/runPython';

import type {
    ImageAlignmentProject as Project,
    AssetRoot,
    ImageGroup,
    ImageRecord
} from '$lib/project/types';

export type GroupingStrategy = 'leaf-folder' | 'single-image' | 'filename-group';
export type GroupingProfileDefinition = {
    id?: string;
    name?: string;
    script: string;
};
export type GroupingDefinition = GroupingStrategy | GroupingProfileDefinition;

export type LocalFileImportResult = {
    contentHash: string;
    dimensions: {
        width: number;
        height: number;
    };
    label?: string;
};

export type LocalFileImporter = (
    file: File,
    relativePath: string
) => Promise<LocalFileImportResult>;

type ScannedImage = {
    file: File;
    relativePath: string;
    filename: string;
    parentPath: string;
    parentFolderName: string;
};

const IMAGE_EXTENSIONS = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.tif',
    '.tiff',
    '.webp',
    '.jp2'
]);

function nowIso(): string {
    return new Date().toISOString();
}

function makeId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID()}`;
}

function normaliseSlashes(value: string): string {
    return value.replace(/\\/g, '/');
}

function basename(path: string): string {
    const parts = normaliseSlashes(path).split('/');
    return parts[parts.length - 1] ?? path;
}

function stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/i, '');
}

function getExtension(filename: string): string {
    const match = filename.match(/(\.[^.]+)$/);
    return match?.[1]?.toLowerCase() ?? '';
}

function isImageFilename(filename: string): boolean {
    return IMAGE_EXTENSIONS.has(getExtension(filename));
}

function filenameGroupKey(filename: string): string {
    let stem = stripExtension(filename);

    stem = stem.replace(/[_\s-]+[ab]$/i, '');
    stem = stem.replace(/[_\s-]+copy\s*\d+$/i, '');
    stem = stem.replace(/[_\s-]+\d+$/i, '');

    return stem.trim().toLowerCase();
}

async function sha256Hex(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
    if ('createImageBitmap' in window) {
        const bitmap = await createImageBitmap(file);
        try {
            return { width: bitmap.width, height: bitmap.height };
        } finally {
            bitmap.close();
        }
    }

    const url = URL.createObjectURL(file);

    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error(`Unable to read image dimensions for ${file.name}`));
            el.src = url;
        });

        return {
            width: img.naturalWidth,
            height: img.naturalHeight
        };
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function ensureLocalDerivationsCached(contentHash: string, file: File): Promise<void> {
    await Promise.all([
        getDerivedBlob(contentHash, 'work', file),
        getDerivedBlob(contentHash, 'thumb', file)
    ]);
}

export async function defaultLocalFileImporter(
    file: File,
    relativePath: string
): Promise<LocalFileImportResult> {
    const [contentHash, dimensions] = await Promise.all([
        sha256Hex(file),
        readImageDimensions(file)
    ]);

    await ensureLocalDerivationsCached(contentHash, file);

    return {
        contentHash,
        dimensions,
        label: basename(relativePath)
    };
}

async function scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    prefix = ''
): Promise<ScannedImage[]> {
    const results: ScannedImage[] = [];
    const entries = (
        dirHandle as FileSystemDirectoryHandle & {
            values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
        }
    ).values();

    for await (const entry of entries) {
        if (entry.kind === 'directory') {
            const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
            results.push(...(await scanDirectory(entry, nextPrefix)));
            continue;
        }

        if (entry.kind !== 'file') continue;
        if (!isImageFilename(entry.name)) continue;

        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const parentPath = prefix;
        const parentFolderName = prefix ? basename(prefix) : '';

        const file = await entry.getFile();

        results.push({
            file,
            relativePath,
            filename: entry.name,
            parentPath,
            parentFolderName
        });
    }

    return results;
}

function createEmptyProject(title?: string): Project {
    return {
        version: '0.2',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        title: title ?? '',
        metadata: {},
        definitions: {
            metadataSchemas: [],
            alignmentSchemas: [],
            annotationSchemas: []
        },
        assetRoots: [],
        images: [],
        groups: [],
        alignments: [],
        annotations: [],
        ui: {}
    };
}

function resolveGroupKey(item: ScannedImage, strategy: GroupingStrategy): string {
    switch (strategy) {
        case 'single-image':
            return item.relativePath;

        case 'filename-group':
            return filenameGroupKey(item.filename);

        case 'leaf-folder':
        default:
            return item.parentPath || '__root__';
    }
}

function resolveGroupLabel(item: ScannedImage, strategy: GroupingStrategy): string {
    switch (strategy) {
        case 'single-image':
            return stripExtension(item.filename);

        case 'filename-group':
            return filenameGroupKey(item.filename);

        case 'leaf-folder':
        default:
            return item.parentFolderName || 'Root';
    }
}

function isGroupingProfileDefinition(value: GroupingDefinition): value is GroupingProfileDefinition {
    return typeof value === 'object' && value !== null && typeof value.script === 'string';
}

function buildGroupingProfileInput(scanned: ScannedImage[]) {
    return {
        files: scanned.map((item) => ({
            relativePath: item.relativePath,
            filename: item.filename,
            stem: stripExtension(item.filename),
            extension: getExtension(item.filename),
            parentPath: item.parentPath,
            parentFolderName: item.parentFolderName
        }))
    };
}

async function resolveGroupsFromProfile(
    strategy: GroupingProfileDefinition,
    scanned: ScannedImage[]
): Promise<Array<{ label: string; imageRefs: string[]; baseImageRef?: string | null }>> {
    const result = await runPython(strategy.script, buildGroupingProfileInput(scanned));

    if (!Array.isArray(result)) {
        throw new Error('Grouping profile must return an array of groups.');
    }

    return result.map((item, index) => {
        if (!item || typeof item !== 'object' || !Array.isArray((item as any).imageRefs)) {
            throw new Error(`Grouping profile returned an invalid group at index ${index}.`);
        }

        return {
            label:
                typeof (item as any).label === 'string' && (item as any).label.trim()
                    ? (item as any).label.trim()
                    : `Group ${index + 1}`,
            imageRefs: (item as any).imageRefs,
            baseImageRef:
                typeof (item as any).baseImageRef === 'string' ||
                (item as any).baseImageRef === null
                    ? (item as any).baseImageRef
                    : undefined
        };
    });
}

export async function buildProjectFromFolderHandle(
    rootHandle: FileSystemDirectoryHandle,
    strategy: GroupingDefinition = 'leaf-folder',
    importLocalFile: LocalFileImporter = defaultLocalFileImporter
): Promise<Project> {
    const project = createEmptyProject(rootHandle.name);

    const assetRoot: AssetRoot = {
        id: 'main',
        label: rootHandle.name,
        expectedFolderName: rootHandle.name
    };

    project.assetRoots.push(assetRoot);

    const scanned = await scanDirectory(rootHandle);

    scanned.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }));
    const imageIdByRef = new Map<string, string>();

    const groups = new Map<
        string,
        {
            id: string;
            label: string;
            imageIds: string[];
        }
    >();

    for (const item of scanned) {
        const imported = await importLocalFile(item.file, item.relativePath);

        const image: ImageRecord = {
            id: makeId('img'),
            contentHash: imported.contentHash,
            label: imported.label ?? item.filename,
            source: {
                kind: 'local',
                rootId: assetRoot.id,
                imageRef: item.relativePath
            },
            dimensions: imported.dimensions,
            metadata: {}
        };

        project.images.push(image);
        imageIdByRef.set(item.relativePath, image.id);

        if (isGroupingProfileDefinition(strategy)) {
            continue;
        }

        const groupKey = resolveGroupKey(item, strategy);
        const groupLabel = resolveGroupLabel(item, strategy);

        let group = groups.get(groupKey);

        if (!group) {
            group = {
                id: makeId('grp'),
                label: groupLabel,
                imageIds: []
            };
            groups.set(groupKey, group);
        }

        group.imageIds.push(image.id);
    }

    if (isGroupingProfileDefinition(strategy)) {
        const grouped = await resolveGroupsFromProfile(strategy, scanned);

        project.groups = grouped.flatMap((group): ImageGroup[] => {
            const imageIds = group.imageRefs
                .map((imageRef) => imageIdByRef.get(imageRef))
                .filter((imageId): imageId is string => Boolean(imageId));

            if (imageIds.length === 0) {
                return [];
            }

            const baseImageId = group.baseImageRef ? imageIdByRef.get(group.baseImageRef) ?? '' : '';

            return [
                {
                    id: makeId('grp'),
                    label: group.label,
                    baseImageId,
                    imageIds: [imageIds[0], ...imageIds.slice(1)],
                    metadata: {}
                }
            ];
        });

        project.updatedAt = nowIso();
        return project;
    }

    project.groups = Array.from(groups.values()).flatMap((group): ImageGroup[] => {
        if (group.imageIds.length === 0) {
            return [];
        }

        return [
            {
                id: group.id,
                label: group.label,
                baseImageId: '',
                imageIds: [group.imageIds[0], ...group.imageIds.slice(1)],
                metadata: {}
            }
        ];
    });

    project.updatedAt = nowIso();
    return project;
}

export async function buildProjectFromSpreadsheetHandle(
    _handle: FileSystemFileHandle
): Promise<Project> {
    throw new Error(
        'Spreadsheet import is the next piece to wire in. The header/store/file actions are ready for it.'
    );
}
