<script lang="ts">
	type AnnotationLike = {
		id: string;
		schemaId: string;
		targetImageIds: string[];
		geometry?: unknown;
	};

	type Props = {
		annotations: AnnotationLike[];
		geometrySummary?: ((geometry: unknown) => string) | undefined;
	};

	let { annotations, geometrySummary }: Props = $props();

	function summariseGeometry(geometry: unknown): string {
		return geometrySummary?.(geometry) ?? '—';
	}
</script>

<section class="compact-panel">
	<div class="detail-head">
		<h3>Annotations</h3>
		<span class="pill">{annotations.length}</span>
	</div>

	{#if annotations.length === 0}
		<div class="empty-inline">No annotations recorded for this group</div>
	{:else}
		<div class="annotation-list">
			{#each annotations as annotation (annotation.id)}
				<div class="annotation-row">
					<div class="annotation-main">
						<div class="annotation-title">{annotation.schemaId}</div>
						<div class="annotation-sub">
							{summariseGeometry(annotation.geometry)} · {annotation.targetImageIds.length} targets
						</div>
					</div>

					<div class="annotation-id">{annotation.id}</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.compact-panel {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		box-shadow:
			0 10px 30px rgba(15, 23, 42, 0.05),
			0 2px 8px rgba(15, 23, 42, 0.04);
		padding: 1rem;
	}

	.detail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.detail-head h3 {
		margin: 0;
		color: #111827;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		background: #eef2ff;
		color: #334155;
		border: 1px solid rgba(51, 65, 85, 0.08);
		white-space: nowrap;
	}

	.annotation-list {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.8rem;
	}

	.annotation-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.92);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	.annotation-main {
		min-width: 0;
	}

	.annotation-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: #111827;
	}

	.annotation-sub,
	.annotation-id {
		font-size: 0.73rem;
		color: #64748b;
	}

	.empty-inline {
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
		border: 1px dashed rgba(15, 23, 42, 0.16);
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.9);
		padding: 1rem;
		font-size: 0.82rem;
	}

	@media (max-width: 900px) {
		.annotation-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
