// src/lib/image/dhash.ts

export function dHash(imageData: ImageData): string {
    const { data, width, height } = imageData;

    let bits = '';

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            const idxNext = (y * width + x + 1) * 4;

            const gray =
                data[idx] * 0.299 +
                data[idx + 1] * 0.587 +
                data[idx + 2] * 0.114;

            const grayNext =
                data[idxNext] * 0.299 +
                data[idxNext + 1] * 0.587 +
                data[idxNext + 2] * 0.114;

            bits += gray > grayNext ? '1' : '0';
        }
    }

    // Convert binary string to hex (64 bits → 16 hex chars)
    return bits
        .match(/.{1,4}/g)!
        .map((chunk) => parseInt(chunk, 2).toString(16))
        .join('');
}
