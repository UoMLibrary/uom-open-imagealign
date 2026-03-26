<script lang="ts">
	import { runPython } from '$lib/pyEngine';
	import type { PythonProfile } from '$lib/core/settingsStore.svelte';

	type Props = {
		title: string;
		intro: string;
		profiles?: PythonProfile[];
		createLabel: string;
		inputLabel: string;
		outputLabel: string;
		onCreate: () => string | null | undefined;
		onUpdate: (id: string, patch: Partial<PythonProfile>) => void;
		onDelete: (id: string) => void;
		onDuplicate: (id: string) => string | null | undefined;
	};

	let {
		title,
		intro,
		profiles = [],
		createLabel,
		inputLabel,
		outputLabel,
		onCreate,
		onUpdate,
		onDelete,
		onDuplicate
	}: Props = $props();

	let safeProfiles = $derived(profiles ?? []);

	let selectedId = $state<string | null>(null);
	let draftName = $state('');
	let draftDescription = $state('');
	let draftScript = $state('');
	let draftSampleInput = $state('{}');

	let testBusy = $state(false);
	let testError = $state('');
	let testOutput = $state('');

	function prettyJson(value: unknown): string {
		return JSON.stringify(value ?? {}, null, 2);
	}

	function loadProfile(profile: PythonProfile | null) {
		draftName = profile?.name ?? '';
		draftDescription = profile?.description ?? '';
		draftScript = profile?.script ?? '';
		draftSampleInput = prettyJson(profile?.sampleInput ?? {});
		testError = '';
		testOutput = profile?.sampleOutput ? prettyJson(profile.sampleOutput) : '';
	}

	let selectedProfile = $derived(
		selectedId ? (safeProfiles.find((profile) => profile.id === selectedId) ?? null) : null
	);

	$effect(() => {
		if (!safeProfiles.length) {
			selectedId = null;
			loadProfile(null);
			return;
		}

		if (!selectedId || !safeProfiles.some((profile) => profile.id === selectedId)) {
			selectedId = safeProfiles[0].id;
			return;
		}
	});

	$effect(() => {
		loadProfile(selectedProfile);
	});

	function createProfile() {
		const id = onCreate();
		if (id) selectedId = id;
	}

	function duplicateProfile() {
		if (!selectedId) return;
		const id = onDuplicate(selectedId);
		if (id) selectedId = id;
	}

	function deleteProfile() {
		if (!selectedId || !selectedProfile) return;

		const ok = window.confirm(`Delete "${selectedProfile.name}"?`);
		if (!ok) return;

		onDelete(selectedId);
	}

	function saveProfile() {
		if (!selectedId) return;

		let parsedInput: unknown;

		try {
			parsedInput = JSON.parse(draftSampleInput);
		} catch (error) {
			testError = error instanceof Error ? error.message : 'Sample input is not valid JSON.';
			return;
		}

		onUpdate(selectedId, {
			name: draftName.trim() || 'Untitled profile',
			description: draftDescription,
			script: draftScript,
			sampleInput: parsedInput
		});

		testError = '';
	}

	async function runTest() {
		testBusy = true;
		testError = '';

		try {
			const parsedInput = JSON.parse(draftSampleInput);
			const result = await runPython(draftScript, parsedInput);

			testOutput = JSON.stringify(result, null, 2);

			if (selectedId) {
				onUpdate(selectedId, {
					name: draftName.trim() || 'Untitled profile',
					description: draftDescription,
					script: draftScript,
					sampleInput: parsedInput,
					sampleOutput: result
				});
			}
		} catch (error) {
			testError = error instanceof Error ? error.message : 'Python test failed.';
		} finally {
			testBusy = false;
		}
	}
</script>

