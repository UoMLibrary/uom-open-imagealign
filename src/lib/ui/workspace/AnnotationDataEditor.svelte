<script lang="ts">
	import { tick } from 'svelte';

	type SchemaProperty = {
		type?: string;
		title?: string;
		description?: string;
		enum?: unknown[];
		default?: unknown;
		minimum?: number;
		maximum?: number;
		min?: number;
		max?: number;
		step?: number;
	};

	type Props = {
		annotationId?: string | null;
		schema?: Record<string, unknown> | null;
		value?: Record<string, unknown> | null;
		onChange?: ((nextValue: Record<string, unknown>) => void) | undefined;
	};

	let { annotationId = null, schema = null, value = null, onChange }: Props = $props();

	let root: HTMLDivElement | null = $state(null);
	let lastFocusedAnnotationId = $state<string | null>(null);

	function asObject(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	}

	let schemaObject = $derived(asObject(schema));
	let properties = $derived(
		Object.entries(asObject(schemaObject.properties)).map(([key, field]) => [
			key,
			asObject(field) as SchemaProperty
		] as const)
	);
	let required = $derived(
		Array.isArray(schemaObject.required)
			? schemaObject.required.filter((item): item is string => typeof item === 'string')
			: []
	);
	let currentValue = $derived(asObject(value));

	function updateField(key: string, next: unknown) {
		onChange?.({
			...currentValue,
			[key]: next
		});
	}

	function handleTextInput(key: string, event: Event) {
		updateField(key, (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
	}

	function handleNumberInput(key: string, event: Event) {
		const raw = (event.currentTarget as HTMLInputElement).value;
		updateField(key, raw === '' ? null : Number(raw));
	}

	function handleBooleanInput(key: string, event: Event) {
		updateField(key, (event.currentTarget as HTMLInputElement).checked);
	}

	function isRequired(key: string) {
		return required.includes(key);
	}

	function getLabel(key: string, field: SchemaProperty): string {
		return typeof field.title === 'string' && field.title.trim() ? field.title : key;
	}

	function getDescription(field: SchemaProperty): string | null {
		return typeof field.description === 'string' && field.description.trim()
			? field.description
			: null;
	}

	$effect(() => {
		if (!annotationId || annotationId === lastFocusedAnnotationId) return;

		lastFocusedAnnotationId = annotationId;

		void tick().then(() => {
			const field = root?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
				'input:not([type="checkbox"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
			);

			field?.focus();
			if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
				field.select?.();
			}
		});
	});
</script>

<div class="editor-shell" bind:this={root}>
	{#if !annotationId}
		<div class="empty-inline">Select an annotation to edit its data.</div>
	{:else if properties.length === 0}
		<div class="empty-inline">The active annotation schema has no fields yet.</div>
	{:else}
		<div class="editor-list">
			{#each properties as [key, field]}
				<label class="field">
					<div class="field-label-row">
						<span>{getLabel(key, field)}</span>
						{#if isRequired(key)}
							<span class="required-pill">Required</span>
						{/if}
					</div>

					{#if Array.isArray(field.enum) && field.enum.length > 0}
						<select
							value={currentValue[key] == null ? '' : String(currentValue[key])}
							onchange={(event) => updateField(key, (event.currentTarget as HTMLSelectElement).value)}
						>
							<option value="" disabled={isRequired(key)}>Select…</option>
							{#each field.enum as option}
								<option value={String(option)}>{String(option)}</option>
							{/each}
						</select>
					{:else if field.type === 'boolean'}
						<span class="checkbox-row">
							<input
								type="checkbox"
								checked={Boolean(currentValue[key])}
								onchange={(event) => handleBooleanInput(key, event)}
							/>
							<span>{getDescription(field) ?? 'Toggle value'}</span>
						</span>
					{:else if field.type === 'number' || field.type === 'integer'}
						<input
							type="number"
							value={typeof currentValue[key] === 'number' ? currentValue[key] : ''}
							min={field.minimum ?? field.min}
							max={field.maximum ?? field.max}
							step={field.type === 'integer' ? 1 : (field.step ?? 'any')}
							oninput={(event) => handleNumberInput(key, event)}
						/>
					{:else if key.toLowerCase().includes('note') || key.toLowerCase().includes('description')}
						<textarea
							rows="4"
							oninput={(event) => handleTextInput(key, event)}
						>{typeof currentValue[key] === 'string' ? currentValue[key] : ''}</textarea>
					{:else}
						<input
							type="text"
							value={typeof currentValue[key] === 'string' ? currentValue[key] : ''}
							oninput={(event) => handleTextInput(key, event)}
						/>
					{/if}

					{#if field.type !== 'boolean' && getDescription(field)}
						<small>{getDescription(field)}</small>
					{/if}
				</label>
			{/each}
		</div>
	{/if}
</div>

<style>
	.editor-shell {
		min-height: 0;
	}

	.editor-list {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: #334155;
	}

	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-weight: 700;
		color: #0f172a;
	}

	.field input,
	.field select,
	.field textarea {
		width: 100%;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.45);
		background: rgba(255, 255, 255, 0.98);
		padding: 0.62rem 0.72rem;
		font: inherit;
		color: #0f172a;
		box-sizing: border-box;
	}

	.field textarea {
		resize: vertical;
		min-height: 5.5rem;
	}

	.field input:focus,
	.field select:focus,
	.field textarea:focus {
		outline: none;
		border-color: rgba(37, 99, 235, 0.5);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
	}

	.field small {
		color: #64748b;
	}

	.checkbox-row {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		color: #334155;
	}

	.checkbox-row input {
		width: auto;
		margin: 0;
	}

	.required-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.12rem 0.42rem;
		border-radius: 999px;
		background: rgba(219, 234, 254, 0.95);
		color: #1d4ed8;
		font-size: 0.68rem;
		font-weight: 700;
	}

	.empty-inline {
		display: grid;
		place-items: center;
		text-align: center;
		color: #64748b;
		border: 1px dashed rgba(15, 23, 42, 0.16);
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.9);
		padding: 1rem;
		font-size: 0.82rem;
	}
</style>
