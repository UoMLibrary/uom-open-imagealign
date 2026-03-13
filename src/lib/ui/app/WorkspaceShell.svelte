<script lang="ts">
	import { currentMode } from '$lib/core/workspaceStore';

	import ProjectWorkspace from '$lib/workspace/ProjectWorkspace/ProjectWorkspace.svelte';
	import AlignWorkspace from '$lib/workspace/AlignMode/AlignWorkspace.svelte';
	import AnnotateWorkspace from '$lib/workspace/AnnotateMode/AnnotateWorkspace.svelte';
	import OverviewWorkspace from '$lib/workspace/OverviewMode/OverviewWorkspace.svelte';
</script>

{#if $currentMode === 'align'}
	<AlignWorkspace />
{:else if $currentMode === 'project'}
	<ProjectWorkspace />
{:else if $currentMode === 'annotate'}
	<AnnotateWorkspace />
{:else if $currentMode === 'overview'}
	<OverviewWorkspace />
{/if}