<div class="section-shell">
	<div class="section-header">
		<div>
			<h2>{title}</h2>
			<p>{intro}</p>
		</div>

		<button type="button" class="primary-button" onclick={createProfile}>{createLabel}</button>
	</div>

	<div class="section-layout">
		<aside class="profile-list-card">
			<div class="profile-list-header">
				<div class="profile-list-title">Saved profiles</div>
				<div class="profile-list-count">{safeProfiles.length}</div>
			</div>

			{#if safeProfiles.length === 0}
				<div class="empty-list">No profiles yet.</div>
			{:else}
				<div class="profile-list">
					{#each safeProfiles as profile (profile.id)}
						<button
							type="button"
							class="profile-item"
							class:selected={profile.id === selectedId}
							onclick={() => (selectedId = profile.id)}
						>
							<div class="profile-name">{profile.name || 'Untitled profile'}</div>
							{#if profile.description}
								<div class="profile-desc">{profile.description}</div>
							{/if}
							<div class="profile-meta">
								Updated {new Date(profile.updatedAt).toLocaleString('en-GB')}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</aside>

		<section class="editor-card">
			{#if selectedProfile}
				<div class="editor-actions">
					<button type="button" class="secondary-button" onclick={duplicateProfile}
						>Duplicate</button
					>
					<button type="button" class="danger-button" onclick={deleteProfile}>Delete</button>
					<div class="spacer"></div>
					<button type="button" class="secondary-button" onclick={saveProfile}>Save</button>
					<button type="button" class="primary-button" disabled={testBusy} onclick={runTest}>
						{#if testBusy}Running…{:else}Run test{/if}
					</button>
				</div>

				<div class="field-grid">
					<label class="field">
						<span>Name</span>
						<input bind:value={draftName} type="text" />
					</label>

					<label class="field">
						<span>Description</span>
						<input bind:value={draftDescription} type="text" />
					</label>
				</div>

				<label class="field">
					<span>Python script</span>
					<textarea bind:value={draftScript} rows="18" spellcheck="false"></textarea>
				</label>

				<div class="io-grid">
					<label class="field">
						<span>{inputLabel}</span>
						<textarea bind:value={draftSampleInput} rows="14" spellcheck="false"></textarea>
					</label>

					<label class="field">
						<span>{outputLabel}</span>
						<textarea value={testOutput} rows="14" readonly spellcheck="false"></textarea>
					</label>
				</div>

				{#if testError}
					<div class="error-panel">{testError}</div>
				{/if}
			{:else}
				<div class="empty-editor">Select or create a profile to begin editing.</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.section-shell {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
	}

	.section-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
	}

	.section-header h2 {
		margin: 0 0 0.3rem;
		font-size: 1.1rem;
		color: #111827;
	}

	.section-header p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: #64748b;
		max-width: 60rem;
	}

	.section-layout {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		gap: 1rem;
		min-height: 0;
	}

	.profile-list-card,
	.editor-card {
		min-height: 0;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
	}

	.profile-list-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.profile-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.95rem 1rem 0.85rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
	}

	.profile-list-title {
		font-size: 0.88rem;
		font-weight: 700;
		color: #111827;
	}

	.profile-list-count {
		min-width: 1.8rem;
		height: 1.8rem;
		padding: 0 0.55rem;
		border-radius: 999px;
		background: #eef2ff;
		color: #4338ca;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.76rem;
		font-weight: 700;
	}

	.profile-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.8rem;
		overflow: auto;
	}

	.profile-item {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #fff;
		border-radius: 14px;
		padding: 0.8rem 0.85rem;
		text-align: left;
		cursor: pointer;
	}

	.profile-item.selected {
		border-color: rgba(59, 130, 246, 0.3);
		background: rgba(239, 246, 255, 0.9);
	}

	.profile-name {
		font-size: 0.88rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.22rem;
	}

	.profile-desc {
		font-size: 0.8rem;
		color: #64748b;
		line-height: 1.45;
		margin-bottom: 0.4rem;
	}

	.profile-meta {
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.editor-card {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.editor-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.spacer {
		flex: 1 1 auto;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}

	.io-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}

	.field span {
		font-size: 0.79rem;
		font-weight: 700;
		color: #111827;
	}

	.field input,
	.field textarea {
		width: 100%;
		min-width: 0;
		padding: 0.75rem 0.85rem;
		border: 1px solid rgba(15, 23, 42, 0.12);
		border-radius: 12px;
		background: #fff;
		font: inherit;
		font-size: 0.84rem;
		color: #111827;
	}

	.field textarea {
		resize: vertical;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		line-height: 1.5;
	}

	.primary-button,
	.secondary-button,
	.danger-button {
		appearance: none;
		border-radius: 10px;
		padding: 0.65rem 0.9rem;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
	}

	.primary-button {
		border: 0;
		background: #2563eb;
		color: #fff;
	}

	.primary-button:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.secondary-button {
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		color: #111827;
	}

	.danger-button {
		border: 1px solid rgba(239, 68, 68, 0.18);
		background: rgba(254, 242, 242, 0.9);
		color: #b91c1c;
	}

	.error-panel,
	.empty-editor,
	.empty-list {
		border-radius: 14px;
		padding: 0.85rem 0.95rem;
		font-size: 0.84rem;
	}

	.error-panel {
		background: rgba(254, 242, 242, 0.95);
		border: 1px solid rgba(248, 113, 113, 0.22);
		color: #991b1b;
	}

	.empty-editor,
	.empty-list {
		background: rgba(248, 250, 252, 0.9);
		border: 1px dashed rgba(15, 23, 42, 0.14);
		color: #64748b;
	}

	@media (max-width: 1100px) {
		.section-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 800px) {
		.field-grid,
		.io-grid {
			grid-template-columns: 1fr;
		}

		.section-header {
			flex-direction: column;
		}
	}
</style>
