import { get } from 'idb-keyval';
import { get as getStore } from 'svelte/store';
import { images } from '$lib/domain/project/projectStore';

const WORKING_VERSION = 'v1_2048';

export async function rehydrateImagesFromCache() {
    const currentImages = getStore(images);

    const nextImages = await Promise.all(
        currentImages.map(async (img) => {
            if (img.runtimeUri) return img;

            const contentHash = img.hashes?.contentHash;
            if (!contentHash) return img;

            const workKey = `work::${contentHash}::${WORKING_VERSION}`;
            const blob = await get(workKey);

            if (!blob) {
                console.warn('Missing working image for', img.label);
                return img;
            }

            return {
                ...img,
                runtimeUri: URL.createObjectURL(blob)
            };
        })
    );

    images.set(nextImages);
}