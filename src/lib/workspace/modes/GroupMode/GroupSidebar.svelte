<script lang="ts">
	import PanelHeader from '$lib/shared/ui/PanelHeader.svelte';
	import SidePanel from '$lib/app/SidePanel.svelte';
	import ImageGroupList from './ImageGroupList.svelte';
	import { groups } from '$lib/domain/project/projectStore';

	export let selectedGroupId: string | null = null;
</script>

<SidePanel side="left" open={true}>
	<svelte:fragment slot="header">
		<div class="panel-title">Groups</div>
	</svelte:fragment>

	{#if $groups.length > 0}
		<ImageGroupList
			groups={$groups}
			{selectedGroupId}
			on:select={(e) => (selectedGroupId = e.detail.id)}
		/>
	{:else}
		<div class="empty">No groups yet</div>
	{/if}
</SidePanel>

<style>
	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #6b7280;
		padding: 0.5rem 0.75rem;
	}
</style>
