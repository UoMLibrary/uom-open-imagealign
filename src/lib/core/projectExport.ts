import { projectState } from '$lib/core/projectStore.svelte';
import { runExportProfileById } from '$lib/core/profileRunner';
import { pickSaveTextFileHandle, writeTextFile } from '$lib/core/projectFileActions';

function normaliseFilename(filename: string, fallback = 'export.json') {
    const trimmed = filename.trim();
    return trimmed || fallback;
}

function contentTypeToAccept(contentType: string): Record<string, string[]> {
    if (contentType === 'application/json') {
        return { 'application/json': ['.json'] };
    }

    if (contentType === 'text/csv') {
        return { 'text/csv': ['.csv'] };
    }

    if (contentType === 'text/plain') {
        return { 'text/plain': ['.txt'] };
    }

    return { 'text/plain': ['.txt'] };
}

function serialiseExportText(value: unknown, contentType: string): string {
    if (typeof value === 'string') return value;

    if (contentType === 'text/csv') {
        return String(value ?? '');
    }

    return JSON.stringify(value ?? null, null, 2);
}

export async function exportCurrentProject(
    exportProfileId: string,
    suggestedFilename: string
) {
    const project = projectState.project;
    if (!project) {
        throw new Error('No project is currently loaded.');
    }

    const result = await runExportProfileById(exportProfileId, {
        project,
        images: project.images,
        groups: project.groups,
        alignments: project.alignments,
        annotations: project.annotations
    });

    if (!result.files.length) {
        throw new Error('The export function returned no files.');
    }

    if (result.files.length > 1) {
        throw new Error('This first-pass export flow only supports one output file.');
    }

    const file = result.files[0];
    const filename = normaliseFilename(suggestedFilename || file.filename || 'export.json');
    const contentType = file.contentType || 'application/json';
    const text = serialiseExportText(file.text, contentType);

    const handle = await pickSaveTextFileHandle(filename, contentTypeToAccept(contentType));

    if (!handle) {
        return;
    }

    await writeTextFile(handle, text);
}