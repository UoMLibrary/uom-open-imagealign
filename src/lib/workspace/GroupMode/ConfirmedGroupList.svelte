<script lang="ts">
	import { groups } from '$lib/core/projectStore';
	import GroupCell from '$lib/ui/shared/GroupCell.svelte';

	let { selectedGroupId = null, onSelect }: { selectedGroupId?: string | null; onSelect?: (id: string) => void } = $props();

	// $: list = $groups.map((g, idx) => ({ ...g, __key: `${g.id}:${idx}` }));
	let list = $derived($groups);

	function select(id: string) {
		onSelect?.(id);
	}

	$effect(() => {
		console.log('GROUPS ARRAY REF CHANGED');
	});
</script>

<div class="group-list">
	{#if list.length === 0}
		<div class="empty">No groups yet</div>
	{:else}
		{#each list as group (group.id)}
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
