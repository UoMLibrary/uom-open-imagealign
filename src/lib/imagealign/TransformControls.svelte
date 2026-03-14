<script lang="ts">
	import type { AlignmentSpec } from '$lib/imagealign/alignmentWorkflow';

	type Props = {
		spec: AlignmentSpec;
		engineStatus: string;
		isRunning: boolean;
		canAlign: boolean;
		error: string | null;
		onRun?: () => void;
		onSpecChange?: (spec: AlignmentSpec) => void;
	};

	let { spec, engineStatus, isRunning, canAlign, error, onRun, onSpecChange }: Props = $props();

	function handleTypeChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value as AlignmentSpec['type'];
		onSpecChange?.({
			...spec,
			type: value
		});
	}

	function handlePhotometricChange(event: Event) {
		const checked = (event.currentTarget as HTMLInputElement).checked;
		onSpecChange?.({
			...spec,
			photometric: checked
		});
	}
</script>

<section class="panel">
	<h2>Transform</h2>

	<div class="controls">
		<label class="field">
			<span class="label">Model</span>
			<select value={spec.type} on:change={handleTypeChange} disabled={isRunning}>
				<option value="similarity">similarity</option>
				<option value="affine">affine</option>
				<option value="perspective">perspective</option>
				<option value="tps">tps</option>
			</select>
		</label>

		<label class="checkbox">
			<input
				type="checkbox"
				checked={spec.photometric}
				on:change={handlePhotometricChange}
				disabled={isRunning}
			/>
			<span>Photometric match</span>
		</label>
	</div>

	<p class="engine-status">{engineStatus}</p>

	<button class="primary" type="button" on:click={() => onRun?.()} disabled={!canAlign}>
		{isRunning ? 'Running alignment…' : 'Generate transform'}
	</button>

	{#if error}
		<p class="error">{error}</p>
	{/if}
</section>

<style>
	.panel {
		background: white;
		border: 1px solid #2163e8;
		border-radius: 12px;
		padding: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	h2 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: end;
		margin-bottom: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 220px;
	}

	.label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #374151;
	}

	select {
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid #d1d5db;
		background: white;
		font: inherit;
	}

	.checkbox {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0;
		color: #374151;
	}

	.engine-status {
		margin: 0 0 0.75rem 0;
		color: #4b5563;
		font-size: 0.95rem;
	}

	button {
		padding: 0.6rem 0.9rem;
		border-radius: 8px;
		border: 1px solid #ccc;
		font: inherit;
		cursor: pointer;
	}

	button:disabled,
	select:disabled,
	input:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.primary {
		background: #111827;
		color: white;
		border-color: #111827;
	}

	.error {
		margin: 0.75rem 0 0 0;
		color: #b91c1c;
	}
</style>
