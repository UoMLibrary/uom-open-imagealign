// src/lib/image/phashSimilarity.ts
export function phashSimilarity(a: string, b: string): number {
    if (a.length !== b.length) return 0;

    let matches = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] === b[i]) matches++;
    }

    return matches / a.length; // 0 → 1
}
