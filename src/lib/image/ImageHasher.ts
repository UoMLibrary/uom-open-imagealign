// src/lib/image/ImageHasher.ts

export type ImageHashResult = {
    contentHash: string;
    perceptualHash: string;
};

export function hashWithWorker(
    bitmap: ImageBitmap
): Promise<ImageHashResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('./hasher.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e) => {
            resolve(e.data as ImageHashResult);
            worker.terminate();
        };

        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
        };

        // Transfer ownership of bitmap to worker
        worker.postMessage({ bitmap }, [bitmap]);
    });
}
