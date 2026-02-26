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

	// Stage completion counts
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
	<!-- =========================================
	     Summary Header
	========================================= -->

	<header class="summary">
		<h2>Workflow Overview</h2>

		<div class="stats">
			{#each STAGE_ORDER as stage}
				<div class="stat">
					<div class="count">
						{stageCounts[stage]} / {total}
					</div>
					<div class="label">{stage}</div>
				</div>
			{/each}
		</div>
	</header>

	<!-- =========================================
	     Stage Matrix Table
	========================================= -->

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th class="image-col">Image</th>
					{#each STAGE_ORDER as stage}
						<th>{stage}</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				{#each list as image}
					<tr>
						<td class="image-cell">
							<div class="image-info">
								<div class="thumb">
									<ImageThumbnail
										contentHash={image.hashes?.contentHash}
										fallbackSrc={image.runtimeUri}
										mode="thumb"
									/>
								</div>

								<div class="meta">
									<div class="label">
										{image.label ?? image.id}
									</div>
									<div class="hash">
										{shortHash(image.hashes?.contentHash)}
									</div>
								</div>
							</div>
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
		gap: 1.5rem;
	}

	/* =========================================
	   Summary
	========================================= */

	.summary h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
	}

	.stats {
		display: flex;
		gap: 1.25rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.count {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.label {
		font-size: 0.7rem;
		color: #6b7280;
		text-transform: capitalize;
	}

	/* =========================================
	   Table
	========================================= */

	.table-wrapper {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	thead th {
		text-align: left;
		font-weight: 600;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #e5e7eb;
		text-transform: capitalize;
	}

	tbody td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #f3f4f6;
		vertical-align: middle;
	}

	/* =========================================
	   Image Cell
	========================================= */

	.image-col {
		min-width: 240px;
	}

	.image-cell {
		width: 260px;
	}

	.image-info {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.thumb {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
	}

	.thumb :global(img) {
		object-fit: cover;
		width: 100%;
		height: 100%;
		border-radius: 4px;
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.hash {
		font-size: 0.65rem;
		color: #6b7280;
		font-weight: 600;
		letter-spacing: 0.03em;
	}

	/* =========================================
	   Stage Cells
	========================================= */

	.stage-cell {
		text-align: center;
	}

	.tick {
		color: #16a34a;
		font-weight: 700;
	}

	.cross {
		color: #9ca3af;
	}
</style>
