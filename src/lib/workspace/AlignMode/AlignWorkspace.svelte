<script>
	import PadlockButton from '$lib/ui/shared/buttons/PadlockButton.svelte';

	let locked = true;
	let viewLocked = false;
</script>

<div>AlignWorkspace</div>
<PadlockButton
	{locked}
	color={locked ? '#ef4444' : '#6b7280'}
	size={16}
	onChange={(v) => (locked = v)}
	ariaLabelLocked="Unlock image"
	ariaLabelUnlocked="Lock image"
	showHover={false}
/>

<div class="toolbar">
	<PadlockButton
		locked={viewLocked}
		color={viewLocked ? '#16a34a' : '#374151'}
		size={20}
		onChange={(v) => (viewLocked = v)}
		ariaLabelLocked="Unlock workspace"
		ariaLabelUnlocked="Lock workspace"
		showHover={false}
	/>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		height: 48px;
		padding: 0 0.5rem;
	}
</style>
