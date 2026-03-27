<script lang="ts">
	import { runPython } from '$lib/python/runPython';
	import type { PythonProfile } from '$lib/config/settingsStore.svelte';
	import CodeEditor from '$lib/ui/shared/CodeEditor.svelte';
	import WorkspaceSidebar from '$lib/ui/workspace/WorkspaceSidebar.svelte';

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
	let profilesPanelOpen = $state(true);
	let draftName = $state('');
	let draftDescription = $state('');
	let draftScript = $state('');
	let draftSampleInput = $state('{}');
	let activeDataTab = $state<'input' | 'output'>('input');

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
		activeDataTab = 'input';
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
			activeDataTab = 'output';

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
	<div class="section-layout">
		<WorkspaceSidebar side="left" width={296} bind:open={profilesPanelOpen}>
			{#snippet header()}
				<div class="profile-sidebar-header">
					<div>
						<div class="profile-sidebar-title">Saved profiles</div>
						<div class="profile-sidebar-subtitle">{safeProfiles.length} for {title}</div>
					</div>

					<button type="button" class="primary-button compact-button" onclick={createProfile}>
						New
					</button>
				</div>
			{/snippet}

			<div class="profile-sidebar">
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
								<div class="profile-title-row">
									<div class="profile-name">{profile.name || 'Untitled profile'}</div>
									<div class="profile-list-count">{profile.sampleOutput ? 'Out' : 'New'}</div>
								</div>
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
			</div>
		</WorkspaceSidebar>

		<section class="editor-card">
			{#if selectedProfile}
				<div class="editor-toolbar">
					<div class="editor-leading">
						<div class="editor-context">{title}</div>
						<div class="editor-selected-name">{selectedProfile.name || 'Untitled profile'}</div>
					</div>

					<div class="editor-actions">
						<button type="button" class="secondary-button" onclick={duplicateProfile}
							>Duplicate</button
						>
						<button type="button" class="danger-button" onclick={deleteProfile}>Delete</button>
						<button type="button" class="secondary-button" onclick={saveProfile}>Save</button>
						<button type="button" class="primary-button" disabled={testBusy} onclick={runTest}>
							{#if testBusy}Running…{:else}Run test{/if}
						</button>
					</div>
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

				<div class="editor-workbench">
					<section class="script-panel">
						<div class="script-panel-toolbar">
							<div class="script-panel-label">Python script</div>
						</div>

						<div class="script-editor-field">
							<CodeEditor bind:value={draftScript} language="python" ariaLabel="Python script" />
						</div>
					</section>

					<section class="data-panel">
						<div class="data-panel-toolbar">
							<div class="panel-tabs" role="tablist" aria-label={`${title} test data`}>
								<button
									type="button"
									role="tab"
									class="panel-tab"
									class:selected={activeDataTab === 'input'}
									aria-selected={activeDataTab === 'input'}
									onclick={() => (activeDataTab = 'input')}
								>
									{inputLabel}
								</button>
								<button
									type="button"
									role="tab"
									class="panel-tab"
									class:selected={activeDataTab === 'output'}
									aria-selected={activeDataTab === 'output'}
									onclick={() => (activeDataTab = 'output')}
								>
									{outputLabel}
								</button>
							</div>

							<div class="tab-actions">
								<button
									type="button"
									class="primary-button compact-button"
									disabled={testBusy}
									onclick={runTest}
								>
									{#if testBusy}Running…{:else}Run{/if}
								</button>
							</div>
						</div>

						{#if activeDataTab === 'input'}
							<label class="data-editor-field">
								<textarea bind:value={draftSampleInput} rows="24" spellcheck="false"></textarea>
							</label>
						{:else}
							<label class="data-editor-field">
								<textarea value={testOutput} rows="24" readonly spellcheck="false"></textarea>
							</label>
						{/if}
					</section>
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
		height: 100%;
		min-height: 0;
	}

	.section-layout {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		overflow: hidden;
	}

	.profile-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: #f8fafc;
	}

	.profile-sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.8rem 0.9rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
	}

	.profile-sidebar-title {
		font-size: 0.84rem;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #0f172a;
	}

	.profile-sidebar-subtitle {
		margin-top: 0.2rem;
		font-size: 0.75rem;
		color: #64748b;
	}

	.profile-list,
	.editor-card {
		min-height: 0;
	}

	.profile-list {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		overflow: auto;
		background: #ffffff;
	}

	.profile-item {
		appearance: none;
		border: 0;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: transparent;
		padding: 0.8rem 0.9rem;
		text-align: left;
		cursor: pointer;
		transition: background-color 140ms ease;
	}

	.profile-item:hover {
		background: rgba(248, 250, 252, 0.72);
	}

	.profile-item.selected {
		background: rgba(239, 246, 255, 0.72);
	}

	.profile-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
	}

	.profile-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: #111827;
		min-width: 0;
	}

	.profile-desc {
		font-size: 0.78rem;
		color: #64748b;
		line-height: 1.45;
		margin: 0.28rem 0 0.42rem;
	}

	.profile-meta {
		font-size: 0.72rem;
		color: #94a3b8;
	}

	.editor-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1 1 auto;
		background: #ffffff;
		overflow: hidden;
	}

	.editor-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.75rem 0.9rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.98);
	}

	.editor-leading {
		min-width: 0;
	}

	.editor-context {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #64748b;
	}

	.editor-selected-name {
		font-size: 0.96rem;
		font-weight: 700;
		color: #111827;
		margin-top: 0.15rem;
	}

	.editor-actions {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		padding: 0.75rem 0.9rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		background: #ffffff;
	}

	.editor-workbench {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.8fr);
		flex: 1 1 auto;
		min-height: 0;
		background: #e5e7eb;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.field span {
		font-size: 0.79rem;
		font-weight: 700;
		color: #111827;
	}

	.field input {
		width: 100%;
		min-width: 0;
		padding: 0.72rem 0.85rem;
		border: 1px solid rgba(15, 23, 42, 0.12);
		border-radius: 10px;
		background: #fff;
		font: inherit;
		font-size: 0.84rem;
		color: #111827;
	}

	.script-panel {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: #2b3038;
		color: #e5e7eb;
	}

	.data-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: #ffffff;
	}

	.script-panel-toolbar,
	.data-panel-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.75rem 0;
		flex-wrap: wrap;
	}

	.script-panel-label {
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.75);
	}

	.script-editor-field,
	.data-editor-field {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
		min-width: 0;
		padding: 0.7rem 0.75rem 0.75rem;
	}

	.script-editor-field {
		overflow: hidden;
	}

	.panel-tabs {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
	}

	.panel-tab {
		appearance: none;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		padding: 0.55rem 0.8rem 0.6rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
	}

	.panel-tab:hover {
		color: #111827;
	}

	.panel-tab.selected {
		border-bottom-color: #4f6ef7;
		color: #3153f4;
	}

	.tab-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.data-editor-field textarea {
		width: 100%;
		height: 100%;
		min-height: 0;
		min-width: 0;
		resize: none;
		border: 1px solid transparent;
		border-radius: 0;
		padding: 0.25rem 0.35rem;
		background: transparent;
		color: inherit;
		font-size: 0.88rem;
		line-height: 1.55;
	}

	.data-editor-field textarea {
		padding: 0.75rem 0.85rem;
		background: #ffffff;
		color: #111827;
	}

	.data-editor-field textarea:focus {
		outline: none;
	}

	.primary-button,
	.secondary-button,
	.danger-button {
		appearance: none;
		border-radius: 8px;
		padding: 0.6rem 0.88rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
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

	.compact-button {
		padding: 0.45rem 0.72rem;
		font-size: 0.78rem;
	}

	.danger-button {
		border: 1px solid rgba(239, 68, 68, 0.18);
		background: rgba(254, 242, 242, 0.9);
		color: #b91c1c;
	}

	.error-panel,
	.empty-editor,
	.empty-list {
		padding: 0.85rem 0.95rem;
		font-size: 0.84rem;
	}

	.error-panel {
		margin: 0.75rem 0.9rem;
		background: rgba(254, 242, 242, 0.98);
		border: 1px solid rgba(248, 113, 113, 0.2);
		color: #991b1b;
		border-radius: 10px;
	}

	.empty-editor,
	.empty-list {
		background: rgba(248, 250, 252, 0.9);
		border: 1px dashed rgba(15, 23, 42, 0.14);
		color: #64748b;
	}

	.empty-editor {
		margin: 1rem;
		border-radius: 10px;
	}

	.empty-list {
		margin: 0.8rem;
		border-radius: 10px;
	}

	@media (max-width: 1100px) {
		.editor-workbench {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 800px) {
		.field-grid {
			grid-template-columns: 1fr;
		}

		.editor-toolbar,
		.field-grid {
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}
	}
</style>
