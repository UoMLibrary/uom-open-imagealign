// src/lib/core/workspaceStore.ts
import { writable } from 'svelte/store';

const DEFAULT_MODE: WorkspaceMode = 'project';

export const WORKSPACE_MODES = [
    { key: 'project', label: 'Project' },
    { key: 'align', label: 'Align' },
    { key: 'annotate', label: 'Annotate' },
    { key: 'overview', label: 'Overview' }
] as const;

export type WorkspaceMode = typeof WORKSPACE_MODES[number]['key'];

function createWorkspaceStore() {
    const { subscribe, set } = writable<WorkspaceMode>(DEFAULT_MODE);

    return {
        subscribe,
        set,
        reset: () => set(DEFAULT_MODE)
    };
}

export const currentMode = createWorkspaceStore();

