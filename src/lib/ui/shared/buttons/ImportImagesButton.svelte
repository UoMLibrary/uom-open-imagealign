<script lang="ts">
	export let busy = false;
	export let disabled = false;
	export let onPress: (() => void) | undefined = undefined;
</script>

<button on:click={() => onPress?.()} {disabled}>
	{busy ? 'Processing…' : 'Import Images'}
</button>

<style>
	button {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	button:disabled {
		cursor: default;
		opacity: 0.7;
	}
</style>
