import type { ImageSource as PersistedImageSource } from './types';

export type RuntimeImageSource = PersistedImageSource & {
    runtimeUri?: string;
};