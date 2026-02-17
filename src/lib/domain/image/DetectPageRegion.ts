export async function detectPageRegion(
    bitmap: ImageBitmap
): Promise<HTMLCanvasElement> {

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const { width, height } = canvas;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // --- 1️⃣ Grayscale ---
    const gray = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // --- 2️⃣ Edge magnitude ---
    const edge = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;

            const gx = gray[i + 1] - gray[i - 1];
            const gy = gray[i + width] - gray[i - width];

            const magnitude = Math.abs(gx) + Math.abs(gy);

            edge[i] = magnitude > 20 ? 255 : 0;
        }
    }

    // --- 3️⃣ Central-band scanning ---
    // Ignore outer 25% horizontally / vertically
    const bandLeft = Math.floor(width * 0.35);
    const bandRight = Math.floor(width * 0.65);
    const bandTop = Math.floor(height * 0.35);
    const bandBottom = Math.floor(height * 0.65);

    const minEdgeFraction = 0.01;

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    // --- Walk from top inward ---
    for (let y = 0; y < height; y++) {
        let edges = 0;
        for (let x = bandLeft; x < bandRight; x++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / (bandRight - bandLeft) > minEdgeFraction) {
            top = y;
            break;
        }
    }

    // --- Walk from bottom inward ---
    for (let y = height - 1; y >= 0; y--) {
        let edges = 0;
        for (let x = bandLeft; x < bandRight; x++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / (bandRight - bandLeft) > minEdgeFraction) {
            bottom = y;
            break;
        }
    }

    // --- Walk from left inward ---
    for (let x = 0; x < width; x++) {
        let edges = 0;
        for (let y = bandTop; y < bandBottom; y++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / (bandBottom - bandTop) > minEdgeFraction) {
            left = x;
            break;
        }
    }

    // --- Walk from right inward ---
    for (let x = width - 1; x >= 0; x--) {
        let edges = 0;
        for (let y = bandTop; y < bandBottom; y++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / (bandBottom - bandTop) > minEdgeFraction) {
            right = x;
            break;
        }
    }

    // --- 4️⃣ Safety padding ---
    const padding = 15;

    top = Math.max(0, top - padding);
    bottom = Math.min(height - 1, bottom + padding);
    left = Math.max(0, left - padding);
    right = Math.min(width - 1, right + padding);

    const croppedWidth = right - left;
    const croppedHeight = bottom - top;

    if (croppedWidth <= 0 || croppedHeight <= 0) {
        return canvas; // fallback
    }

    const result = document.createElement('canvas');
    result.width = croppedWidth;
    result.height = croppedHeight;

    const resultCtx = result.getContext('2d')!;
    resultCtx.drawImage(
        canvas,
        left,
        top,
        croppedWidth,
        croppedHeight,
        0,
        0,
        croppedWidth,
        croppedHeight
    );

    return result;
}
