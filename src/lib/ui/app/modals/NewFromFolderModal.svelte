<script lang="ts">
	import { settingsState, type ProjectProfileSelection } from '$lib/core/settingsStore.svelte';

	type Props = {
		open?: boolean;
		onClose?: () => void;
		onConfirm?: (selection: ProjectProfileSelection) => void | Promise<void>;
	};

	let { open = false, onClose, onConfirm }: Props = $props();

	let selection = $state<ProjectProfileSelection>({
		...settingsState.defaultProfileSelection
	});

	$effect(() => {
		if (open) {
			selection = { ...settingsState.defaultProfileSelection };
		}
	});

	async function confirm() {
		await onConfirm?.(selection);
	}
</script>

{#if open}
	<div class="backdrop" role="presentation" onclick={onClose}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="New project from folder"
			onclick={(event) => event.stopPropagation()}
		>
			<div class="header">
				<h2>New from Folder</h2>
				<p>Choose which saved profiles this project should use.</p>
			</div>

			<div class="body">
				<label class="field">
					<span>Import grouping</span>
					<select bind:value={selection.importGroupingProfileId}>
						{#each settingsState.importGroupingProfiles as profile (profile.id)}
							<option value={profile.id}>{profile.name}</option>
						{/each}
					</select>
				</label>

				<label class="field">
					<span>Annotation data shape</span>
					<select bind:value={selection.annotationSchemaProfileId}>
						{#each settingsState.annotationSchemaProfiles as profile (profile.id)}
							<option value={profile.id}>{profile.name}</option>
						{/each}
					</select>
				</label>

				<label class="field">
					<span>Export shape</span>
					<select bind:value={selection.exportProfileId}>
						{#each settingsState.exportProfiles as profile (profile.id)}
							<option value={profile.id}>{profile.name}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="footer">
				<button type="button" class="secondary" onclick={onClose}>Cancel</button>
				<button type="button" class="primary" onclick={confirm}>Choose Folder…</button>
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
	}

	.body {
		display: grid;
		gap: 0.9rem;
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

	.field select {
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		font: inherit;
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

	.secondary {
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		color: #111827;
	}
</style>
