<script>
	import AnnotationItem from './AnnotationItem.svelte';

	export let session;

	let annotations;
	let selectedId;

	$: if (session) {
		({ annotations, selectedId } = session);
	}
</script>

<div class="annotations-list">
	{#if annotations}
		{#each $annotations as a (a.id)}
			<AnnotationItem
				annotation={a}
				selected={a.id === $selectedId}
				on:select={() => session.selectAnnotation(a.id)}
				on:update={(e) => session.updateAnnotation(e.detail)}
				on:delete={(e) => session.removeAnnotation(e.detail)}
			/>
		{/each}
	{/if}
</div>

<style>
	.annotations-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		overflow-y: auto;
		padding: 0.5rem;
	}
</style>
