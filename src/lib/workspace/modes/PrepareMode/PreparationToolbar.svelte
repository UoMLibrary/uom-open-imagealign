<script lang="ts">
	export let selectedImage;
</script>

<div class="toolbar">
	<div class="meta-item">
		<span class="label">ID</span>
		<span class="value">{selectedImage.id}</span>
	</div>

	<div class="meta-item">
		<span class="label">Dimensions</span>
		<span class="value">
			{selectedImage.dimensions?.width} ×
			{selectedImage.dimensions?.height}
		</span>
	</div>

	<div class="meta-item">
		<span class="label">Source</span>
		<span class="value">{selectedImage.sourceType}</span>
	</div>

	<div class="meta-item">
		<span class="label">Hash</span>
		<span class="value hash"
			>{selectedImage?.hashes?.contentHash?.slice(0, 5).toUpperCase() ?? ''}</span
		>
	</div>

	<div class="meta-item">
		<span class="label">File</span>
		<span class="value filename"
			>{selectedImage?.label ?? selectedImage?.source?.uri?.split('/').pop() ?? '—'}</span
		>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center; /* center items vertically */
		gap: 1.75rem;
		padding: 0.5rem 1rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		background: #fafafa;

		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif;

		font-size: 0.78rem;
		line-height: 1; /* important */
		height: 40px; /* gives consistent vertical centering */
		box-sizing: border-box;
	}

	.meta-item {
		display: flex;
		align-items: center; /* vertical align label + value */
		gap: 0.35rem;
		white-space: nowrap;
	}

	.label {
		color: #9ca3af;
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		line-height: 1; /* remove vertical drift */
		display: flex;
		align-items: center;
	}

	.value {
		color: #111827;
		font-weight: 500;
		display: flex;
		align-items: center;
		line-height: 1;
	}

	.hash {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-weight: 600;
		letter-spacing: 0.03em;
	}

	.filename {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
