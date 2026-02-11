// src/lib/image/visualProfile.ts
export type VisualProfile = number[];

export function extractVisualProfile(
    img: HTMLImageElement,
    bins = 16
): VisualProfile {
    const size = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        0,
        0,
        size,
        size
    );

    const data = ctx.getImageData(0, 0, size, size).data;
    const hist = new Array(bins * 3).fill(0);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const v = max;
        const s = max === 0 ? 0 : (max - min) / max;

        let h = 0;
        if (max !== min) {
            if (max === r) h = (g - b) / (max - min);
            else if (max === g) h = 2 + (b - r) / (max - min);
            else h = 4 + (r - g) / (max - min);
            h = (h * 60 + 360) % 360;
        }

        const hi = Math.floor((h / 360) * bins);
        const si = Math.floor(s * bins);
        const vi = Math.floor(v * bins);

        hist[hi]++;
        hist[bins + si]++;
        hist[2 * bins + vi]++;
    }

    // normalise
    const sum = hist.reduce((a, b) => a + b, 0);
    return hist.map(v => v / sum);
}
