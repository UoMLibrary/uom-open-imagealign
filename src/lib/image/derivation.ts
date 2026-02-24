/**
 * Image Derivation Layer
 * 
 * Responsibility:
 * Deterministically generate and cache derived image artefacts
 * from a bounded immutable Working Image layer.
 * 
 * Artefact Tiers:
 *   work::<hash>        → Immutable bounded base image (max 2048px)
 *   prep::<hash>        → Prepared working (rotation + crop)
 *   norm::<hash>        → 512px grayscale canonical
 *   thumb::<hash>       → 256px UI preview
 * 
 * IndexedDB is treated as a deterministic cache.
 * Clearing it affects performance, not correctness.
 */

import { get, set, del } from 'idb-keyval';
import type { ImagePreparation } from '$lib/core/types';

/* ============================================================
   VERSIONING & POLICY
============================================================ */

const WORKING_VERSION = 'v1_2048';
const NORMALISE_VERSION = 'v3_from_working';
const THUMB_VERSION = 'v2_from_working';

const MAX_WORKING_DIMENSION = 2048;

/* ============================================================
   WORKING IMAGE (IMMUTABLE BASE)
============================================================ */

/**
 * Creates bounded-resolution working image from original file.
 * This replaces storing the full original.
 */
export async function ensureWorkingImage(
    contentHash: string,
    file: File
) {
    const key = `work::${contentHash}::${WORKING_VERSION}`;
    const existing = await get(key);
    if (existing) return;

    const bitmap = await createImageBitmap(file);
    const blob = await buildWorking(bitmap);

    await set(key, blob);
}

/**
 * Downscale to max working dimension.
 * No geometry transforms here.
 */
async function buildWorking(bitmap: ImageBitmap): Promise<Blob> {
    const scale =
        MAX_WORKING_DIMENSION /
        Math.max(bitmap.width, bitmap.height);

    const width =
        scale < 1 ? Math.round(bitmap.width * scale) : bitmap.width;

    const height =
        scale < 1 ? Math.round(bitmap.height * scale) : bitmap.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, width, height);

    return new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
    );
}

/* ============================================================
   PREPARED WORKING IMAGE (ROTATE + CROP)
============================================================ */

/**
 * Regenerates high-resolution prepared working image.
 * Used by Align step.
 */
export async function regeneratePreparedWorking(
    contentHash: string,
    preparation: ImagePreparation
) {
    const workKey = `work::${contentHash}::${WORKING_VERSION}`;
    const prepKey = `prep::${contentHash}::${WORKING_VERSION}`;

    const workingBlob = await get(workKey);
    if (!workingBlob) throw new Error('Working image missing');

    const bitmap = await createImageBitmap(workingBlob);
    const preparedCanvas = applyPreparation(bitmap, preparation);

    const blob = await new Promise<Blob>((resolve) =>
        preparedCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
    );

    await set(prepKey, blob);
}

/**
 * Deletes prepared + canonical derivatives when geometry changes.
 */
export async function invalidatePrepared(contentHash: string) {
    await del(`prep::${contentHash}::${WORKING_VERSION}`);
    await del(`norm::${contentHash}::${NORMALISE_VERSION}`);
}

/* ============================================================
   CANONICAL NORMALISED IMAGE (512px grayscale)
============================================================ */

/**
 * Regenerates canonical from prepared working.
 * Used for similarity / pHash.
 */
export async function regenerateCanonicalNormalised(
    contentHash: string,
    preparation: ImagePreparation
) {
    const prepKey = `prep::${contentHash}::${WORKING_VERSION}`;
    const normKey = `norm::${contentHash}::${NORMALISE_VERSION}`;

    let preparedBlob = await get(prepKey);

    // If prepared not cached, generate it first
    if (!preparedBlob) {
        await regeneratePreparedWorking(contentHash, preparation);
        preparedBlob = await get(prepKey);
    }

    if (!preparedBlob) throw new Error('Prepared image missing');

    const bitmap = await createImageBitmap(preparedBlob);
    const blob = await buildCanonical(bitmap);

    await set(normKey, blob);
}

