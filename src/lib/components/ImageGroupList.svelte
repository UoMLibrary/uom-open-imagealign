<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ImageGroupItem from './ImageGroupItem.svelte';
	import type { ImageGroup } from '$lib/types/project';

	export let groups: ImageGroup[] = [];
	export let selectedId: string | null = null;

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
				selected={group.id === selectedId}
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
