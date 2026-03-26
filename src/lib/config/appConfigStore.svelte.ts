import { browser } from '$app/environment';

export type AppConfigSnapshot = {
    leftPanelToggleKey: string;
    rightPanelToggleKey: string;
    confirmBeforeClearingStorage: boolean;
    storageRefreshIntervalSeconds: number;
};

const STORAGE_KEY = 'uom-imagealign:app-config:v1';

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function clampRefreshInterval(value: number | null | undefined): number {
    if (!Number.isFinite(value)) return 15;
    return Math.min(120, Math.max(5, Math.round(value ?? 15)));
}

function sanitiseKey(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? '').trim();
    return trimmed.slice(0, 1) || fallback;
}

function buildDefaultSnapshot(): AppConfigSnapshot {
    return {
        leftPanelToggleKey: '[',
        rightPanelToggleKey: ']',
        confirmBeforeClearingStorage: true,
        storageRefreshIntervalSeconds: 15
    };
}

function normalise(snapshot: Partial<AppConfigSnapshot> | null | undefined): AppConfigSnapshot {
    const defaults = buildDefaultSnapshot();

    return {
        leftPanelToggleKey: sanitiseKey(snapshot?.leftPanelToggleKey, defaults.leftPanelToggleKey),
        rightPanelToggleKey: sanitiseKey(
            snapshot?.rightPanelToggleKey,
            defaults.rightPanelToggleKey
        ),
        confirmBeforeClearingStorage:
            snapshot?.confirmBeforeClearingStorage ?? defaults.confirmBeforeClearingStorage,
        storageRefreshIntervalSeconds: clampRefreshInterval(snapshot?.storageRefreshIntervalSeconds)
    };
}

function createAppConfigState() {
    const state = $state<AppConfigSnapshot>(buildDefaultSnapshot());

    function persist() {
        if (!browser) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(state)));
    }

    function hydrate(snapshot: Partial<AppConfigSnapshot> | null | undefined) {
        const next = normalise(snapshot);
        state.leftPanelToggleKey = next.leftPanelToggleKey;
        state.rightPanelToggleKey = next.rightPanelToggleKey;
        state.confirmBeforeClearingStorage = next.confirmBeforeClearingStorage;
        state.storageRefreshIntervalSeconds = next.storageRefreshIntervalSeconds;
    }

    function load() {
        if (!browser) return;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                persist();
                return;
            }

            hydrate(JSON.parse(raw) as Partial<AppConfigSnapshot>);
        } catch (error) {
            console.warn('Failed to load app config, using defaults.', error);
            persist();
        }
    }

    function update(patch: Partial<AppConfigSnapshot>) {
        hydrate({ ...clone(state), ...clone(patch) });
        persist();
    }

    function reset() {
        hydrate(buildDefaultSnapshot());
        persist();
    }

    load();

    return {
        get leftPanelToggleKey() {
            return state.leftPanelToggleKey;
        },

        get rightPanelToggleKey() {
            return state.rightPanelToggleKey;
        },

        get confirmBeforeClearingStorage() {
            return state.confirmBeforeClearingStorage;
        },

        get storageRefreshIntervalSeconds() {
            return state.storageRefreshIntervalSeconds;
        },

        get snapshot(): AppConfigSnapshot {
            return clone(state);
        },

        update,
        reset
    };
}

export const appConfigState = createAppConfigState();
