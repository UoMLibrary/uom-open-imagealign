<script lang="ts">
	import AnnotatedImageCompareViewer from '$lib/ui/shared/AnnotatedImageCompareViewer.svelte';
	import { createAnnotationEditorSession } from '$lib/ui/shared/annotationEditorSession';

	const session = createAnnotationEditorSession();

	let overlayOpacity = $state(0.6);
	let annotationMode = $state<'pan' | 'rectangle' | 'polygon'>('pan');
	let selectedAnnotationId = $state<string | null>(null);
</script>

<AnnotatedImageCompareViewer
	imageUrl={baseUrl}
	{overlayUrl}
	{session}
	bind:overlayOpacity
	bind:annotationMode
	bind:selectedAnnotationId
	enableHoldDifferencePreview={true}
	enableHoldShowBasePreview={true}
/>
