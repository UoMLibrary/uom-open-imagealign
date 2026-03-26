import { renderWarpedImageUrl } from '$lib/imagealign/vggRenderService';
import {
    initVggAlign,
    getTransformForImages,
    type TransformData,
    type TransformType
} from '$lib/imagealign/vggAlignService';

export type AlignmentSpec = {
    type: TransformType;
    photometric: boolean;
};

export type ComputedAlignment = {
    spec: AlignmentSpec;
    transform: TransformData;
};

export type RenderedAlignment = ComputedAlignment & {
    warpedUrl: string;
};

let engineInitPromise: Promise<void> | null = null;

export function ensureAlignmentEngine(): Promise<void> {
    if (!engineInitPromise) {
        engineInitPromise = initVggAlign().then(() => {});
    }

    return engineInitPromise;
}

export function createAlignmentSpecKey(spec: AlignmentSpec): string {
    return `${spec.type}::${spec.photometric ? 'photometric' : 'plain'}`;
}

export async function computeAlignmentTransform(args: {
    baseFile: File;
    queryFile: File;
    spec: AlignmentSpec;
}): Promise<ComputedAlignment> {
    await ensureAlignmentEngine();

    const transform = await getTransformForImages(args.baseFile, args.queryFile, {
        type: args.spec.type,
        photometric: args.spec.photometric
    });

    return {
        spec: args.spec,
        transform
    };
}

export async function renderAlignmentPreview(args: {
    queryFile: File;
    transform: TransformData;
}): Promise<string> {
    return renderWarpedImageUrl(args.queryFile, args.transform);
}

export async function runAlignmentWorkflow(args: {
    baseFile: File;
    queryFile: File;
    spec: AlignmentSpec;
}): Promise<RenderedAlignment> {
    const computed = await computeAlignmentTransform(args);

    const warpedUrl = await renderAlignmentPreview({
        queryFile: args.queryFile,
        transform: computed.transform
    });

    return {
        ...computed,
        warpedUrl
    };
}
