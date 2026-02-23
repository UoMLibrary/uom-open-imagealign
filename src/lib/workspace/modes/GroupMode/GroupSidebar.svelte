<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { groups } from '$lib/domain/project/projectStore';

	export let selectedGroupId: string | null = null;

	const dispatch = createEventDispatcher<{
		select: { id: string };
	}>();

	function select(id: string) {
		dispatch('select', { id });
	}
</script>

<div class="group-list">
	{#if $groups.length === 0}
		<div class="empty">No groups yet</div>
	{:else}
		{#each $groups as group (group.id)}
			<div
				class="group-row"
				class:selected={group.id === selectedGroupId}
				on:click={() => select(group.id)}
			>
				Group ({group.imageIds.length})
			</div>
		{/each}
	{/if}
</div>

<style>
	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
	}

	.group-row {
		padding: 0.5rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.group-row:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.group-row.selected {
		background: rgba(0, 0, 0, 0.08);
		font-weight: 600;
	}
</style>
