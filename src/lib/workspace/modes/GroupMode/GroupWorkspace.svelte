<script lang="ts">
	import { images, groups, project, updateProjectUI } from '$lib/core/projectStore';
	import { get } from 'svelte/store';
	import { applyGroupingProposal } from '$lib/services/groupService';
	import type { GroupingProposal } from '$lib/core/groupingStore';
	import { groupingState } from '$lib/core/groupingStore';
	import { initialiseSingleImageProposals } from '$lib/core/groupingStore';

	import Sidebar from '$lib/ui/app/SidePanel.svelte';
	import GroupSidebar from './GroupSidebar.svelte';
	import GroupStrategyPanel from './GroupStrategyPanel.svelte';
	import GroupProposalList from './GroupProposalList.svelte';

	let selectedGroupId: string | null = null;
	let sidebarOpen = true;

	/* ------------------------------------------------
	   Initialise selection from project.ui
	------------------------------------------------ */
	// $: console.log('PROPOSALS NOW:', $groupingState.proposals.length);

	$: {
		if ($groups.length === 0) {
			selectedGroupId = null;
		} else if (!selectedGroupId) {
			const last = $project.ui?.lastSelectedGroupId;

			if (last && $groups.some((g) => g.id === last)) {
				selectedGroupId = last;
			} else {
				selectedGroupId = $groups[0].id;
			}
		}
	}

	import { onMount } from 'svelte';

	onMount(() => {
		if (get(images).length > 0) {
			initialiseSingleImageProposals();
		}
	});

	$: if (selectedGroupId && !$groups.some((g) => g.id === selectedGroupId)) {
		selectedGroupId = null;
	}

	function selectGroup(id: string) {
		selectedGroupId = id;

		updateProjectUI({
			lastSelectedGroupId: id
		});
	}

	function confirmProposal(proposal: GroupingProposal) {
		applyGroupingProposal(proposal);

		groupingState.update((state) => {
			const affected = new Set(proposal.imageIds);

			const remaining = state.proposals.filter((p) => !p.imageIds.some((id) => affected.has(id)));

			return {
				...state,
				proposals: remaining,
				selected: new Set()
			};
		});
	}
</script>

<div class="group-layout">
	<Sidebar side="left" bind:open={sidebarOpen} width={280}>
		<svelte:fragment slot="header">
			<div class="panel-title">
				Groups ({$groups.length})
			</div>
		</svelte:fragment>

		<GroupSidebar {selectedGroupId} on:select={(e) => selectGroup(e.detail.id)} />
	</Sidebar>

	<div class="workspace">
		<div class="suggestions">
			<div class="panel-title">Group Suggestions</div>
			<GroupProposalList on:confirm={(e) => confirmProposal(e.detail)} />
		</div>

		<div class="strategy">
			<GroupStrategyPanel />
		</div>
	</div>
</div>

<style>
	.group-layout {
		display: flex;
		height: 100%;
		min-height: 0; /* important for flex scrolling */
	}

	.workspace {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* Suggestions scroll independently */
	.suggestions {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem;
	}

	/* Strategy docked at bottom */
	.strategy {
		border-top: 1px solid #e5e7eb;
		padding: 0.75rem;
		background: #f9fafb;
	}

	.panel-title {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #6b7280;
		margin-bottom: 0.5rem;
	}
</style>
