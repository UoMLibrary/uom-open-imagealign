<script lang="ts">
	import PanelHeader from '$lib/shared/ui/PanelHeader.svelte';
	import SidePanel from '$lib/app/SidePanel.svelte';
	import ImageGroupList from './ImageGroupList.svelte';
	import { groups } from '$lib/domain/project/projectStore';

	export let selectedGroupId: string | null = null;
</script>

<SidePanel side="left" open={true}>
	<PanelHeader inline>
		<h2 class="panel-title">Grouped Images</h2>
	</PanelHeader>

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
