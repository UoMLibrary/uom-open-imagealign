<script lang="ts">
	import type { ImageGroup } from '$lib/core/types';

	export let group: ImageGroup;
	export let index: number; // passed from parent
	export let selected: boolean = false;
</script>

<button class="group-item" class:selected type="button">
	<div class="group-main">
		<div class="group-label">
			Group {index + 1}
		</div>

		<div class="group-meta">
			{group.imageIds.length} image{group.imageIds.length === 1 ? '' : 's'}
		</div>
	</div>
</button>

<style>
	.group-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.6rem;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 6px;
	}

	.group-item:hover {
		background: #f2f2f2;
	}

	.group-item.selected {
		background: #e6f0ff;
		outline: 1px solid #b3d1ff;
	}

	.group-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.group-label {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.group-meta {
		font-size: 0.7rem;
		color: #666;
		white-space: nowrap;
	}
</style>
