// annotationCompareSession.ts
import { writable, get } from 'svelte/store';

export type AnnotationMode = 'pan' | 'rectangle' | 'polygon';

export type AnnotationCompareViewState = {
    overlayOpacity: number;
    annotationMode: AnnotationMode;
    annotationsVisible: boolean;
    collapsed: boolean;
    readingFocusEnabled: boolean;
    readingFocusClearCenterPct: number;
    readingFocusOpacity: number;
    readingFocusBlurPx: number;
};

export const defaultAnnotationCompareViewState: AnnotationCompareViewState = {
    overlayOpacity: 0.6,
    annotationMode: 'pan',
    annotationsVisible: true,
    collapsed: false,
    readingFocusEnabled: false,
    readingFocusClearCenterPct: 30,
    readingFocusOpacity: 0.35,
    readingFocusBlurPx: 0
};

export type CreateAnnotationCompareSessionOptions<TAnnotation = any> =
    Partial<AnnotationCompareViewState> & {
        annotations?: TAnnotation[];
        selectedId?: string | null;
    };

export function createAnnotationCompareSession<TAnnotation = any>(
    initial: CreateAnnotationCompareSessionOptions<TAnnotation> = {}
) {
    const annotations = writable<TAnnotation[]>(initial.annotations ?? []);
    const selectedId = writable<string | null>(initial.selectedId ?? null);

    const viewState = writable<AnnotationCompareViewState>({
        ...defaultAnnotationCompareViewState,
        ...initial
    });

    const meta = writable({
        initialAnnotationCount: initial.annotations?.length ?? 0
    });

    return {
        annotations,
        selectedId,
        viewState,
        meta,

        setAnnotations(next: TAnnotation[]) {
            annotations.set(next);
        },

        addAnnotation(annotation: TAnnotation) {
            annotations.update((list) => [...list, annotation]);
        },

        updateAnnotation(updated: TAnnotation & { id?: string }) {
            annotations.update((list) =>
                list.map((item: any) => (item?.id === updated?.id ? updated : item))
            );
        },

        removeAnnotation(id: string) {
            annotations.update((list: any[]) => list.filter((item) => item?.id !== id));
            selectedId.update((current) => (current === id ? null : current));
        },

        selectAnnotation(id: string | null) {
            selectedId.set(id);
        },

        patchViewState(patch: Partial<AnnotationCompareViewState>) {
            viewState.update((current) => ({ ...current, ...patch }));
        },

        serialize() {
            return {
                annotations: get(annotations),
                selectedId: get(selectedId),
                viewState: get(viewState)
            };
        }
    };
}

export type AnnotationCompareSession = ReturnType<typeof createAnnotationCompareSession>;