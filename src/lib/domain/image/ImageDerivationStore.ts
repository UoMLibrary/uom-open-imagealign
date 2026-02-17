import { get, set } from 'idb-keyval';
import { autoTrimBorders } from './AutoTrim';

const NORMALISE_VERSION = 'v2_512_gray_trim_pad';
const THUMB_VERSION = 'v1_256';
const TRIM_VERSION = 'v1_raw_trim';

export async function ensureDerivedImages(
    contentHash: string,
    file: File
) {
    const normKey = `norm::${contentHash}::${NORMALISE_VERSION}`;
    const thumbKey = `thumb::${contentHash}::${THUMB_VERSION}`;
    const trimKey = `trim::${contentHash}::${TRIM_VERSION}`;

    const [existingNorm, existingThumb, existingTrim] = await Promise.all([
        get(normKey),
        get(thumbKey),
        get(trimKey)
    ]);

    if (existingNorm && existingThumb && existingTrim) {
        return;
    }

    const bitmap = await createImageBitmap(file);

    // --- Trim ---
    const trimmedCanvas = await autoTrimBorders(bitmap);
    const trimmedBitmap = await createImageBitmap(trimmedCanvas);

    // --- Canonical normalised (uses trimmed) ---
    const normalisedBlob = await buildNormalised(trimmedBitmap);

    // --- Thumbnail (uses original) ---
    const thumbBlob = await buildThumbnail(bitmap);

    // --- Raw trimmed blob (for inspection / debugging) ---
    const trimmedBlob = await new Promise<Blob>((resolve) =>
        trimmedCanvas.toBlob((b) => resolve(b!), 'image/png')
    );

    await Promise.all([
        set(normKey, normalisedBlob),
        set(thumbKey, thumbBlob),
        set(trimKey, trimmedBlob)
    ]);
}


async function buildNormalised(bitmap: ImageBitmap): Promise<Blob> {
    const size = 512;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;

    // 1️⃣ Paint white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // 2️⃣ Calculate scaling
    const scale = size / Math.max(bitmap.width, bitmap.height);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const offsetX = Math.round((size - w) / 2);
    const offsetY = Math.round((size - h) / 2);

    // 3️⃣ Draw image
    ctx.drawImage(bitmap, offsetX, offsetY, w, h);

    // 4️⃣ Grayscale ONLY the image region
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


async function buildThumbnail(bitmap: ImageBitmap): Promise<Blob> {
    const size = 256;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    const scale = size / Math.max(bitmap.width, bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;

    const offsetX = (size - w) / 2;
    const offsetY = (size - h) / 2;

    ctx.drawImage(bitmap, offsetX, offsetY, w, h);

    return new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8)
    );
}
