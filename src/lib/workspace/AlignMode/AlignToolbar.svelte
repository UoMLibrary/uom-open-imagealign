<script context="module" lang="ts">
	export type AlignStrategy = 'manual' | 'keypoints' | 'affine';
</script>

<script lang="ts">
	import FilterSegment from '$lib/ui/shared/FilterSegment.svelte';

	export let strategy: AlignStrategy = 'manual';
	export let onChange: (s: AlignStrategy) => void;

	const options = [
		{ value: 'manual', label: 'Manual' },
		{ value: 'keypoints', label: 'Keypoints' }
		// { value: 'affine', label: 'Affine' }
	];
</script>

<div class="toolbar">
	<div class="left">
		<div class="title">Alignment</div>
		<FilterSegment {options} value={strategy} onChange={(v) => onChange?.(v as AlignStrategy)} />
	</div>

	<div class="right">
		<slot name="right" />
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.75rem;
		background: rgba(255, 255, 255, 0.97);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}

	.left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.title {
		font-weight: 700;
		color: #111827;
		font-size: 0.9rem;
	}

	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
