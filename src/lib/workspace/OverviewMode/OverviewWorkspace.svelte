<script lang="ts">
	import { images } from '$lib/core/projectStore';
	import { STAGE_ORDER, isStageAtOrBeyond, type WorkflowStage } from '$lib/core/workflow';

	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';
	import FilterSegment from '$lib/ui/shared/FilterSegment.svelte';

	/* -------------------------------------------------
	   Filter Setup
	------------------------------------------------- */

	type FilterMode = 'all' | WorkflowStage;

	const filterOptions = [
		{ value: 'all', label: 'All' },
		...STAGE_ORDER.map((stage) => ({
			value: stage,
			label: stage.charAt(0).toUpperCase() + stage.slice(1)
		}))
	];

	let filter: FilterMode = 'all';

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

	// Apply filter
	$: filteredList = filterImages(list, filter);

	function filterImages(images: typeof list, mode: FilterMode) {
		if (mode === 'all') return images;

		return images.filter((img) => isStageAtOrBeyond(img.workflow?.stage ?? 'ingested', mode));
	}

	function shortHash(hash?: string) {
		return hash?.slice(0, 5).toUpperCase() ?? '';
	}

	function shortID(id?: string) {
		return id?.slice(0, 5) ?? '';
	}
</script>

<section class="overview">
	<div class="header-row">
		<h2>Workflow Overview</h2>

		<FilterSegment
			options={filterOptions}
			value={filter}
			onChange={(v) => (filter = v as FilterMode)}
		/>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th class="thumb-col">Thumbnail</th>
					<th class="thumb-col">Normalised</th>
					<th class="file-col">Filename</th>
					<th class="hash-col">ID</th>

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

			<tbody>
				{#each filteredList as image}
					<tr>
						<td class="thumb-cell">
							<ImageThumbnail
								contentHash={image.hashes?.contentHash}
								fallbackSrc={image.runtimeUri}
								mode="thumb"
								debugCompare={true}
							/>
						</td>

						<td class="thumb-cell">
							<ImageThumbnail
								contentHash={image.hashes?.contentHash}
								fallbackSrc={image.runtimeUri}
								mode="normalised"
								debugCompare={true}
							/>
						</td>

						<td class="file-cell">
							{image.label ?? image.id}
						</td>

						<td class="hash-cell">
							{shortID(image.id)}
						</td>

						{#each STAGE_ORDER as stage}
							<td class="stage-cell">
								{#if isStageAtOrBeyond(image.workflow?.stage ?? 'ingested', stage)}
									<div class="badge confirmed">✓</div>
								{:else}
									<div class="cross">✕</div>
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
	/* ==================================================
	   Layout & Scrolling
	================================================== */

	.overview {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;

		flex: 1;
		min-height: 0; /* critical in flex layouts */
		overflow-y: auto; /* enables scrolling */
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	/* ==================================================
	   Column Widths
	================================================== */

	.thumb-col {
		width: 24px; /* exact fit for thumbnail */
	}
	.hash-col {
		width: 80px;
	}

	/* ==================================================
	   Thumbnail Fix (removes padding)
	================================================== */

	.thumb-cell {
		width: 24px;
		height: 24px;
	}

	.thumb-cell :global(.image-frame) {
		padding: 0;
		border: none;
		background: transparent;
	}

	/* ==================================================
	   Filename & Hash
	================================================== */

	.file-cell {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 260px;
	}

	.hash-cell {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: #374151;
		letter-spacing: 0.05em;
	}

	/* ==================================================
	   Stage Headers
	================================================== */

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
		font-weight: 500;
	}

	/* ==================================================
	   Stage Cells
	================================================== */

	.stage-cell {
		text-align: center;
	}

	.cross {
		color: #9ca3af;
		font-weight: 600;
	}

	/* ==================================================
    Stage Badge
	================================================== */

	.stage-cell {
		text-align: center;
		vertical-align: middle;
	}

	.badge {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		font-size: 0.65rem;
		display: inline-flex; /* ← inline-flex instead of flex */
		align-items: center;
		justify-content: center;
		font-weight: 600;
	}

	.badge.confirmed {
		background: #22c55e;
		color: white;
	}
</style>
