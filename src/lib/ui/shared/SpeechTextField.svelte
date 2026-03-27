<script lang="ts">
	import { onDestroy, tick } from 'svelte';

	type SpeechRecognitionAlternativeLike = {
		transcript: string;
	};

	type SpeechRecognitionResultLike = {
		isFinal: boolean;
		0: SpeechRecognitionAlternativeLike;
	};

	type SpeechRecognitionEventLike = {
		resultIndex: number;
		results: ArrayLike<SpeechRecognitionResultLike>;
	};

	type SpeechRecognitionLike = {
		continuous: boolean;
		interimResults: boolean;
		lang: string;
		onstart: (() => void) | null;
		onaudiostart: (() => void) | null;
		onsoundstart: (() => void) | null;
		onspeechstart: (() => void) | null;
		onspeechend: (() => void) | null;
		onsoundend: (() => void) | null;
		onaudioend: (() => void) | null;
		onnomatch: ((event?: unknown) => void) | null;
		onresult: ((event: SpeechRecognitionEventLike) => void) | null;
		onend: (() => void) | null;
		onerror: ((event?: unknown) => void) | null;
		start: () => void;
		stop: () => void;
	};

	type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

	type Props = {
		id?: string;
		label: string;
		value?: string;
		multiline?: boolean;
		rows?: number;
		placeholder?: string;
		disabled?: boolean;
		readonly?: boolean;
		monospace?: boolean;
		onChange?: ((nextValue: string) => void) | undefined;
	};

	let {
		id,
		label,
		value = '',
		multiline = false,
		rows = 4,
		placeholder = '',
		disabled = false,
		readonly = false,
		monospace = false,
		onChange
	}: Props = $props();

	let root: HTMLDivElement | null = $state(null);
	let field: HTMLInputElement | HTMLTextAreaElement | null = $state(null);
	let recognition: SpeechRecognitionLike | null = $state(null);
	let listening = $state(false);
	let supported = $state(false);
	let localValue = $state('');
	let lastPropValue = $state<string | undefined>(undefined);
	let ignoreBlurUntil = 0;
	let dictationBaseValue = $state('');
	let dictatedFinalText = $state('');
	let dictatedInterimText = $state('');

	function capitalizeFirst(text: string) {
		if (!text) return text;
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function normaliseSpacing(base: string, addition: string) {
		if (!addition.trim()) return base;
		if (!base.trim()) return addition.trim();
		return /\s$/.test(base) ? `${base}${addition.trim()}` : `${base} ${addition.trim()}`;
	}

	function formatCommittedTranscript(transcript: string) {
		const cleaned = capitalizeFirst(transcript.trim());
		if (!cleaned) return '';
		return `${cleaned.replace(/[.!?\s]+$/, '')}. `;
	}

	function ensureSentenceEnding(text: string) {
		const trimmed = text.replace(/\s+$/, '');
		if (!trimmed) return '';
		return `${trimmed.replace(/[.!?]+$/, '')}. `;
	}

	function formatLiveTranscript(finalText: string, interimText: string) {
		return capitalizeFirst(`${finalText} ${interimText}`.trim());
	}

	function appendText(base: string, insert: string) {
		return normaliseSpacing(base, insert);
	}

	function captureSelection() {
		return;
	}

	async function placeCaret(position: number) {
		await tick();
		if (!field || document.activeElement !== field) return;
		field.setSelectionRange?.(position, position);
	}

	function setValue(nextValue: string) {
		localValue = nextValue;
		onChange?.(nextValue);
	}

	function clearDictationState() {
		dictationBaseValue = '';
		dictatedFinalText = '';
		dictatedInterimText = '';
	}

	function getDictationDisplayValue() {
		const liveTranscript = formatLiveTranscript(dictatedFinalText, dictatedInterimText);
		if (!liveTranscript) return dictationBaseValue;
		return appendText(dictationBaseValue, liveTranscript);
	}

	function commitDictationFromDisplay() {
		if (!dictatedFinalText.trim() && !dictatedInterimText.trim()) return;
		const displayedValue = field?.value ?? getDictationDisplayValue();
		const nextValue = ensureSentenceEnding(displayedValue);
		setValue(nextValue);
		void placeCaret(nextValue.length);
		clearDictationState();
	}

	function stopListening() {
		if (!recognition || !listening) return;
		commitDictationFromDisplay();
		clearDictationState();
		recognition.stop();
		listening = false;
	}

	function startListening() {
		if (!recognition || disabled || readonly) return;
		try {
			ignoreBlurUntil = performance.now() + 800;
			dictationBaseValue = localValue;
			dictatedFinalText = '';
			dictatedInterimText = '';
			recognition.start();
			listening = true;
		} catch {
			listening = false;
		}
	}

	function toggleListening() {
		if (!supported || disabled || readonly) return;
		if (listening) stopListening();
		else startListening();
	}

	function handleSpeechResult(event: SpeechRecognitionEventLike) {
		let interim = '';
		let final = '';

		for (let index = 0; index < event.results.length; index += 1) {
			const text = event.results[index]?.[0]?.transcript ?? '';
			if (!text) continue;

			if (event.results[index].isFinal) {
				final += text;
			} else {
				interim += text;
			}
		}

		dictatedFinalText = final.trim();
		dictatedInterimText = interim.trim();
	}

	function handleInput(event: Event) {
		const nextValue = (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
		setValue(nextValue);
	}

	function handleButtonClick(event: MouseEvent) {
		event.stopPropagation();
		toggleListening();
	}

	function handleContainerFocusOut(event: FocusEvent) {
		const nextTarget = event.relatedTarget as Node | null;
		if (nextTarget && root?.contains(nextTarget)) return;

		queueMicrotask(() => {
			if (!listening) return;
			if (performance.now() < ignoreBlurUntil) {
				return;
			}

			const active = document.activeElement;
			if (active && root?.contains(active)) return;
			if (!document.hasFocus()) {
				return;
			}

			stopListening();
		});
	}

	$effect(() => {
		if (lastPropValue === undefined) {
			lastPropValue = value;
			localValue = value;
			return;
		}

		if (value === lastPropValue) return;
		lastPropValue = value;

		// While the user is actively interacting with the field or recording,
		// keep the local field value authoritative to avoid stale parent props
		// wiping in-progress or just-committed dictation.
		if (listening) return;
		if (root && document.activeElement && root.contains(document.activeElement)) return;

		localValue = value;
	});

	$effect(() => {
		if (typeof window === 'undefined') return;

		const speechWindow = window as Window & {
			SpeechRecognition?: SpeechRecognitionCtor;
			webkitSpeechRecognition?: SpeechRecognitionCtor;
		};

		const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
		if (!Recognition) return;

		const nextRecognition = new Recognition();
		nextRecognition.continuous = true;
		nextRecognition.interimResults = true;
		nextRecognition.lang = 'en-GB';
		nextRecognition.onstart = null;
		nextRecognition.onaudiostart = null;
		nextRecognition.onsoundstart = null;
		nextRecognition.onspeechstart = null;
		nextRecognition.onspeechend = null;
		nextRecognition.onsoundend = null;
		nextRecognition.onaudioend = null;
		nextRecognition.onnomatch = null;
		nextRecognition.onresult = handleSpeechResult;
		nextRecognition.onend = () => {
			if (dictatedFinalText.trim() || dictatedInterimText.trim()) {
				commitDictationFromDisplay();
			}
			listening = false;
			clearDictationState();
		};
		nextRecognition.onerror = () => {
			listening = false;
			clearDictationState();
		};

		recognition = nextRecognition;
		supported = true;

		return () => {
			nextRecognition.onstart = null;
			nextRecognition.onaudiostart = null;
			nextRecognition.onsoundstart = null;
			nextRecognition.onspeechstart = null;
			nextRecognition.onspeechend = null;
			nextRecognition.onsoundend = null;
			nextRecognition.onaudioend = null;
			nextRecognition.onnomatch = null;
			nextRecognition.onresult = null;
			nextRecognition.onend = null;
			nextRecognition.onerror = null;
			nextRecognition.stop();
			recognition = null;
			supported = false;
			listening = false;
			clearDictationState();
		};
	});

	onDestroy(() => {
		recognition?.stop();
	});
</script>

<div
	class="speech-field"
	class:listening
	class:monospace
	bind:this={root}
	onfocusout={handleContainerFocusOut}
>
	{#if multiline}
		<textarea
			bind:this={field}
			{id}
			rows={rows}
			value={listening ? getDictationDisplayValue() : localValue}
			{placeholder}
			{disabled}
			{readonly}
			oninput={handleInput}
		></textarea>
	{:else}
		<input
			bind:this={field}
			{id}
			type="text"
			value={listening ? getDictationDisplayValue() : localValue}
			{placeholder}
			{disabled}
			{readonly}
			oninput={handleInput}
		/>
	{/if}

	{#if listening}
		<div class="speech-status" aria-live="polite">Recording</div>
	{/if}

	<button
		type="button"
		class="speech-button"
		class:listening
		aria-label={listening ? `Stop dictation for ${label}` : `Start dictation for ${label}`}
		aria-pressed={listening}
		title={supported ? (listening ? 'Stop dictation' : 'Start dictation') : 'Speech recognition not supported'}
		disabled={!supported || disabled || readonly}
		onclick={handleButtonClick}
	>
		<span aria-hidden="true">{listening ? '●' : 'Mic'}</span>
	</button>
</div>

<style>
	.speech-field {
		position: relative;
		display: flex;
		align-items: stretch;
	}

	.speech-field :global(input),
	.speech-field :global(textarea) {
		width: 100%;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.45);
		background: rgba(255, 255, 255, 0.98);
		padding: 0.62rem 3rem 0.62rem 0.72rem;
		font: inherit;
		color: #0f172a;
		box-sizing: border-box;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			background-color 140ms ease;
	}

	.speech-field :global(textarea) {
		resize: vertical;
		min-height: 5.5rem;
	}

	.speech-field.monospace :global(input),
	.speech-field.monospace :global(textarea) {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		line-height: 1.5;
	}

	.speech-field :global(input:focus),
	.speech-field :global(textarea:focus) {
		outline: none;
		border-color: rgba(37, 99, 235, 0.5);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
	}

	.speech-field.listening :global(input),
	.speech-field.listening :global(textarea) {
		border-color: rgba(239, 68, 68, 0.38);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(254, 242, 242, 0.98));
		box-shadow:
			0 0 0 3px rgba(239, 68, 68, 0.09),
			inset 0 1px 0 rgba(255, 255, 255, 0.72);
	}

	.speech-status {
		position: absolute;
		left: 0.75rem;
		top: -0.55rem;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		background: rgba(254, 226, 226, 0.98);
		color: #b91c1c;
		font-size: 0.64rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		box-shadow: 0 6px 16px rgba(239, 68, 68, 0.14);
	}

	.speech-button {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		min-width: 2rem;
		height: 2rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.96);
		color: #475569;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
		transition:
			background-color 140ms ease,
			border-color 140ms ease,
			color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.speech-button:hover:not(:disabled),
	.speech-button:focus-visible:not(:disabled) {
		outline: none;
		border-color: rgba(37, 99, 235, 0.45);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.speech-button.listening {
		background: rgba(254, 226, 226, 0.95);
		border-color: rgba(239, 68, 68, 0.34);
		color: #b91c1c;
		transform: scale(1.02);
	}

	.speech-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
