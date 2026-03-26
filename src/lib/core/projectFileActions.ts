// $lib/core/projectFileActions.ts

import type { ImageAlignmentProject as Project } from '$lib/core/types';

function ensureBrowser() {
    if (typeof window === 'undefined') {
        throw new Error('File actions are only available in the browser.');
    }
}

export function supportsFileSystemAccess(): boolean {
    return (
        typeof window !== 'undefined' &&
        'showOpenFilePicker' in window &&
        'showSaveFilePicker' in window &&
        'showDirectoryPicker' in window
    );
}

export async function pickProjectFileHandle(): Promise<FileSystemFileHandle | null> {
    ensureBrowser();

    if (!supportsFileSystemAccess()) {
        throw new Error('This browser does not support the File System Access API.');
    }

    const [handle] = await (window as any).showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: [
            {
                description: 'Project JSON',
                accept: {
                    'application/json': ['.json']
                }
            }
        ]
    });

    return handle ?? null;
}

export async function pickSpreadsheetHandle(): Promise<FileSystemFileHandle | null> {
    ensureBrowser();

    if (!supportsFileSystemAccess()) {
        throw new Error('This browser does not support the File System Access API.');
    }

    const [handle] = await (window as any).showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: [
            {
                description: 'Spreadsheet import',
                accept: {
                    'text/csv': ['.csv'],
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                }
            }
        ]
    });

    return handle ?? null;
}

export async function pickDirectoryHandle(
    mode: 'read' | 'readwrite' = 'read'
): Promise<FileSystemDirectoryHandle | null> {
    ensureBrowser();

    if (!supportsFileSystemAccess()) {
        throw new Error('This browser does not support the File System Access API.');
    }

    const handle = await (window as any).showDirectoryPicker({
        mode
    });

    return handle ?? null;
}

export async function pickSaveProjectHandle(
    suggestedName = 'project.json'
): Promise<FileSystemFileHandle | null> {
    ensureBrowser();

    if (!supportsFileSystemAccess()) {
        throw new Error('This browser does not support the File System Access API.');
    }

    const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
            {
                description: 'Project JSON',
                accept: {
                    'application/json': ['.json']
                }
            }
        ]
    });

    return handle ?? null;
}

export async function readTextFile(handle: FileSystemFileHandle): Promise<string> {
    const file = await handle.getFile();
    return await file.text();
}

export async function readJsonFile<T = unknown>(handle: FileSystemFileHandle): Promise<T> {
    const text = await readTextFile(handle);
    return JSON.parse(text) as T;
}

export async function writeJsonFile(handle: FileSystemFileHandle, data: Project): Promise<void> {
    const writable = await handle.createWritable();
    try {
        await writable.write(JSON.stringify(data, null, 2));
    } finally {
        await writable.close();
    }
}

export async function pickSaveTextFileHandle(
    suggestedName: string,
    accept: Record<string, string[]> = {
        'text/plain': ['.txt']
    }
): Promise<FileSystemFileHandle | null> {
    if (!supportsFileSystemAccess()) return null;

    try {
        return await window.showSaveFilePicker({
            suggestedName,
            types: [
                {
                    description: 'Export file',
                    accept
                }
            ]
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return null;
        }
        throw error;
    }
}

export async function writeTextFile(handle: FileSystemFileHandle, text: string) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
}