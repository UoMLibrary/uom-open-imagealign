// src/lib/imagealign/vggAlignService.ts
import { base } from '$app/paths';

export type TransformType = 'similarity' | 'affine' | 'perspective' | 'tps';

export type TransformParams = {
    type: TransformType;
    maxDimension?: number;
    photometric?: boolean;
};

export type MeanStdDev = {
    mean: number;
    stddev: number;
};

export type TransformData = {
    type: TransformType;
    H: number[];
    H_inv?: number[];
    targetSize: { width: number; height: number };

    fixedImage: { width: number; height: number };
    movingImage: { width: number; height: number };

    resized: {
        fixed: { width: number; height: number; scale: number };
        moving: { width: number; height: number; scale: number };
    };

    luminance: {
        fixed: MeanStdDev;
        moving: MeanStdDev;
    };

    debug: {
        photometricRequested: boolean;
    };
};

type VggModule = {
    estimate_transform: (
        query: ArrayLike<number>,
        queryRows: number,
        target: ArrayLike<number>,
        targetRows: number,
        type?: string,
        queryScale?: number,
        targetScale?: number
    ) => Uint8Array;

    invert_transform: (H: ArrayLike<number>) => Uint8Array;

    estimate_luma_mean_stddev: (
        im: ArrayLike<number>,
        rows: number
    ) => Float64Array;
};

declare global {
    interface Window {
        transform?: Promise<VggModule>;
        __vggTransformScriptPromise?: Promise<void>;
    }
}

const DEFAULT_TRANSFORM_URL = `${base}/vendor/vgg/transform.js`;

let modulePromise: Promise<VggModule> | null = null;
let loadedScriptUrl = DEFAULT_TRANSFORM_URL;

function assertBrowser() {
    if (typeof window === 'undefined') {
        throw new Error('vggAlignService can only run in the browser');
    }
}

function getResizeDimensions(iw: number, ih: number, maxDim: number): [number, number] {
    if (iw <= maxDim && ih <= maxDim) return [iw, ih];

    const maxSide = Math.max(iw, ih);

    const ow = Math.round((iw / maxSide) * maxDim);
    const oh = Math.round((ih / maxSide) * maxDim);

    return [Math.max(1, ow), Math.max(1, oh)];
}

function imageBitmapToImageData(bitmap: ImageBitmap, width: number, height: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not create 2D context');

    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
}

function uint8ToFloat64Array(data: Uint8Array): Float64Array {
    return new Float64Array(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );
}

function meanStdDevFromArrayLike(v: ArrayLike<number>): MeanStdDev {
    return {
        mean: Number(v[0] ?? 0),
        stddev: Number(v[1] ?? 0)
    };
}

async function ensureTransformScript(scriptUrl: string) {
    assertBrowser();

    if (window.transform) return;

    if (!window.__vggTransformScriptPromise) {
        window.__vggTransformScriptPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.dataset.vggTransform = 'true';

            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${scriptUrl}`));

            document.head.appendChild(script);
        });
    }

    await window.__vggTransformScriptPromise;
}

export async function initVggAlign(options?: { scriptUrl?: string }): Promise<VggModule> {
    assertBrowser();

    if (options?.scriptUrl) {
        loadedScriptUrl = options.scriptUrl;
    }

    if (!modulePromise) {
        await ensureTransformScript(loadedScriptUrl);

        if (!window.transform) {
            throw new Error('transform.js loaded but window.transform missing');
        }

        modulePromise = window.transform;
    }

    return modulePromise;
}

export async function getTransformForImages(
    baseImage: Blob,
    queryImage: Blob,
    params: TransformParams
): Promise<TransformData> {

    const module = await initVggAlign();

    const maxDimension = params.maxDimension ?? 1024;

    const [baseBitmap, queryBitmap] = await Promise.all([
        createImageBitmap(baseImage),
        createImageBitmap(queryImage)
    ]);

    try {
        const fixedWidth = baseBitmap.width;
        const fixedHeight = baseBitmap.height;

        const movingWidth = queryBitmap.width;
        const movingHeight = queryBitmap.height;

        const [fixedResizedWidth, fixedResizedHeight] =
            getResizeDimensions(fixedWidth, fixedHeight, maxDimension);

        const [movingResizedWidth, movingResizedHeight] =
            getResizeDimensions(movingWidth, movingHeight, maxDimension);

        const fixedScale = fixedResizedWidth / fixedWidth;
        const movingScale = movingResizedWidth / movingWidth;

        const fixedImageData = imageBitmapToImageData(
            baseBitmap,
            fixedResizedWidth,
            fixedResizedHeight
        );

        const movingImageData = imageBitmapToImageData(
            queryBitmap,
            movingResizedWidth,
            movingResizedHeight
        );

        const rawH = module.estimate_transform(
            movingImageData.data,
            movingImageData.height,
            fixedImageData.data,
            fixedImageData.height,
            params.type,
            movingScale,
            fixedScale
        );

        const H = Array.from(uint8ToFloat64Array(rawH));

        const H_inv =
            params.type === 'tps'
                ? undefined
                : Array.from(
                    uint8ToFloat64Array(
                        module.invert_transform(new Float64Array(H))
                    )
                );

        const movingLuminance = meanStdDevFromArrayLike(
            module.estimate_luma_mean_stddev(
                movingImageData.data,
                movingImageData.height
            )
        );

        const fixedLuminance = meanStdDevFromArrayLike(
            module.estimate_luma_mean_stddev(
                fixedImageData.data,
                fixedImageData.height
            )
        );

        return {
            type: params.type,
            H,
            H_inv,

            targetSize: {
                width: fixedWidth,
                height: fixedHeight
            },

            fixedImage: {
                width: fixedWidth,
                height: fixedHeight
            },

            movingImage: {
                width: movingWidth,
                height: movingHeight
            },

            resized: {
                fixed: {
                    width: fixedResizedWidth,
                    height: fixedResizedHeight,
                    scale: fixedScale
                },
                moving: {
                    width: movingResizedWidth,
                    height: movingResizedHeight,
                    scale: movingScale
                }
            },

            luminance: {
                fixed: fixedLuminance,
                moving: movingLuminance
            },

            debug: {
                photometricRequested: Boolean(params.photometric)
            }
        };

    } finally {
        baseBitmap.close();
        queryBitmap.close();
    }
}

export async function getImageFromTransform(
    baseImage: Blob,
    queryImage: Blob,
    transform: TransformData
): Promise<Blob> {

    const module = await initVggAlign();

    const [baseBitmap, queryBitmap] = await Promise.all([
        createImageBitmap(baseImage),
        createImageBitmap(queryImage)
    ]);

    try {

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
            throw new Error("Could not create canvas context");
        }

        const queryImageData = imageBitmapToImageData(
            queryBitmap,
            queryBitmap.width,
            queryBitmap.height
        );

        const H = new Float64Array(transform.H);

        const warped = module.warp_image(
            queryImageData.data,
            queryImageData.height,
            H,
            transform.targetSize.height,
            transform.targetSize.width,
            transform.type
        );

        const warpedPixels = new Uint8ClampedArray(warped);

        const outputImage = new ImageData(
            warpedPixels,
            transform.targetSize.width,
            transform.targetSize.height
        );

        canvas.width = transform.targetSize.width;
        canvas.height = transform.targetSize.height;

        ctx.putImageData(outputImage, 0, 0);

        return await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/png")
        );

    } finally {
        baseBitmap.close();
        queryBitmap.close();
    }
}