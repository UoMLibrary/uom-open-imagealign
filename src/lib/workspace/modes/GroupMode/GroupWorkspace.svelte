<script lang="ts">
	import GroupSidebar from './GroupSidebar.svelte';
	import GroupStrategyPanel from './GroupStrategyPanel.svelte';
	import GroupProposalList from './GroupProposalList.svelte';
	import ImageThumbnailGrid from '$lib/features/thumbnails/ImageThumbnailGrid.svelte';

	import { groups } from '$lib/domain/project/projectStore';
	import { ungroupedImageIds } from '$lib/domain/project/derived';

	let selectedGroupId: string | null = null;
</script>

<div class="workspace">
	<GroupSidebar bind:selectedGroupId />

	<div class="main">
		<GroupStrategyPanel />

		<GroupProposalList />

		{#if $ungroupedImageIds.length > 0}
			<section>
				<h2 class="panel-title">Ungrouped Images</h2>
				<ImageThumbnailGrid visibleImageIds={$ungroupedImageIds} />
			</section>
		{/if}
	</div>
</div>
