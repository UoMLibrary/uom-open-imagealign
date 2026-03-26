import { runPython } from '$lib/pyEngine';
import { settingsState, type PythonProfile } from '$lib/core/settingsStore.svelte';

export type GroupingResult = Array<{
    label?: string;
    imageRefs: string[];
    baseImageRef?: string | null;
}>;

export type ExportResult = {
    files: Array<{
        filename: string;
        contentType: string;
        text: unknown;
    }>;
};

function ensurePythonProfile(profile: PythonProfile | null, kind: 'importGrouping' | 'exportShape') {
    if (!profile) {
        throw new Error('Profile not found.');
    }

    if (profile.kind !== kind) {
        throw new Error(`Expected a ${kind} profile.`);
    }

    return profile;
}

export async function runGroupingProfileById(
    profileId: string | null | undefined,
    input: unknown
): Promise<GroupingResult> {
    const profile = ensurePythonProfile(
        settingsState.getImportGroupingProfile(profileId),
        'importGrouping'
    );

    const result = await runPython(profile.script, input);

    if (!Array.isArray(result)) {
        throw new Error('Grouping profile must return an array of groups.');
    }

    for (const item of result) {
        if (!item || typeof item !== 'object' || !Array.isArray((item as any).imageRefs)) {
            throw new Error('Each grouping result must contain an imageRefs array.');
        }
    }

    return result as GroupingResult;
}

export async function runExportProfileById(
    profileId: string | null | undefined,
    input: unknown
): Promise<ExportResult> {
    const profile = ensurePythonProfile(settingsState.getExportProfile(profileId), 'exportShape');

    const result = await runPython(profile.script, input);

    if (!result || typeof result !== 'object' || !Array.isArray((result as any).files)) {
        throw new Error('Export profile must return an object with a files array.');
    }

    return result as ExportResult;
}