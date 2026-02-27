<script lang="ts">
	import { currentMode } from '$lib/core/workspaceStore';

	import PrepareWorkspace from '$lib/workspace/modes/PrepareMode/PrepareWorkspace.svelte';
	import AlignWorkspace from '$lib/workspace/modes/AlignMode/AlignWorkspace.svelte';
	import GroupWorkspace from '$lib/workspace/modes/GroupMode/GroupWorkspace.svelte';
	import AnnotateWorkspace from '$lib/workspace/modes/AnnotateMode/AnnotateWorkspace.svelte';
	import OverviewWorkspace from '$lib/workspace/modes/OverviewMode/OverviewWorkspace.svelte';
</script>

{#if $currentMode === 'prepare'}
	<PrepareWorkspace />
{:else if $currentMode === 'align'}
	<AlignWorkspace />
{:else if $currentMode === 'group'}
	<GroupWorkspace />
{:else if $currentMode === 'annotate'}
	<AnnotateWorkspace />
{:else if $currentMode === 'overview'}
	<OverviewWorkspace />
{/if}
