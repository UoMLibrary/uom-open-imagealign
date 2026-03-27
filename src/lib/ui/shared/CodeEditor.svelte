<script lang="ts">
	import { onMount } from 'svelte';
	import { basicSetup } from 'codemirror';
	import { EditorView } from '@codemirror/view';
	import { Compartment, EditorState } from '@codemirror/state';
	import { python } from '@codemirror/lang-python';
	import { oneDark } from '@codemirror/theme-one-dark';

	type Props = {
		value?: string;
		readOnly?: boolean;
		ariaLabel?: string;
		language?: 'python' | 'plain';
	};

	let {
		value = $bindable(''),
		readOnly = false,
		ariaLabel = 'Code editor',
		language = 'plain'
	}: Props = $props();

	let host: HTMLDivElement | null = null;
	let view: EditorView | null = null;

	const languageCompartment = new Compartment();
	const readOnlyCompartment = new Compartment();

	const embeddedEditorTheme = EditorView.theme(
		{
			'&': {
				height: '100%',
				fontSize: '13px',
				backgroundColor: '#282c34'
			},
			'.cm-scroller': {
				overflow: 'auto',
				scrollBehavior: 'smooth',
				fontFamily:
					'"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
				lineHeight: '1.55'
			},
			'.cm-content': {
				padding: '12px 14px',
				minHeight: '100%'
			},
			'.cm-gutters': {
				backgroundColor: '#282c34',
				color: '#7f848e',
				border: 'none'
			},
			'.cm-activeLine': {
				backgroundColor: 'rgba(255, 255, 255, 0.04)'
			},
			'.cm-activeLineGutter': {
				backgroundColor: 'rgba(255, 255, 255, 0.04)'
			},
			'.cm-focused': {
				outline: 'none'
			},
			'.cm-selectionBackground, ::selection': {
				backgroundColor: 'rgba(79, 110, 247, 0.32)'
			},
			'.cm-cursor, .cm-dropCursor': {
				borderLeftColor: '#cdd6f4'
			}
		},
		{ dark: true }
	);

	function getLanguageExtension() {
		return language === 'python' ? python() : [];
	}

	onMount(() => {
		if (!host) return;

		view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					oneDark,
					embeddedEditorTheme,
					languageCompartment.of(getLanguageExtension()),
					readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
					EditorView.contentAttributes.of({
						'aria-label': ariaLabel,
						spellcheck: 'false'
					}),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							value = update.state.doc.toString();
						}
					})
				]
			})
		});

		return () => {
			view?.destroy();
			view = null;
		};
	});

	$effect(() => {
		if (!view) return;

		view.dispatch({
			effects: [
				languageCompartment.reconfigure(getLanguageExtension()),
				readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly))
			]
		});
	});

	$effect(() => {
		if (!view) return;

		const currentValue = view.state.doc.toString();
		if (currentValue === value) return;

		view.dispatch({
			changes: {
				from: 0,
				to: currentValue.length,
				insert: value
			}
		});
	});
</script>

<div class="editor-host" bind:this={host}></div>

<style>
	.editor-host {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
</style>
