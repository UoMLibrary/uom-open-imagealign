<script lang="ts">
	import { groups } from '$lib/core/projectStore';
	import GroupCell from '$lib/ui/shared/GroupCell.svelte';

	export let selectedGroupId: string | null = null;
	export let onSelect: ((id: string) => void) | undefined;

	$: list = $groups.map((g, idx) => ({ ...g, __key: `${g.id}:${idx}` }));

	function select(id: string) {
		onSelect?.(id);
	}
</script>

<div class="group-list">
	{#if list.length === 0}
		<div class="empty">No groups yet</div>
	{:else}
		{#each list as group (group.__key)}
			<GroupCell {group} selected={group.id === selectedGroupId} onSelect={select} />
		{/each}
	{/if}
</div>

<style>
	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
	}

	.empty {
		padding: 0.5rem;
		font-size: 0.8rem;
		color: #6b7280;
	}
</style>
