<script lang="ts">
	import AnnotationDataEditor from './AnnotationDataEditor.svelte';

	type AnnotationLike = {
		id: string;
		schemaId: string;
		anchorImageId?: string;
		targetImageIds: string[];
		geometry?: unknown;
		data?: Record<string, unknown>;
	};

	type Props = {
		annotations: AnnotationLike[];
		selectedAnnotationId?: string | null;
		selectedAnnotation?: AnnotationLike | null;
		annotationSchema?: Record<string, unknown> | null;
		activePairImageIds?: string[];
		imageTitleById?: Record<string, string>;
		geometrySummary?: ((geometry: unknown) => string) | undefined;
		onSelect?: ((annotationId: string) => void) | undefined;
		onDataChange?:
			| ((annotationId: string, nextValue: Record<string, unknown>) => void)
			| undefined;
	};

	let {
		annotations,
		selectedAnnotationId = null,
		selectedAnnotation = null,
		annotationSchema = null,
		activePairImageIds = [],
		imageTitleById = {},
		geometrySummary,
		onSelect,
		onDataChange
	}: Props = $props();

	function summariseGeometry(geometry: unknown): string {
		return geometrySummary?.(geometry) ?? '—';
	}

	function getImageLabel(imageId: string | undefined): string {
		if (!imageId) return 'Unknown image';
		return imageTitleById[imageId] ?? imageId;
	}

	function getPairLabel(annotation: AnnotationLike): string {
		const anchor = getImageLabel(annotation.anchorImageId);
		const targets = annotation.targetImageIds.map(getImageLabel);

		if (targets.length === 0) return anchor;
		return `${anchor} -> ${targets.join(', ')}`;
	}

	function isActivePair(annotation: AnnotationLike): boolean {
		if (activePairImageIds.length === 0) return false;

		const imageIds = new Set([annotation.anchorImageId, ...annotation.targetImageIds].filter(Boolean));
		return activePairImageIds.every((imageId) => imageIds.has(imageId));
	}

	function select(annotationId: string) {
		onSelect?.(annotationId);
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
				<button
					type="button"
					class="annotation-row"
					class:selected={annotation.id === selectedAnnotationId}
					class:pair-match={isActivePair(annotation)}
					onclick={() => select(annotation.id)}
				>
					<div class="annotation-main">
						<div class="annotation-title">{annotation.schemaId}</div>
						<div class="annotation-pair">{getPairLabel(annotation)}</div>
						<div class="annotation-sub">
							{summariseGeometry(annotation.geometry)} · {annotation.targetImageIds.length} targets
						</div>
					</div>

					<div class="annotation-id">{annotation.id}</div>
				</button>
			{/each}
		</div>
	{/if}

	<section class="annotation-editor-panel">
		<div class="annotation-editor-head">
			<div>
				<div class="annotation-editor-title">Annotation Data</div>
				<div class="annotation-editor-subtitle">
					{selectedAnnotation ? selectedAnnotation.schemaId : 'Select a shape to edit its fields'}
				</div>
			</div>
		</div>

		<AnnotationDataEditor
			annotationId={selectedAnnotation?.id ?? null}
			schema={annotationSchema}
			value={selectedAnnotation?.data ?? null}
			onChange={(nextValue) => {
				if (!selectedAnnotation) return;
				onDataChange?.(selectedAnnotation.id, nextValue);
			}}
		/>
	</section>
</section>

<style>
	.compact-panel {
		height: 100%;
		background: rgba(255, 255, 255, 0.92);
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.detail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		flex: 0 0 auto;
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
		min-height: 8rem;
		overflow: auto;
		flex: 1 1 auto;
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
		text-align: left;
		cursor: pointer;
		color: inherit;
		transition:
			border-color 140ms ease,
			background-color 140ms ease,
			box-shadow 140ms ease;
	}

	.annotation-row:hover {
		border-color: rgba(59, 130, 246, 0.18);
		background: rgba(239, 246, 255, 0.75);
	}

	.annotation-row.selected {
		border-color: rgba(37, 99, 235, 0.38);
		background: rgba(219, 234, 254, 0.82);
		box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
	}

	.annotation-row.pair-match:not(.selected) {
		border-color: rgba(16, 185, 129, 0.22);
	}

	.annotation-main {
		min-width: 0;
	}

	.annotation-title {
		font-size: 0.84rem;
		font-weight: 700;
		color: #111827;
	}

	.annotation-pair {
		margin-top: 0.16rem;
		font-size: 0.74rem;
		color: #334155;
	}

	.annotation-sub,
	.annotation-id {
		font-size: 0.73rem;
		color: #64748b;
	}

	.annotation-sub {
		margin-top: 0.18rem;
	}

	.annotation-id {
		flex: 0 0 auto;
		max-width: 7rem;
		text-align: right;
		word-break: break-word;
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
		margin-top: 0.8rem;
	}

	.annotation-editor-panel {
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 0;
	}

	.annotation-editor-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.annotation-editor-title {
		font-size: 0.82rem;
		font-weight: 700;
		color: #0f172a;
	}

	.annotation-editor-subtitle {
		margin-top: 0.12rem;
		font-size: 0.73rem;
		color: #64748b;
	}

	@media (max-width: 900px) {
		.annotation-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.annotation-id {
			max-width: none;
			text-align: left;
		}
	}
</style>
