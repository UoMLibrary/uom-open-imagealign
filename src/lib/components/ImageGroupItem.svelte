<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ImageGroup } from '$lib/types/project';

	export let group: ImageGroup;
	export let selected = false;

	const dispatch = createEventDispatcher();
</script>

<button class:selected class:locked={group.locked} on:click={() => dispatch('select')}>
	<div class="title">
		Group ({group.imageIds.length} images)
	</div>

	<div class="meta">
		Base: {group.baseImageId}
		{#if group.locked}
			<span class="lock">🔒</span>
		{/if}
	</div>
</button>

<style>
	button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		cursor: pointer;
	}

	button.selected {
		background: #eef3ff;
	}

	button.locked {
		opacity: 0.75;
	}

	.title {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.meta {
		font-size: 0.75rem;
		color: #666;
	}

	.lock {
		margin-left: 0.5rem;
	}
</style>
