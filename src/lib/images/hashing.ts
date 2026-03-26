/**
 * Image Hashing Layer
 * 
 * Handles both:
 * - Cryptographic identity (SHA-256 over file bytes)
 * - Perceptual similarity (dHash  over pixels)
 * 
 * Uses Worker for CPU-intensive operations.
 */

let worker: Worker | null = null;

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(
            new URL('./hasher.worker.ts', import.meta.url),
            { type: 'module' }
        );
    }
    return worker;
}

function runWorker<T>(message: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
        const w = getWorker();

        const handleMessage = (e: MessageEvent) => {
            w.removeEventListener('message', handleMessage);
            w.removeEventListener('error', handleError);

            if (e.data?.error) {
                reject(new Error(e.data.error));
            } else {
                resolve(e.data);
            }
        };

        const handleError = (err: ErrorEvent) => {
            w.removeEventListener('message', handleMessage);
            w.removeEventListener('error', handleError);
            reject(err);
        };

        w.addEventListener('message', handleMessage);
        w.addEventListener('error', handleError);

        w.postMessage(message);
    });
}

/**
 * Hashes an image file for both:
 * - cryptographic identity (SHA-256 over file bytes)
 * - perceptual similarity (dHash over pixels)
 */
export async function hashImageFile(file: File): Promise<{
    contentHash: string;
    perceptualHash: string;
}> {
    // Stable identity
    const buffer = await file.arrayBuffer();
    const { contentHash } = await runWorker<{ contentHash: string }>({
        type: 'content-hash',
        buffer
    });

    // Visual similarity
    const bitmap = await createImageBitmap(file);
    const { perceptualHash } = await runWorker<{ perceptualHash: string }>({
        type: 'perceptual-hash',
        bitmap
    });

    return { contentHash, perceptualHash };
}
