// src/lib/workspace/workspaceStore.ts
import { writable } from 'svelte/store';

export const WORKSPACE_MODES = [
    { key: 'dewarp', label: 'Dewarp' },
    { key: 'group', label: 'Group' },
    { key: 'align', label: 'Align' },
    { key: 'annotate', label: 'Annotate' },
    { key: 'prepare', label: 'Prepare' },
    { key: 'overview', label: 'Overview' }
] as const;

export type WorkspaceMode = typeof WORKSPACE_MODES[number]['key'];

function createWorkspaceStore() {
    const { subscribe, set } = writable<WorkspaceMode>('prepare');

    return {
        subscribe,
        set,
        reset: () => set('prepare')
    };
}

export const currentMode = createWorkspaceStore();

