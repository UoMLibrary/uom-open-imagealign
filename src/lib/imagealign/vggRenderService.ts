import { base } from '$app/paths';
import type { TransformData } from '$lib/imagealign/vggAlignService';

type SupportedTransform = Pick<TransformData, 'H' | 'targetSize' | 'type'>;

type GlRenderer = (image: CanvasImageSource, H?: ArrayLike<number> | null, clear?: boolean) => void;

declare global {
    interface Window {
        setup_gl?: (canvas: HTMLCanvasElement, mode?: 'geometric' | 'photometric') => GlRenderer;
        __vggGlUtilsScriptPromise?: Promise<void>;
    }
}

function assertBrowser() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('vggRenderService can only run in the browser');
    }
}

async function ensureGlUtilsScript(scriptUrl = `${base}/vendor/vgg/glutils.js`): Promise<void> {
    assertBrowser();

    if (window.setup_gl) return;

    if (!window.__vggGlUtilsScriptPromise) {
        window.__vggGlUtilsScriptPromise = new Promise<void>((resolve, reject) => {
            const existing = document.querySelector(
                'script[data-vgg-glutils="true"]'
            ) as HTMLScriptElement | null;

            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener(
                    'error',
                    () => reject(new Error(`Failed to load ${scriptUrl}`)),
                    { once: true }
                );
                return;
            }

            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.type = 'text/javascript';
            script.dataset.vggGlutils = 'true';

            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${scriptUrl}`));

            document.head.appendChild(script);
        });
    }

    await window.__vggGlUtilsScriptPromise;

    if (!window.setup_gl) {
        throw new Error('glutils.js loaded but setup_gl was not found on window');
    }
}

export async function renderWarpedImageBlob(
    queryImage: Blob,
    transform: SupportedTransform,
    options?: { scriptUrl?: string }
): Promise<Blob> {
    assertBrowser();
    await ensureGlUtilsScript(options?.scriptUrl);

    if (!window.setup_gl) {
        throw new Error('setup_gl is unavailable');
    }

    const bitmap = await createImageBitmap(queryImage);

    try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(transform.targetSize.width);
        canvas.height = Math.round(transform.targetSize.height);

        const render = window.setup_gl(canvas, 'geometric');

        // Important:
        // The workbench passes H directly to render(...).
        // Do not add extra inversion / centre transforms here.
        render(bitmap, transform.H);

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create warped image blob'));
                    return;
                }
                resolve(blob);
            }, 'image/png');
        });
    } finally {
        bitmap.close();
    }
}

export async function renderWarpedImageUrl(
    queryImage: Blob,
    transform: SupportedTransform,
    options?: { scriptUrl?: string }
): Promise<string> {
    const blob = await renderWarpedImageBlob(queryImage, transform, options);
    return URL.createObjectURL(blob);
}