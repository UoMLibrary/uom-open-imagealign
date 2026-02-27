<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ImageGroupItem from './ImageGroupItem.svelte';
	import type { ImageGroup } from '$lib/core/types';

	export let groups: ImageGroup[] = [];
	export let selectedGroupId: string | null = null;

	const dispatch = createEventDispatcher();

	function select(id: string) {
		dispatch('select', { id });
	}
</script>

<ul class="group-list">
	{#each groups as group, i (group.id)}
		<li>
			<ImageGroupItem
				{group}
				index={i}
				selected={group.id === selectedGroupId}
				on:click={() => select(group.id)}
			/>
		</li>
	{/each}
</ul>

<style>
	.group-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
</style>
