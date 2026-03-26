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

<section class="transform-card">
	<div class="transform-top">
		<div class="title-block">
			<h2>Transform</h2>
			<p>{engineStatus}</p>
		</div>

		<button
			class="primary run-button"
			type="button"
			onclick={() => onRun?.()}
			disabled={!canAlign}
		>
			{isRunning ? 'Running…' : 'Generate'}
		</button>
	</div>

	<div class="transform-controls">
		<label class="field model-field">
			<span class="label">Model</span>
			<select value={spec.type} onchange={handleTypeChange} disabled={isRunning}>
				<option value="similarity">similarity</option>
				<option value="affine">affine</option>
				<option value="perspective">perspective</option>
				<option value="tps">tps</option>
			</select>
		</label>

		<label class="toggle">
			<input
				type="checkbox"
				checked={spec.photometric}
				onchange={handlePhotometricChange}
				disabled={isRunning}
			/>
			<span>Photometric match</span>
		</label>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{/if}
</section>

<style>
	.transform-card {
		width: 100%;
		background: rgba(255, 255, 255, 0.96);
		border: 1px solid rgba(148, 163, 184, 0.22);
		border-radius: 16px;
		padding: 0.9rem 1rem;
		box-shadow:
			0 8px 24px rgba(15, 23, 42, 0.05),
			0 1px 2px rgba(15, 23, 42, 0.04);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		box-sizing: border-box;
	}

	.transform-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.title-block h2 {
		margin: 0;
		font-size: 0.98rem;
		line-height: 1.1;
	}

	.title-block p {
		margin: 0.28rem 0 0;
		font-size: 0.84rem;
		color: #64748b;
		line-height: 1.35;
	}

	.transform-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.85rem 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 180px;
	}

	.model-field {
		flex: 0 0 200px;
	}

	.label {
		font-size: 0.78rem;
		font-weight: 700;
		color: #475569;
	}

	select {
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		border: 1px solid #d1d5db;
		background: white;
		font: inherit;
		color: #0f172a;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 40px;
		padding: 0.15rem 0;
		color: #334155;
		font-size: 0.9rem;
	}

	.run-button {
		flex: 0 0 auto;
		white-space: nowrap;
	}

	button {
		padding: 0.6rem 0.9rem;
		border-radius: 10px;
		border: 1px solid #dbe1e8;
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
		margin: 0;
		font-size: 0.84rem;
		color: #b91c1c;
	}

	@media (max-width: 700px) {
		.transform-top {
			flex-direction: column;
			align-items: flex-start;
		}

		.model-field {
			flex-basis: 100%;
			min-width: 0;
		}
	}
</style>
