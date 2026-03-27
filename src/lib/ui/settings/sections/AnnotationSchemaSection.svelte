<script lang="ts">
	import WorkspaceSidebar from '$lib/ui/workspace/WorkspaceSidebar.svelte';
	import { settingsState, type AnnotationSchemaProfile } from '$lib/config/settingsStore.svelte';

	let selectedId = $state<string | null>(null);
	let profilesPanelOpen = $state(true);

	let draftName = $state('');
	let draftDescription = $state('');
	let draftSchemaText = $state('{}');
	let draftDefaultDataText = $state('{}');

	let validationError = $state('');

	let profiles = $derived(settingsState.annotationSchemaProfiles ?? []);

	let selectedProfile = $derived(
		selectedId ? (profiles.find((profile) => profile.id === selectedId) ?? null) : null
	);

	function prettyJson(value: unknown): string {
		return JSON.stringify(value ?? {}, null, 2);
	}

	function loadProfile(profile: AnnotationSchemaProfile | null) {
		draftName = profile?.name ?? '';
		draftDescription = profile?.description ?? '';
		draftSchemaText = prettyJson(profile?.schema ?? {});
		draftDefaultDataText = prettyJson(profile?.defaultData ?? {});
		validationError = '';
	}

	$effect(() => {
		if (!profiles.length) {
			selectedId = null;
			loadProfile(null);
			return;
		}

		if (!selectedId || !profiles.some((profile) => profile.id === selectedId)) {
			selectedId = profiles[0].id;
			return;
		}
	});

	$effect(() => {
		loadProfile(selectedProfile);
	});

	function createProfile() {
		const id = settingsState.createAnnotationSchemaProfile();
		if (id) selectedId = id;
	}

	function duplicateProfile() {
		if (!selectedId) return;
		const id = settingsState.duplicateAnnotationSchemaProfile(selectedId);
		if (id) selectedId = id;
	}

	function deleteProfile() {
		if (!selectedId || !selectedProfile) return;

		const ok = window.confirm(`Delete "${selectedProfile.name}"?`);
		if (!ok) return;

		settingsState.deleteAnnotationSchemaProfile(selectedId);
	}

	function parseDraft() {
		const schema = JSON.parse(draftSchemaText) as Record<string, unknown>;
		const defaultData = JSON.parse(draftDefaultDataText) as Record<string, unknown>;

		if (schema.type !== 'object') {
			throw new Error('Schema root must have `"type": "object"`.');
		}

		return { schema, defaultData };
	}

	function saveProfile() {
		if (!selectedId) return;

		try {
			const { schema, defaultData } = parseDraft();

			settingsState.updateAnnotationSchemaProfile(selectedId, {
				name: draftName.trim() || 'Untitled schema',
				description: draftDescription,
				schema,
				defaultData
			});

			validationError = '';
		} catch (error) {
			validationError = error instanceof Error ? error.message : 'Schema is not valid JSON.';
		}
	}

	let preview = $derived.by(() => {
		try {
			const { schema, defaultData } = parseDraft();

			const properties =
				schema &&
				typeof schema === 'object' &&
				schema.properties &&
				typeof schema.properties === 'object'
					? Object.entries(schema.properties as Record<string, any>)
					: [];

			const required = Array.isArray((schema as any).required)
				? ((schema as any).required as string[])
				: [];

			return {
				valid: true,
				properties,
				required,
				defaultData
			};
		} catch (error) {
			return {
				valid: false,
				error: error instanceof Error ? error.message : 'Schema preview failed.'
			};
		}
	});
</script>

