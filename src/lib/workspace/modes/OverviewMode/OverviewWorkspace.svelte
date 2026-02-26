<script lang="ts">
	import { images } from '$lib/core/projectStore';
	import { STAGE_ORDER, isStageAtOrBeyond } from '$lib/core/workflow';
	import ImageThumbnail from '$lib/ui/features/thumbnails/ImageThumbnail.svelte';
	import type { WorkflowStage } from '$lib/core/workflow';

	/* -------------------------------------------------
	   Derived Data
	------------------------------------------------- */

	$: list = $images;
	$: total = list.length;

	// Count how many images are at or beyond each stage
	$: stageCounts = STAGE_ORDER.reduce(
		(acc, stage) => {
			acc[stage] = list.filter((img) =>
				isStageAtOrBeyond(img.workflow?.stage ?? 'ingested', stage)
			).length;
			return acc;
		},
		{} as Record<WorkflowStage, number>
	);

	function shortHash(hash?: string) {
		return hash?.slice(0, 5).toUpperCase() ?? '';
	}
</script>

<section class="overview">
	<h2>Workflow Overview</h2>

	<div class="table-wrapper">
		<table>
			<!-- =========================================
			     Header
			========================================= -->

			<thead>
				<tr>
					<th class="thumb-col">Thumbnail</th>
					<th class="file-col">Filename</th>
					<th class="hash-col">Hash</th>

					{#each STAGE_ORDER as stage}
						<th class="stage-header">
							<div class="stage-title">
								{stage}
							</div>
							<div class="stage-count">
								{stageCounts[stage]} of {total}
							</div>
						</th>
					{/each}
				</tr>
			</thead>

			<!-- =========================================
			     Body
			========================================= -->

			<tbody>
				{#each list as image}
					<tr>
						<td class="thumb-cell">
							<ImageThumbnail
								contentHash={image.hashes?.contentHash}
								fallbackSrc={image.runtimeUri}
								mode="thumb"
							/>
						</td>

						<td class="file-cell">
							{image.label ?? image.id}
						</td>

						<td class="hash-cell">
							{shortHash(image.hashes?.contentHash)}
						</td>

						{#each STAGE_ORDER as stage}
							<td class="stage-cell">
								{#if isStageAtOrBeyond(image.workflow?.stage ?? 'ingested', stage)}
									<span class="tick">✓</span>
								{:else}
									<span class="cross">✕</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.overview {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.table-wrapper {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	thead th {
		border-bottom: 1px solid #e5e7eb;
		padding: 0.75rem 0.75rem;
		vertical-align: bottom;
	}

	tbody td {
		border-bottom: 1px solid #f3f4f6;
		padding: 0.6rem 0.75rem;
		vertical-align: middle;
	}

	/* -----------------------------------------
	   Column widths
	----------------------------------------- */

	.thumb-col {
		width: 72px;
	}
	.hash-col {
		width: 80px;
	}

	/* -----------------------------------------
	   Thumbnail
	----------------------------------------- */

	.thumb-cell {
		width: 64px;
	}

	.thumb-cell :global(img) {
		width: 48px;
		height: 48px;
		object-fit: cover;
		border-radius: 4px;
	}

	/* -----------------------------------------
	   Stage Header
	----------------------------------------- */

	.stage-header {
		text-align: center;
		min-width: 90px;
	}

	.stage-title {
		font-weight: 600;
		text-transform: capitalize;
	}

	.stage-count {
		font-size: 0.65rem;
		color: #9ca3af;
		margin-top: 0.2rem;
	}

	/* -----------------------------------------
	   Stage Cells
	----------------------------------------- */

	.stage-cell {
		text-align: center;
	}

	.tick {
		color: #16a34a;
		font-weight: 700;
	}

	.cross {
		color: #9ca3af;
		font-weight: 600;
	}

	/* -----------------------------------------
	   Filename / Hash
	----------------------------------------- */

	.file-cell {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 220px;
	}

	.hash-cell {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: #374151;
		letter-spacing: 0.05em;
	}
</style>
