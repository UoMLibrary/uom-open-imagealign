// src/lib/image/hasher.worker.ts
/// <reference lib="webworker" />

import { dHash } from './dhash';

self.onmessage = async (e: MessageEvent) => {
    const { bitmap } = e.data as { bitmap: ImageBitmap };

    // ---- Normalize for content hash ----
    const normalized = normalizeBitmap(bitmap);
    const buffer = normalized.data.buffer;

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const contentHash = bufferToHex(hashBuffer);

    // ---- dHash (9x8) ----
    const dhashImage = resizeForDHash(bitmap);
    const perceptualHash = dHash(dhashImage);

    self.postMessage({
        contentHash,
        perceptualHash
    });
};

/* ----------------- helpers ----------------- */

function normalizeBitmap(bitmap: ImageBitmap): ImageData {
    const maxSize = 1024;
    const scale = Math.min(
        1,
        maxSize / Math.max(bitmap.width, bitmap.height)
    );

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return ctx.getImageData(0, 0, width, height);
}

function resizeForDHash(bitmap: ImageBitmap): ImageData {
    const canvas = new OffscreenCanvas(9, 8);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    return ctx.getImageData(0, 0, 9, 8);
}

function bufferToHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
