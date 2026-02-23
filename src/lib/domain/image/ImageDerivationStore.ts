/**
 * ImageDerivationStore
 * --------------------
 *
 * Responsibility:
 * Deterministically generate and cache derived image artefacts
 * from an original image + confirmed preparation metadata.
 *
 * Architectural Principles:
 *
 * 1. No Geometry Guessing
 *    This layer NEVER performs page detection or inference.
 *    All geometric intent (rotation, crop corners) must come
 *    from the user-confirmed ImagePreparation state.
 *
 * 2. Deterministic & Reproducible
 *    Derived artefacts must be rebuildable at any time from:
 *      - Original image file
 *      - Stored ImagePreparation metadata
 *      - Versioned derivation constants
 *
 *    This guarantees stability across rebuilds and allows
 *    version invalidation when the pipeline evolves.
 *
 * 3. Separation of Concerns
 *    - Prepare stage: Human-in-the-loop geometry definition.
 *    - Derivation stage (this file): Pure transformation only.
 *    - Group stage: Uses derived artefacts (e.g. pHash).
 *    - Align stage: May use higher-resolution cropped artefacts.
 *
 * 4. Artefact Layers
 *
 *    a) Thumbnail (v1_256)
 *       - Based on original image.
 *       - Used for UI display.
 *
 *    b) Canonical Normalised Image (v2_512_gray_trim_pad)
 *       - Rotated + cropped via preparation metadata.
 *       - Scaled to fixed square.
 *       - Grayscale.
 *       - Used for similarity matching (e.g. pHash).
 *
 *    c) (Optional) High-Resolution Cropped Image
 *       - Rotated + cropped only.
 *       - Preserves detail for alignment and annotation.
 *       - Can be regenerated if not stored.
 *
 * 5. Coordinate Reversibility
 *    All transformations (rotate → crop → scale → pad) are
 *    geometrically reversible as long as rotation, crop bounds,
 *    scale factor, and offsets are known.
 *
 *    This ensures annotations created on derived images can
 *    be mapped back to original image coordinates.
 *
 * Versioning:
 * Each derived artefact is versioned via a key suffix.
 * Increment version constants if:
 *   - Image size changes
 *   - Padding logic changes
 *   - Grayscale logic changes
 *   - Preparation transform changes
 *
 * This store is intentionally minimal and stateless:
 * it does not hold project logic — only derived blobs.
 */
import { get, set } from 'idb-keyval';

const NORMALISE_VERSION = 'v2_512_gray_trim_pad';
const THUMB_VERSION = 'v1_256';

export interface ImagePreparation {
    rotation: number; // degrees
    corners: { x: number; y: number }[]; // normalised 0–1
}

export async function ensureDerivedImages(
    contentHash: string,
    file: File,
    preparation: ImagePreparation
) {
    const normKey = `norm::${contentHash}::${NORMALISE_VERSION}`;
    const thumbKey = `thumb::${contentHash}::${THUMB_VERSION}`;

    const [existingNorm, existingThumb] = await Promise.all([
        get(normKey),
        get(thumbKey)
    ]);

    if (existingNorm && existingThumb) {
        return;
    }

    const bitmap = await createImageBitmap(file);

    // Apply user-confirmed preparation
    const preparedCanvas = applyPreparation(bitmap, preparation);
    const preparedBitmap = await createImageBitmap(preparedCanvas);

    const normalisedBlob = await buildNormalised(preparedBitmap);
    const thumbBlob = await buildThumbnail(bitmap);

    await Promise.all([
        set(normKey, normalisedBlob),
        set(thumbKey, thumbBlob),
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

function applyPreparation(
    bitmap: ImageBitmap,
    preparation: ImagePreparation
): HTMLCanvasElement {

    const { rotation, corners } = preparation;

    // 1️⃣ Rotate full image first
    const rotateCanvas = document.createElement('canvas');
    const rctx = rotateCanvas.getContext('2d')!;

    const radians = (rotation * Math.PI) / 180;

    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    rotateCanvas.width = bitmap.width * cos + bitmap.height * sin;
    rotateCanvas.height = bitmap.width * sin + bitmap.height * cos;

    rctx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
    rctx.rotate(radians);
    rctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    // 2️⃣ Convert normalised corners to pixel bounds
    const xs = corners.map(c => c.x * rotateCanvas.width);
    const ys = corners.map(c => c.y * rotateCanvas.height);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    // 3️⃣ Crop
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