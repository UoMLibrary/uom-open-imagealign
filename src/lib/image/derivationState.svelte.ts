// $lib/image/derivationState.svelte.ts

type CacheEpochState = {
    global: number;
    perHash: Record<string, number>;
};

export const derivationCacheState = $state<CacheEpochState>({
    global: 0,
    perHash: {}
});

export function bumpDerivationCacheGlobal() {
    derivationCacheState.global += 1;
}

export function bumpDerivationCacheForHash(contentHash: string) {
    if (!contentHash) return;
    derivationCacheState.perHash[contentHash] =
        (derivationCacheState.perHash[contentHash] ?? 0) + 1;
}

export function getDerivationCacheKey(contentHash: string) {
    const perHash = derivationCacheState.perHash[contentHash] ?? 0;
    return `${contentHash}:${derivationCacheState.global}:${perHash}`;
}