<script lang="ts">
	import { settingsState } from '$lib/core/settingsStore.svelte';

	export type ExportSelection = {
		exportProfileId: string | null;
		filename: string;
	};

	type Props = {
		open?: boolean;
		defaultFilename?: string;
		onClose?: () => void;
		onConfirm?: (selection: ExportSelection) => void | Promise<void>;
	};

	let { open = false, defaultFilename = 'export.json', onClose, onConfirm }: Props = $props();

	let exportProfiles = $derived(settingsState.exportProfiles ?? []);

	let selection = $state<ExportSelection>({
		exportProfileId: null,
		filename: ''
	});

	$effect(() => {
		if (!open) return;

		selection = {
			exportProfileId: exportProfiles[0]?.id ?? null,
			filename: defaultFilename
		};
	});

	let selectedExportProfile = $derived(
		selection.exportProfileId
			? (exportProfiles.find((profile) => profile.id === selection.exportProfileId) ?? null)
			: null
	);

	async function confirm() {
		await onConfirm?.({
			exportProfileId: selection.exportProfileId,
			filename: selection.filename.trim() || defaultFilename
		});
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={onClose}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Export project"
			onclick={(event) => event.stopPropagation()}
		>
			<div class="header">
				<h2>Export</h2>
				<p>Choose an export function and the suggested output filename.</p>
			</div>

			<div class="body">
				<label class="field">
					<span>Export function</span>
					<select bind:value={selection.exportProfileId}>
						{#if exportProfiles.length === 0}
							<option value="" disabled selected>No export profiles available</option>
						{:else}
							{#each exportProfiles as profile (profile.id)}
								<option value={profile.id}>{profile.name}</option>
							{/each}
						{/if}
					</select>
					{#if selectedExportProfile?.description}
						<small>{selectedExportProfile.description}</small>
					{/if}
				</label>

				<label class="field">
					<span>Suggested filename</span>
					<input bind:value={selection.filename} type="text" />
					<small>The save dialog will still let you change the final name and location.</small>
				</label>
			</div>

			<div class="footer">
				<button type="button" class="secondary" onclick={onClose}>Cancel</button>
				<button
					type="button"
					class="primary"
					disabled={!selection.exportProfileId}
					onclick={confirm}
				>
					Export…
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.38);
	}

	.modal {
		width: min(42rem, 100%);
		border-radius: 18px;
		background: #fff;
		border: 1px solid rgba(15, 23, 42, 0.08);
		box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
	}

	.header,
	.body,
	.footer {
		padding: 1rem 1.1rem;
	}

	.header {
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
	}

	.header h2 {
		margin: 0 0 0.3rem;
		font-size: 1.1rem;
	}

	.header p {
		margin: 0;
		color: #64748b;
		font-size: 0.88rem;
		line-height: 1.45;
	}

	.body {
		display: grid;
		gap: 0.95rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field span {
		font-size: 0.8rem;
		font-weight: 700;
		color: #111827;
	}

	.field select,
	.field input {
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		font: inherit;
	}

	.field small {
		font-size: 0.76rem;
		line-height: 1.4;
		color: #64748b;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.65rem;
		border-top: 1px solid rgba(15, 23, 42, 0.08);
	}

	.primary,
	.secondary {
		appearance: none;
		border-radius: 10px;
		padding: 0.65rem 0.95rem;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
	}

	.primary {
		border: 0;
		background: #2563eb;
		color: #fff;
	}

	.primary:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.secondary {
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		color: #111827;
	}
</style>
