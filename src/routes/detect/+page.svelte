<script lang="ts">
	import DiffRegionSuggestor, { type Region } from '$lib/ui/shared/DiffRegionSelector.svelte';

	export let diffUrl: string = 'diff/d5.png';

	let suggested: Region[] = [];

	function handleRegionsChange(next: Region[]) {
		suggested = next;
		// This is where you can seed your annotation session/project store.
		// e.g. convert each Region into your rectangle annotation shape.
	}
</script>

<DiffRegionSuggestor diffSrc={diffUrl} accuracy={0.65} onRegionsChange={handleRegionsChange} />

<pre>{JSON.stringify(suggested, null, 2)}</pre>
