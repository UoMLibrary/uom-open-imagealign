export async function autoTrimBorders(bitmap: ImageBitmap): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // --- 1️⃣ Convert to grayscale ---
    const gray = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // --- 2️⃣ Compute simple edge magnitude ---
    const edge = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;

            const gx = gray[i + 1] - gray[i - 1];
            const gy = gray[i + width] - gray[i - width];

            const magnitude = Math.abs(gx) + Math.abs(gy);

            edge[i] = magnitude > 20 ? 255 : 0; // edge threshold
        }
    }

    // --- 3️⃣ Trim based on edge density ---
    const minEdgeFraction = 0.01; // 2% edge pixels required

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    // --- Trim top ---
    for (let y = 0; y < height; y++) {
        let edges = 0;
        for (let x = 0; x < width; x++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / width > minEdgeFraction) {
            top = y;
            break;
        }
    }

    // --- Trim bottom ---
    for (let y = height - 1; y >= 0; y--) {
        let edges = 0;
        for (let x = 0; x < width; x++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / width > minEdgeFraction) {
            bottom = y;
            break;
        }
    }

    // --- Trim left ---
    for (let x = 0; x < width; x++) {
        let edges = 0;
        for (let y = 0; y < height; y++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / height > minEdgeFraction) {
            left = x;
            break;
        }
    }

    // --- Trim right ---
    for (let x = width - 1; x >= 0; x--) {
        let edges = 0;
        for (let y = 0; y < height; y++) {
            if (edge[y * width + x] > 0) edges++;
        }
        if (edges / height > minEdgeFraction) {
            right = x;
            break;
        }
    }

    // --- 4️⃣ Add small safety padding ---
    const padding = 10;

    top = Math.max(0, top - padding);
    bottom = Math.min(height - 1, bottom + padding);
    left = Math.max(0, left - padding);
    right = Math.min(width - 1, right + padding);

    const trimmedWidth = right - left;
    const trimmedHeight = bottom - top;

    // Safety fallback
    if (trimmedWidth <= 0 || trimmedHeight <= 0) {
        return canvas;
    }

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;

    const trimmedCtx = trimmedCanvas.getContext('2d')!;
    trimmedCtx.drawImage(
        canvas,
        left,
        top,
        trimmedWidth,
        trimmedHeight,
        0,
        0,
        trimmedWidth,
        trimmedHeight
    );

    return trimmedCanvas;
}
