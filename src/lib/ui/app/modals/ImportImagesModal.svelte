<script lang="ts">
	import Modal from '$lib/ui/shared/Modal.svelte';
	import { dismissImageImportModal, imageImportUI } from '$lib/core/projectStore';

	$: state = $imageImportUI;
	$: title = state.ingesting ? 'Importing images' : 'Import results';
</script>

<Modal open={state.open} {title} on:close={dismissImageImportModal}>
	<div class="stack">
		{#if state.ingesting}
			<div class="status-row">
				<div class="spinner" aria-hidden="true"></div>
				<div>
					<div class="headline">Processing images…</div>
					<div class="muted">
						{state.completed} of {state.total} complete
					</div>
				</div>
			</div>
		{:else}
			<div class="summary">
				<div class="headline">Import finished</div>
				<div class="muted">
					Added {state.added} image{state.added === 1 ? '' : 's'}
					{#if state.failed > 0}
						• {state.failed} failed
					{/if}
				</div>
			</div>
		{/if}

		<progress max="100" value={state.progress}></progress>

		<div class="muted">{state.progress}%</div>

		{#if state.currentFileName}
			<div class="panel">
				<div class="label">Current file</div>
				<div>{state.currentFileName}</div>

				{#if state.currentStructuralPath && state.currentStructuralPath !== state.currentFileName}
					<div class="path">{state.currentStructuralPath}</div>
				{/if}
			</div>
		{/if}

		<div class="panel compact">
			<div><strong>Total:</strong> {state.total}</div>
			<div><strong>Processed:</strong> {state.completed}</div>
			<div><strong>Added:</strong> {state.added}</div>
			<div><strong>Failed:</strong> {state.failed}</div>
		</div>

		{#if state.errors.length > 0}
			<div class="panel">
				<div class="label">Problems</div>
				<ul>
					{#each state.errors as error}
						<li>
							<strong>{error.fileName}</strong>: {error.message}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</Modal>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.headline {
		font-weight: 650;
		color: #111827;
	}

	.muted {
		color: #6b7280;
		font-size: 0.82rem;
	}

	.panel {
		padding: 0.75rem 0.85rem;
		background: #f9fafb;
		border: 1px solid rgba(0, 0, 0, 0.07);
		border-radius: 10px;
	}

	.panel.compact {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.45rem 0.9rem;
	}

	.label {
		margin-bottom: 0.35rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280;
	}

	.path {
		margin-top: 0.25rem;
		color: #6b7280;
		font-size: 0.78rem;
		word-break: break-word;
	}

	progress {
		width: 100%;
		height: 10px;
	}

	ul {
		margin: 0;
		padding-left: 1.1rem;
	}

	li + li {
		margin-top: 0.35rem;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid #d1d5db;
		border-top-color: #374151;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex: 0 0 auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
