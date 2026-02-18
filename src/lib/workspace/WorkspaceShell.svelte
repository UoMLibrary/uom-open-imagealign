<script lang="ts">
	import { currentMode } from './workspaceStore';

	import PrepareWorkspace from './modes/PrepareMode/PrepareWorkspace.svelte';
	import AlignWorkspace from './modes/AlignMode/AlignWorkspace.svelte';
	import GroupWorkspace from './modes/GroupMode/GroupWorkspace.svelte';
	import AnnotateWorkspace from './modes/AnnotateMode/AnnotateWorkspace.svelte';
</script>

{#if $currentMode === 'prepare'}
	<PrepareWorkspace />
{:else if $currentMode === 'align'}
	<AlignWorkspace />
{:else if $currentMode === 'group'}
	<GroupWorkspace />
{:else if $currentMode === 'annotate'}
	<AnnotateWorkspace />
{/if}
