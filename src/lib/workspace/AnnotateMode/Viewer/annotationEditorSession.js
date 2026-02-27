import { writable, get } from 'svelte/store';

export function createAnnotationEditorSession(initial = {}) {
	const annotations = writable(initial.annotations ?? []);
	const selectedId = writable(null);

	const viewState = writable({
		overlayOpacity: initial.overlayOpacity ?? 0.5,
		pan: initial.pan ?? null,
		zoom: initial.zoom ?? null
	});

	//  session metadata (not document data)
	const meta = writable({
		initialAnnotationCount: initial.annotations?.length ?? 0
	});

	return {
		// stores
		annotations,
		selectedId,
		viewState,
		meta,

		// annotation ops
		addAnnotation(a) {
			annotations.update((list) => [...list, a]);
		},

		updateAnnotation(updated) {
			annotations.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
		},

		removeAnnotation(id) {
			annotations.update((list) => list.filter((a) => a.id !== id));
			selectedId.update((sel) => (sel === id ? null : sel));
		},

		selectAnnotation(id) {
			selectedId.set(id);
		},

		serialize() {
			return {
				annotations: get(annotations),
				viewState: get(viewState)
			};
		}
	};
}
