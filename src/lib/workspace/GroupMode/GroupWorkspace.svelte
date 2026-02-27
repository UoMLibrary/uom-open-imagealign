<script lang="ts">
	import { images, groups, project, updateProjectUI } from '$lib/core/projectStore';
	import { get } from 'svelte/store';
	import { applyGroupingProposal } from '$lib/services/groupService';
	import type { GroupingProposal } from '$lib/core/groupingStore';
	import { groupingState } from '$lib/core/groupingStore';
	import { initialiseSingleImageProposals } from '$lib/core/groupingStore';

	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import ConfirmedGroupList from './ConfirmedGroupList.svelte';
	import GroupStrategyPanel from './GroupStrategyPanel.svelte';
	import GroupProposalList from './GroupProposalList.svelte';

	let selectedGroupId: string | null = null;
	let SidePanelOpen = true;

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

	function handleConfirm(proposal: GroupingProposal) {
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

	function handleDiscard(id: string) {
		console.log('Discarding proposal', id);
	}
</script>

<div class="group-layout">
	<SidePanel side="left" bind:open={SidePanelOpen} width={280}>
		<svelte:fragment slot="header">
			<div class="panel-header">
				<div class="header-row">
					<div class="panel-title">Groups</div>
				</div>
			</div>
		</svelte:fragment>

		<ConfirmedGroupList {selectedGroupId} on:select={(e) => selectGroup(e.detail.id)} />
	</SidePanel>

	<div class="workspace">
		<div class="suggestions">
			<div class="panel-title">Group Suggestions</div>
			<GroupProposalList
				onConfirm={(proposal) => handleConfirm(proposal)}
				onDiscard={(id) => handleDiscard(id)}
			/>
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

	/* SidePanel header */
	.panel-header {
		padding: 0.4rem 0.75rem 0.4rem 0.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		line-height: 1; /* prevents vertical drift */
		margin: 0; /* remove bottom spacing */
		padding: 0.4rem 0; /* add vertical padding */
	}
</style>
