import { get, set, del, keys } from 'idb-keyval';
import { THUMB_VERSION, WORKING_VERSION } from '$lib/image/versions';

export type DerivationKind = 'work' | 'thumb';

type DerivationConfig = {
    size: number;
    version: string;
    mime: 'image/jpeg' | 'image/png';
    quality?: number;
    background?: string;
};

/* ------------------------------------------------------------
   CURRENT DERIVATION POLICY
   (Single source of truth)
------------------------------------------------------------ */

const CONFIG: Record<DerivationKind, DerivationConfig> = {
    work: {
        size: 2048,
        version: WORKING_VERSION,
        mime: 'image/jpeg',
        quality: 0.9,
        background: '#ffffff'
    },
    thumb: {
        size: 256,
        version: THUMB_VERSION,
        mime: 'image/jpeg',
        quality: 0.8,
        background: '#ffffff'
    }
};

/* ------------------------------------------------------------
   Key format
   kind::contentHash::version::size
------------------------------------------------------------ */

// function makeKey(kind: DerivationKind, contentHash: string) {
//     const cfg = CONFIG[kind];
//     return `${kind}::${contentHash}::${cfg.version}::${cfg.size}`;
// }

function makeKey(kind: DerivationKind, contentHash: string) {
    const cfg = CONFIG[kind];
    const key = `${kind}::${contentHash}::${cfg.version}::${cfg.size}`;
    console.log('DERIVATION KEY:', key);
    return key;
}

/* ------------------------------------------------------------
   In-flight dedupe + URL ref tracking
------------------------------------------------------------ */

const inFlight = new Map<string, Promise<Blob>>();

type UrlEntry = { url: string; refs: number };
const urlCache = new Map<string, UrlEntry>();

function retainUrl(key: string, blob: Blob) {
    const existing = urlCache.get(key);
    if (existing) {
        existing.refs++;
        return { url: existing.url, release: () => releaseUrl(key) };
    }

    const url = URL.createObjectURL(blob);
    urlCache.set(key, { url, refs: 1 });
    return { url, release: () => releaseUrl(key) };
}

function releaseUrl(key: string) {
    const entry = urlCache.get(key);
    if (!entry) return;
    entry.refs--;
    if (entry.refs <= 0) {
        URL.revokeObjectURL(entry.url);
        urlCache.delete(key);
    }
}

/* ------------------------------------------------------------
   Public API
------------------------------------------------------------ */

export async function getDerivedBlob(
    contentHash: string,
    kind: DerivationKind,
    file?: File
): Promise<Blob> {
    const key = makeKey(kind, contentHash);

    const cached = await get(key);
    console.log('Cache lookup for', key, '->', cached);
    if (cached) return cached as Blob;

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = (async () => {
        const blob = await build(kind, contentHash, file);
        await set(key, blob);
        return blob;
    })();

    inFlight.set(key, promise);

    try {
        return await promise;
    } finally {
        inFlight.delete(key);
    }
}

export async function getDerivedUrl(
    contentHash: string,
    kind: DerivationKind,
    file?: File
) {
    const key = makeKey(kind, contentHash);
    const blob = await getDerivedBlob(contentHash, kind, file);
    return retainUrl(key, blob);
}

/* ------------------------------------------------------------
   Deterministic purge for version changes
------------------------------------------------------------ */

export async function purgeOutdatedDerivations() {
    const allKeys = await keys();

    for (const key of allKeys) {
        if (typeof key !== 'string') continue;

        if (key.startsWith('thumb::') && !key.includes(`::${THUMB_VERSION}::`)) {
            await del(key);
        }

        if (key.startsWith('work::') && !key.includes(`::${WORKING_VERSION}::`)) {
            await del(key);
        }
    }
}

/* ------------------------------------------------------------
   Builders
------------------------------------------------------------ */

async function build(
    kind: DerivationKind,
    contentHash: string,
    file?: File
): Promise<Blob> {
    if (kind === 'work') {
        if (!file) throw new Error('Missing file to build work image');
        const bitmap = await createImageBitmap(file);
        return buildSquareFit(bitmap, CONFIG.work);
    }

    if (kind === 'thumb') {
        const workKey = makeKey('work', contentHash);
        const workBlob = await get(workKey);

        if (!workBlob) {
            if (!file) throw new Error('Work image missing and no source file');
            // build work first
            await getDerivedBlob(contentHash, 'work', file);
            return build(kind, contentHash, file);
        }

        const bitmap = await createImageBitmap(workBlob as Blob);
        return buildSquareFit(bitmap, CONFIG.thumb);
    }

    throw new Error('Unsupported derivation kind');
}

async function buildSquareFit(bitmap: ImageBitmap, cfg: DerivationConfig) {
    const size = cfg.size;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = cfg.background ?? '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, size / maxDim);

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const offsetX = Math.round((size - w) / 2);
    const offsetY = Math.round((size - h) / 2);

    ctx.drawImage(bitmap, offsetX, offsetY, w, h);

    return new Promise<Blob>((resolve) => {
        if (cfg.mime === 'image/png') {
            canvas.toBlob((b) => resolve(b!), 'image/png');
        } else {
            canvas.toBlob((b) => resolve(b!), 'image/jpeg', cfg.quality ?? 0.85);
        }
    });
}