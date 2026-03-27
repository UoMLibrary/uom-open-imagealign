<script lang="ts">
	import { appConfigState } from '$lib/config/appConfigStore.svelte';

	type Props = {
		onReset?: () => void;
	};

	let { onReset }: Props = $props();

	let config = $derived(appConfigState.snapshot);

	function updateShortcut(field: 'leftPanelToggleKey' | 'rightPanelToggleKey', value: string) {
		appConfigState.update({ [field]: value.slice(0, 1) });
	}

	function updateRefreshInterval(value: string) {
		const parsed = Number.parseInt(value, 10);
		appConfigState.update({ storageRefreshIntervalSeconds: Number.isNaN(parsed) ? 15 : parsed });
	}
</script>

<div class="config-section">
	<div class="section-card">
		<div class="section-header">
			<div>
				<h2>Application Config</h2>
				<p>
					Set lightweight browser-side preferences that shared UI components can use throughout the
					app.
				</p>
			</div>

			{#if onReset}
				<button type="button" class="ghost-button" onclick={onReset}>Reset to defaults</button>
			{/if}
		</div>

		<div class="field-grid">
			<label class="field">
				<span>Left panel shortcut</span>
				<input
					type="text"
					maxlength="1"
					value={config.leftPanelToggleKey}
					oninput={(event) =>
						updateShortcut('leftPanelToggleKey', (event.currentTarget as HTMLInputElement).value)}
				/>
				<small>Used by the shared side panel component to open and close the left panel.</small>
			</label>

			<label class="field">
				<span>Right panel shortcut</span>
				<input
					type="text"
					maxlength="1"
					value={config.rightPanelToggleKey}
					oninput={(event) =>
						updateShortcut('rightPanelToggleKey', (event.currentTarget as HTMLInputElement).value)}
				/>
				<small>Reserved for any right-side panel instances that use the same shared keyboard handling.</small>
			</label>

			<label class="field">
				<span>Storage refresh interval</span>
				<input
					type="number"
					min="5"
					max="120"
					step="1"
					value={config.storageRefreshIntervalSeconds}
					oninput={(event) =>
						updateRefreshInterval((event.currentTarget as HTMLInputElement).value)}
				/>
				<small>Controls how often the storage tab refreshes browser usage estimates automatically.</small>
			</label>

			<label class="field checkbox-field">
				<input
					type="checkbox"
					checked={config.confirmBeforeClearingStorage}
					onchange={(event) =>
						appConfigState.update({
							confirmBeforeClearingStorage: (event.currentTarget as HTMLInputElement).checked
						})}
				/>
				<div>
					<span>Confirm destructive storage actions</span>
					<small>Ask before clearing IndexedDB cache and other saved browser-side app data.</small>
				</div>
			</label>
		</div>
	</div>
</div>

<style>
	.config-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-card {
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
		padding: 1.1rem;
	}

	.section-header {
		margin-bottom: 1rem;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.section-header h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
		color: #111827;
	}

	.section-header p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: #64748b;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.9rem;
		border-radius: 14px;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.92));
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.field span {
		font-size: 0.88rem;
		font-weight: 700;
		color: #0f172a;
	}

	.field small {
		font-size: 0.77rem;
		line-height: 1.45;
		color: #64748b;
	}

	input[type='text'],
	input[type='number'] {
		border: 1px solid rgba(148, 163, 184, 0.4);
		border-radius: 10px;
		padding: 0.65rem 0.75rem;
		font: inherit;
		background: #fff;
		color: #111827;
	}

	.ghost-button {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		color: #111827;
		padding: 0.65rem 0.9rem;
		border-radius: 10px;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
	}

	.ghost-button:hover {
		background: #f8fafc;
	}

	.checkbox-field {
		flex-direction: row;
		align-items: flex-start;
	}

	.checkbox-field input {
		margin-top: 0.2rem;
	}

	@media (max-width: 800px) {
		.field-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
