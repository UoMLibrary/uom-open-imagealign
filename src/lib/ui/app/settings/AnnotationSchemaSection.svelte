<script lang="ts">
	import { settingsState, type AnnotationSchemaProfile } from '$lib/core/settingsStore.svelte';

	let selectedId = $state<string | null>(settingsState.annotationSchemaProfiles[0]?.id ?? null);

	let draftName = $state('');
	let draftDescription = $state('');
	let draftSchemaText = $state('{}');
	let draftDefaultDataText = $state('{}');

	let validationError = $state('');

	let selectedProfile = $derived(
		selectedId
			? (settingsState.annotationSchemaProfiles.find((profile) => profile.id === selectedId) ??
					null)
			: null
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
		const profiles = settingsState.annotationSchemaProfiles;

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
	<div class="section-header">
		<div>
			<h2>Annotation Data Shape</h2>
			<p>
				Create named JSON schema profiles for annotation data. These define the editable data
				attached to captured geometry.
			</p>
		</div>

		<button type="button" class="primary-button" onclick={createProfile}>New schema profile</button>
	</div>

	<div class="section-layout">
		<aside class="profile-list-card">
			<div class="profile-list-header">
				<div class="profile-list-title">Saved schemas</div>
				<div class="profile-list-count">{settingsState.annotationSchemaProfiles.length}</div>
			</div>

			{#if settingsState.annotationSchemaProfiles.length === 0}
				<div class="empty-list">No annotation schema profiles yet.</div>
			{:else}
				<div class="profile-list">
					{#each settingsState.annotationSchemaProfiles as profile (profile.id)}
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
		</aside>

		<section class="editor-stack">
			<section class="editor-card">
				{#if selectedProfile}
					<div class="editor-actions">
						<button type="button" class="secondary-button" onclick={duplicateProfile}
							>Duplicate</button
						>
						<button type="button" class="danger-button" onclick={deleteProfile}>Delete</button>
						<div class="spacer"></div>
						<button type="button" class="primary-button" onclick={saveProfile}>Save schema</button>
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
	.editor-card,
	.preview-card {
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

	.editor-stack {
		display: grid;
		grid-template-rows: auto auto;
		gap: 1rem;
		min-width: 0;
	}

	.editor-card,
	.preview-card {
		padding: 1rem;
	}

	.editor-card {
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

	.field-grid,
	.json-grid {
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

	.preview-card h3 {
		margin: 0 0 0.8rem;
		font-size: 1rem;
		color: #111827;
	}

	.preview-block + .preview-block {
		margin-top: 1rem;
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
		border-radius: 12px;
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
		border-radius: 12px;
		background: #0f172a;
		color: #e2e8f0;
		font-size: 0.78rem;
		overflow: auto;
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
	.empty-list,
	.empty-inline {
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
	.empty-list,
	.empty-inline {
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
		.json-grid {
			grid-template-columns: 1fr;
		}

		.section-header {
			flex-direction: column;
		}
	}
</style>
