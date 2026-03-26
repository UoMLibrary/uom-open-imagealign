<script lang="ts">
	import { settingsState } from '$lib/core/settingsStore.svelte';

	export type NewFromFolderSelection = {
		importGroupingProfileId: string | null;
		annotationSchemaProfileId: string | null;
	};

	type Props = {
		open?: boolean;
		onClose?: () => void;
		onConfirm?: (selection: NewFromFolderSelection) => void | Promise<void>;
	};

	let { open = false, onClose, onConfirm }: Props = $props();

	let groupingProfiles = $derived(settingsState.importGroupingProfiles ?? []);
	let annotationProfiles = $derived(settingsState.annotationSchemaProfiles ?? []);

	let selection = $state<NewFromFolderSelection>({
		importGroupingProfileId: null,
		annotationSchemaProfileId: null
	});

	$effect(() => {
		if (!open) return;

		selection = {
			importGroupingProfileId: groupingProfiles[0]?.id ?? null,
			annotationSchemaProfileId: annotationProfiles[0]?.id ?? null
		};
	});

	let selectedGroupingProfile = $derived(
		selection.importGroupingProfileId
			? (groupingProfiles.find((profile) => profile.id === selection.importGroupingProfileId) ??
					null)
			: null
	);

	let selectedAnnotationProfile = $derived(
		selection.annotationSchemaProfileId
			? (annotationProfiles.find((profile) => profile.id === selection.annotationSchemaProfileId) ??
					null)
			: null
	);

	async function confirm() {
		await onConfirm?.(selection);
	}
</script>

{#if open}
	<div class="backdrop" role="presentation">
		<button
			class="backdrop-dismiss"
			type="button"
			aria-label="Close new project dialog"
			onclick={onClose}
		></button>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="New project from folder"
			tabindex="-1"
		>
			<div class="header">
				<h2>New from Folder</h2>
				<p>
					Choose how the folder should be grouped and which annotation data shape should be embedded
					into the new project.
				</p>
			</div>

			<div class="body">
				<label class="field">
					<span>Import grouping</span>
					<select bind:value={selection.importGroupingProfileId}>
						{#if groupingProfiles.length === 0}
							<option value="" disabled selected>No grouping profiles available</option>
						{:else}
							{#each groupingProfiles as profile (profile.id)}
								<option value={profile.id}>{profile.name}</option>
							{/each}
						{/if}
					</select>
					{#if selectedGroupingProfile?.description}
						<small>{selectedGroupingProfile.description}</small>
					{/if}
				</label>

				<label class="field">
					<span>Annotation data shape</span>
					<select bind:value={selection.annotationSchemaProfileId}>
						{#if annotationProfiles.length === 0}
							<option value="" disabled selected>No annotation schema profiles available</option>
						{:else}
							{#each annotationProfiles as profile (profile.id)}
								<option value={profile.id}>{profile.name}</option>
							{/each}
						{/if}
					</select>
					{#if selectedAnnotationProfile?.description}
						<small>{selectedAnnotationProfile.description}</small>
					{/if}
				</label>

				<div class="note">
					The grouping profile is only used during import. The annotation data shape is copied into
					the project so the annotation UI remains portable.
				</div>
			</div>

			<div class="footer">
				<button type="button" class="secondary" onclick={onClose}>Cancel</button>
				<button
					type="button"
					class="primary"
					disabled={!selection.importGroupingProfileId || !selection.annotationSchemaProfileId}
					onclick={confirm}
				>
					Choose Folder…
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
	}

	.backdrop-dismiss {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: rgba(15, 23, 42, 0.38);
		cursor: pointer;
	}

	.modal {
		position: relative;
		z-index: 1;
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

	.field select {
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

	.note {
		border-radius: 12px;
		padding: 0.85rem 0.95rem;
		background: rgba(248, 250, 252, 0.9);
		border: 1px solid rgba(15, 23, 42, 0.08);
		color: #475569;
		font-size: 0.8rem;
		line-height: 1.45;
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
