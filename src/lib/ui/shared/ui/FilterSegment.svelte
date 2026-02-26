<script lang="ts">
	type FilterOption = {
		value: string;
		label: string;
	};

	export let options: FilterOption[] = [];
	export let value: string;
	export let onChange: (value: string) => void;

	function select(v: string) {
		if (v !== value) {
			onChange?.(v);
		}
	}
</script>

<div class="segment">
	{#each options as option}
		<button class:selected={value === option.value} on:click={() => select(option.value)}>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.segment {
		display: inline-flex;
		background: #f3f4f6;
		padding: 2px;
		border-radius: 8px;
		gap: 2px;
	}

	button {
		all: unset;
		font-size: 0.72rem;
		padding: 4px 8px;
		border-radius: 6px;
		cursor: pointer;
		color: #6b7280;
		font-weight: 500;
	}

	button.selected {
		background: white;
		color: #111827;
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
	}
</style>