async function buildCanonical(bitmap: ImageBitmap): Promise<Blob> {
    const size = 512;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const scale = size / Math.max(bitmap.width, bitmap.height);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const offsetX = Math.round((size - w) / 2);
    const offsetY = Math.round((size - h) / 2);

    ctx.drawImage(bitmap, offsetX, offsetY, w, h);

    const imgData = ctx.getImageData(offsetX, offsetY, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(
            0.299 * data[i] +
            0.587 * data[i + 1] +
            0.114 * data[i + 2]
        );
        data[i] = data[i + 1] = data[i + 2] = gray;
    }

    ctx.putImageData(imgData, offsetX, offsetY);

    return new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
    );
}

/* ============================================================
   THUMBNAIL (256px UI PREVIEW)
============================================================ */

/**
 * Thumbnail is derived from working image.
 * Independent of preparation.
 */
export async function ensureThumbnail(contentHash: string) {
    const workKey = `work::${contentHash}::${WORKING_VERSION}`;
    const thumbKey = `thumb::${contentHash}::${THUMB_VERSION}`;

    const existing = await get(thumbKey);
    if (existing) return;

    const workingBlob = await get(workKey);
    if (!workingBlob) throw new Error('Working image missing');

    const bitmap = await createImageBitmap(workingBlob);
    const blob = await buildThumbnail(bitmap);

    await set(thumbKey, blob);
}

async function buildThumbnail(bitmap: ImageBitmap): Promise<Blob> {
    const size = 256;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const scale = size / Math.max(bitmap.width, bitmap.height);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const offsetX = Math.round((size - w) / 2);
    const offsetY = Math.round((size - h) / 2);

    ctx.drawImage(bitmap, offsetX, offsetY, w, h);

    return new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
    );
}

/* ============================================================
   GEOMETRY TRANSFORM (PURE)
============================================================ */

export function applyPreparation(
    bitmap: ImageBitmap,
    preparation: ImagePreparation
): HTMLCanvasElement {

    const { rotation, rect } = preparation;

    const radians = (rotation * Math.PI) / 180;

    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    const rotateCanvas = document.createElement('canvas');
    rotateCanvas.width = bitmap.width * cos + bitmap.height * sin;
    rotateCanvas.height = bitmap.width * sin + bitmap.height * cos;

    const rctx = rotateCanvas.getContext('2d')!;
    rctx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
    rctx.rotate(radians);
    rctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const minX = rect.x * rotateCanvas.width;
    const minY = rect.y * rotateCanvas.height;
    const width = rect.width * rotateCanvas.width;
    const height = rect.height * rotateCanvas.height;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = width;
    cropCanvas.height = height;

    const cctx = cropCanvas.getContext('2d')!;
    cctx.drawImage(
        rotateCanvas,
        minX,
        minY,
        width,
        height,
        0,
        0,
        width,
        height
    );

    return cropCanvas;
}

/* ============================================================
   PERCEPTUAL HASH FROM NORMALISED CANONICAL
============================================================ */

const NORMALISE_VERSION_PHASH = 'v3_from_working';

export async function computePHashFromNormalised(
    contentHash: string
): Promise<string | null> {
    const key = `norm::${contentHash}::${NORMALISE_VERSION_PHASH}`;
    const blob = await get(key);

    if (!blob) return null;

    const bitmap = await createImageBitmap(blob);

    // Resize to small size (e.g. 32x32)
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    // Simple average hash (aHash now — stable + fast)
    let total = 0;
    const grayValues: number[] = [];

    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        grayValues.push(gray);
        total += gray;
    }

    const avg = total / grayValues.length;

    let bits = '';
    for (const value of grayValues) {
        bits += value > avg ? '1' : '0';
    }

    // Convert binary string to hex
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
        hex += parseInt(bits.substr(i, 4), 2).toString(16);
    }

    return hex;
}

/* ============================================================
   REHYDRATION (Loading runtimeUri from cache)
============================================================ */

/**
 * Populates runtimeUri from IndexedDB working images.
 * Used during project load.
 */
export async function rehydrateImagesFromCache(
    imageList: Array<{ hashes: { contentHash: string }; runtimeUri?: string }>
) {
    return Promise.all(
        imageList.map(async (img) => {
            if (img.runtimeUri) return img;

            const contentHash = img.hashes?.contentHash;
            if (!contentHash) return img;

            const workKey = `work::${contentHash}::${WORKING_VERSION}`;
            const blob = await get(workKey);

            if (!blob) {
                console.warn('Missing working image for hash:', contentHash);
                return img;
            }

            return {
                ...img,
                runtimeUri: URL.createObjectURL(blob)
            };
        })
    );
}
