import type { ImageRecord } from './types';

export type RuntimeImageSource = ImageRecord & {
    runtimeUri?: string;
};
