// src/lib/image/hasher.worker.ts

import { dHash } from './dhash';

type WorkerMessage =
    | {
        type: 'content-hash';
        buffer: ArrayBuffer;
    }
    | {
        type: 'perceptual-hash';
        bitmap: ImageBitmap;
    };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;

    try {
        if (msg.type === 'content-hash') {
            const hashBuffer = await crypto.subtle.digest('SHA-256', msg.buffer);
            const hash = [...new Uint8Array(hashBuffer)]
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

            self.postMessage({ contentHash: hash });
            return;
        }

        if (msg.type === 'perceptual-hash') {
            const hash = await dHash(msg.bitmap);
            self.postMessage({ perceptualHash: hash });
            return;
        }
    } catch (err) {
        self.postMessage({ error: String(err) });
    }
};
