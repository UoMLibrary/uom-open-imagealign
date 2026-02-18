import { writable } from 'svelte/store';

export type WorkspaceMode =
    | 'prepare'
    | 'group'
    | 'align'
    | 'annotate';

function createWorkspaceStore() {
    const { subscribe, set } = writable<WorkspaceMode>('prepare');

    return {
        subscribe,
        set,
        reset: () => set('prepare')
    };
}

export const currentMode = createWorkspaceStore();

