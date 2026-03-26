<script lang="ts">
	type Props = {
		busy?: boolean;
		disabled?: boolean;
		onPress?: () => void;
	};

	let { busy = false, disabled = false, onPress }: Props = $props();
</script>

<button onclick={() => onPress?.()} {disabled}>
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