<div class="section-shell">
	<div class="section-layout">
		<WorkspaceSidebar side="left" width={296} bind:open={profilesPanelOpen}>
			{#snippet header()}
				<div class="profile-sidebar-header">
					<div>
						<div class="profile-sidebar-title">Saved schemas</div>
						<div class="profile-sidebar-subtitle">{profiles.length} profiles</div>
					</div>

					<button type="button" class="primary-button compact-button" onclick={createProfile}>
						New
					</button>
				</div>
			{/snippet}

			<div class="profile-sidebar">
				{#if profiles.length === 0}
					<div class="empty-list">No annotation schema profiles yet.</div>
				{:else}
					<div class="profile-list">
						{#each profiles as profile (profile.id)}
							<button
								type="button"
								class="profile-item"
								class:selected={profile.id === selectedId}
								onclick={() => (selectedId = profile.id)}
							>
								<div class="profile-name">{profile.name || 'Untitled schema'}</div>
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

		<section class="editor-stack">
			<section class="editor-card">
				{#if selectedProfile}
					<div class="editor-toolbar">
						<div class="editor-leading">
							<div class="editor-context">Annotation Data Shape</div>
							<div class="editor-selected-name">{selectedProfile.name || 'Untitled schema'}</div>
						</div>

						<div class="editor-actions">
							<button type="button" class="secondary-button" onclick={duplicateProfile}
								>Duplicate</button
							>
							<button type="button" class="danger-button" onclick={deleteProfile}>Delete</button>
							<button type="button" class="primary-button" onclick={saveProfile}>Save schema</button>
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

					<div class="json-grid">
						<label class="field">
							<span>JSON schema</span>
							<textarea bind:value={draftSchemaText} rows="18" spellcheck="false"></textarea>
						</label>

						<label class="field">
							<span>Default annotation data</span>
							<textarea bind:value={draftDefaultDataText} rows="18" spellcheck="false"></textarea>
						</label>
					</div>

					{#if validationError}
						<div class="error-panel">{validationError}</div>
					{/if}
				{:else}
					<div class="empty-editor">Select or create a schema profile to begin editing.</div>
				{/if}
			</section>

			<section class="preview-card">
				<h3>Preview</h3>

				{#if preview.valid}
					<div class="preview-block">
						<div class="preview-label">Fields</div>

						{#if preview.properties.length === 0}
							<div class="empty-inline">No properties defined yet.</div>
						{:else}
							<div class="field-preview-list">
								{#each preview.properties as [key, value]}
									<div class="field-preview-item">
										<div class="field-preview-top">
											<strong>{key}</strong>
											<span>{value?.type ?? 'unknown'}</span>
										</div>

										<div class="field-preview-meta">
											{value?.title ?? 'Untitled'}
											{#if preview.required.includes(key)}
												· required
											{/if}
										</div>

										{#if Array.isArray(value?.enum) && value.enum.length > 0}
											<div class="enum-list">{value.enum.join(', ')}</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<div class="preview-block">
						<div class="preview-label">Default data</div>
						<pre>{JSON.stringify(preview.defaultData, null, 2)}</pre>
					</div>
				{:else}
					<div class="error-panel">{preview.error}</div>
				{/if}
			</section>
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

	.profile-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: #111827;
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

	.editor-stack {
		display: grid;
		grid-template-rows: auto auto;
		gap: 0;
		min-width: 0;
		flex: 1 1 auto;
		background: #fff;
		overflow: auto;
	}

	.editor-card {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
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

	.field-grid,
	.json-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		padding: 0.75rem 0.9rem;
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
		padding: 0.72rem 0.85rem;
		border: 1px solid rgba(15, 23, 42, 0.12);
		border-radius: 10px;
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

	.preview-card {
		padding: 0 0.9rem 0.9rem;
	}

	.preview-card h3 {
		margin: 0;
		padding: 0.8rem 0 0;
		font-size: 1rem;
		color: #111827;
	}

	.preview-block + .preview-block {
		margin-top: 0.9rem;
	}

	.preview-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: #475569;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field-preview-list {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.field-preview-item {
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 10px;
		padding: 0.75rem 0.85rem;
		background: rgba(248, 250, 252, 0.8);
	}

	.field-preview-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.84rem;
		color: #111827;
	}

	.field-preview-top span {
		color: #64748b;
		font-size: 0.76rem;
	}

	.field-preview-meta,
	.enum-list {
		margin-top: 0.3rem;
		font-size: 0.78rem;
		color: #64748b;
		line-height: 1.4;
	}

	pre {
		margin: 0;
		padding: 0.85rem 0.95rem;
		border-radius: 10px;
		background: #0f172a;
		color: #e2e8f0;
		font-size: 0.78rem;
		overflow: auto;
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

	.compact-button {
		padding: 0.45rem 0.72rem;
		font-size: 0.78rem;
	}

	.error-panel,
	.empty-editor,
	.empty-list,
	.empty-inline {
		padding: 0.85rem 0.95rem;
		font-size: 0.84rem;
	}

	.error-panel {
		margin: 0 0.9rem 0.9rem;
		background: rgba(254, 242, 242, 0.95);
		border: 1px solid rgba(248, 113, 113, 0.22);
		color: #991b1b;
		border-radius: 10px;
	}

	.empty-editor,
	.empty-list,
	.empty-inline {
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
		.json-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 800px) {
		.field-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
