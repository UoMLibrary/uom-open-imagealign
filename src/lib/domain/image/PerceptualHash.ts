import { get } from 'idb-keyval';

const NORMALISE_VERSION = 'v1_512_gray_pad';

export async function computePHashFromNormalised(
    contentHash: string
): Promise<string | null> {
    const key = `norm::${contentHash}::${NORMALISE_VERSION}`;
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

    // Simple average hash (aHash for now — stable + fast)
    let total = 0;
    const grayValues: number[] = [];

    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i]; // already grayscale
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
