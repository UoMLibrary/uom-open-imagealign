// src/lib/image/dhash.ts

export async function dHash(bitmap: ImageBitmap): Promise<string> {
    const canvas = new OffscreenCanvas(9, 8);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');

    ctx.drawImage(bitmap, 0, 0, 9, 8);
    const { data } = ctx.getImageData(0, 0, 9, 8);

    let bits = '';

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const i = (y * 9 + x) * 4;
            const left = data[i];       // red channel
            const right = data[i + 4];  // next pixel red channel
            bits += left > right ? '1' : '0';
        }
    }

    return BigInt('0b' + bits).toString(16).padStart(16, '0');
}
