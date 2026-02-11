<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ImageGroupSummary from './ImageGroupSummary.svelte';
	import ImageGroupEditor from './ImageGroupEditor.svelte';
	import type { ImageGroup } from '$lib/types/project';

	export let group: ImageGroup;
	export let selected = false;

	const dispatch = createEventDispatcher<{
		select: void;
	}>();
</script>

<div class="group-item">
	{#if selected}
		<ImageGroupEditor {group} />
	{:else}
		<!-- 🔑 THIS is the missing link -->
		<div on:click={() => dispatch('select')}>
			<ImageGroupSummary {group} />
		</div>
	{/if}
</div>

<style>
	.group-item {
		border-bottom: 1px solid #e0e0e0;
	}
</style>
