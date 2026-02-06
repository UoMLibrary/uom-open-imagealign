<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	export let disabled = false;
</script>

<button on:click={() => dispatch('save')} {disabled}> Save </button>
