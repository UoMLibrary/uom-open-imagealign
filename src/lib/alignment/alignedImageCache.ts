import { get, set } from 'idb-keyval';
import { renderWarpedImageBlob } from '$lib/alignment/vggRenderService';
import type { TransformData } from '$lib/alignment/vggAlignService';

type UrlEntry = { url: string; refs: number };

const urlCache = new Map<string, UrlEntry>();

function makeAlignedKey(contentHash: string, transform: TransformData) {
	return [
		'aligned',
		contentHash,
		transform.type,
		`${Math.round(transform.targetSize.width)}x${Math.round(transform.targetSize.height)}`,
		transform.H.join(',')
	].join('::');
}

function retainUrl(key: string, blob: Blob) {
	const existing = urlCache.get(key);
	if (existing) {
		existing.refs += 1;
		return { url: existing.url, release: () => releaseAlignedImageUrl(key) };
	}

	const url = URL.createObjectURL(blob);
	urlCache.set(key, { url, refs: 1 });
	return { url, release: () => releaseAlignedImageUrl(key) };
}

function releaseAlignedImageUrl(key: string) {
	const entry = urlCache.get(key);
	if (!entry) return;
	entry.refs -= 1;
	if (entry.refs <= 0) {
		URL.revokeObjectURL(entry.url);
		urlCache.delete(key);
	}
}

export async function getAlignedImageBlob(
	contentHash: string,
	transform: TransformData,
	sourceImage: Blob
): Promise<Blob> {
	const key = makeAlignedKey(contentHash, transform);
	const cached = await get(key);
	if (cached) return cached as Blob;

	const blob = await renderWarpedImageBlob(sourceImage, transform);
	await set(key, blob);
	return blob;
}

export async function getAlignedImageUrl(
	contentHash: string,
	transform: TransformData,
	sourceImage: Blob
) {
	const key = makeAlignedKey(contentHash, transform);
	const blob = await getAlignedImageBlob(contentHash, transform, sourceImage);
	return retainUrl(key, blob);
}

