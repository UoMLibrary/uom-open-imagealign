<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ImageGroupItem from '../../workspace/panels/GroupListItem.svelte';
	import type { ImageGroup } from '$lib/domain/project/types';

	export let groups: ImageGroup[] = [];
	export let selectedGroupId: string | null = null;

	const dispatch = createEventDispatcher<{ select: { id: string } }>();

	function dispatchSelect(id: string) {
		dispatch('select', { id });
	}
</script>

<ul class="group-list">
	{#each groups as group (group.id)}
		<li>
			<ImageGroupItem
				{group}
				selected={group.id === selectedGroupId}
				on:select={() => dispatchSelect(group.id)}
			/>
		</li>
	{/each}
</ul>

<style>
	.group-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
</style>
