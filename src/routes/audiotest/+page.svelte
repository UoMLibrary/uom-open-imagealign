<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

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

	let recognition = $state<SpeechRecognitionLike | null>(null);
	let listening = $state(false);
	let supported = $state(false);
	let finalText = $state('');
	let interimText = $state('');
	let logs = $state<string[]>([]);

	function stamp(message: string, detail?: unknown) {
		const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
		const suffix = detail === undefined ? '' : ` ${JSON.stringify(detail)}`;
		const line = `${time} ${message}${suffix}`;
		logs = [line, ...logs].slice(0, 80);
		console.log(`[AudioTest] ${message}`, detail ?? '');
	}

	function capitalizeFirst(text: string) {
		if (!text) return text;
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function appendFinalTranscript(text: string) {
		const cleaned = capitalizeFirst(text.trim());
		if (!cleaned) return;
		finalText = finalText ? `${finalText} ${cleaned}` : cleaned;
	}

	onMount(() => {
		if (typeof window === 'undefined') return;

		const speechWindow = window as Window & {
			SpeechRecognition?: SpeechRecognitionCtor;
			webkitSpeechRecognition?: SpeechRecognitionCtor;
		};

		const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
		if (!Recognition) {
			console.log('[AudioTest] speech recognition unavailable');
			return;
		}

		const nextRecognition = new Recognition();
		nextRecognition.continuous = true;
		nextRecognition.interimResults = true;
		nextRecognition.lang = 'en-GB';

		nextRecognition.onstart = () => {
			listening = true;
			stamp('onstart');
		};
		nextRecognition.onaudiostart = () => stamp('onaudiostart');
		nextRecognition.onsoundstart = () => stamp('onsoundstart');
		nextRecognition.onspeechstart = () => stamp('onspeechstart');
		nextRecognition.onspeechend = () => stamp('onspeechend');
		nextRecognition.onsoundend = () => stamp('onsoundend');
		nextRecognition.onaudioend = () => stamp('onaudioend');
		nextRecognition.onnomatch = (event?: unknown) => stamp('onnomatch', event);
		nextRecognition.onresult = (event: SpeechRecognitionEventLike) => {
			let interim = '';
			let final = '';

			for (let i = event.resultIndex; i < event.results.length; i += 1) {
				const text = event.results[i]?.[0]?.transcript ?? '';
				if (!text) continue;
				if (event.results[i].isFinal) final += text;
				else interim += text;
			}

			interimText = capitalizeFirst(interim.trim());
			if (final.trim()) {
				appendFinalTranscript(final);
				interimText = '';
			}

			stamp('onresult', { interim, final, resultIndex: event.resultIndex });
		};
		nextRecognition.onerror = (event?: unknown) => {
			listening = false;
			stamp('onerror', event);
		};
		nextRecognition.onend = () => {
			listening = false;
			stamp('onend');
		};

		recognition = nextRecognition;
		supported = true;
		console.log('[AudioTest] speech recognition available');
		stamp('speech recognition available');

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
			nextRecognition.onerror = null;
			nextRecognition.onend = null;
			nextRecognition.stop();
			recognition = null;
			supported = false;
			listening = false;
		};
	});

	function start() {
		if (!recognition) return;
		try {
			stamp('start() called');
			recognition.start();
		} catch (error) {
			stamp('start() failed', error);
		}
	}

	function stop() {
		if (!recognition) return;
		stamp('stop() called');
		recognition.stop();
	}

	function clearAll() {
		finalText = '';
		interimText = '';
		logs = [];
		stamp('cleared');
	}

	onDestroy(() => {
		recognition?.stop();
	});
</script>

<svelte:head>
	<title>Audio Test</title>
</svelte:head>

<div class="page">
	<section class="card">
		<div class="eyebrow">Speech Recognition Test</div>
		<h1>Audio Test</h1>
		<p>
			This page uses the raw browser speech-recognition API with no annotation-editor wrapper.
			Use it to compare browser event behavior directly.
		</p>

		<div class="controls">
			<button type="button" class="primary" disabled={!supported || listening} onclick={start}>
				Start
			</button>
			<button type="button" class="secondary" disabled={!supported || !listening} onclick={stop}>
				Stop
			</button>
			<button type="button" class="ghost" onclick={clearAll}>Clear</button>
		</div>

		<div class="status-row">
			<div class="status-pill" class:listening>{listening ? 'Recording' : 'Idle'}</div>
			<div class="support-copy">
				{supported ? 'SpeechRecognition detected' : 'SpeechRecognition not available'}
			</div>
		</div>

		<label class="field">
			<span>Final transcript</span>
			<textarea rows="8" readonly value={finalText}></textarea>
		</label>

		<label class="field">
			<span>Interim transcript</span>
			<input type="text" readonly value={interimText} />
		</label>
	</section>

	<section class="card logs-card">
		<div class="logs-head">
			<h2>Event Log</h2>
			<div class="log-hint">Newest first</div>
		</div>

		{#if logs.length === 0}
			<div class="empty">No events yet.</div>
		{:else}
			<div class="log-list">
				{#each logs as line}
					<div class="log-line">{line}</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.page {
		min-height: 100vh;
		padding: 2rem;
		display: grid;
		grid-template-columns: minmax(20rem, 42rem) minmax(20rem, 1fr);
		gap: 1.25rem;
		background:
			radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 24%),
			linear-gradient(180deg, #f8fafc, #eef2ff);
		box-sizing: border-box;
	}

	.card {
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 18px;
		padding: 1.3rem;
		box-shadow: 0 22px 42px rgba(15, 23, 42, 0.08);
	}

	.eyebrow {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #0369a1;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		margin-top: 0.25rem;
		font-size: 1.8rem;
		color: #0f172a;
	}

	p {
		margin-top: 0.7rem;
		line-height: 1.5;
		color: #475569;
	}

	.controls {
		margin-top: 1.15rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	button {
		border: none;
		border-radius: 999px;
		padding: 0.72rem 1rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.primary {
		background: #0f172a;
		color: white;
	}

	.secondary {
		background: #e2e8f0;
		color: #0f172a;
	}

	.ghost {
		background: transparent;
		border: 1px solid rgba(148, 163, 184, 0.4);
		color: #334155;
	}

	.status-row {
		margin-top: 1rem;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		background: #e2e8f0;
		color: #334155;
		font-size: 0.76rem;
		font-weight: 800;
	}

	.status-pill.listening {
		background: #fee2e2;
		color: #b91c1c;
	}

	.support-copy {
		color: #64748b;
		font-size: 0.86rem;
	}

	.field {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field span {
		font-size: 0.8rem;
		font-weight: 700;
		color: #0f172a;
	}

	.field textarea,
	.field input {
		width: 100%;
		box-sizing: border-box;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.38);
		background: white;
		padding: 0.8rem 0.9rem;
		font: inherit;
		color: #0f172a;
	}

	.field textarea {
		resize: vertical;
		min-height: 10rem;
	}

	.logs-card {
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.logs-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.log-hint {
		font-size: 0.76rem;
		color: #64748b;
	}

	.log-list {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		overflow: auto;
		max-height: 70vh;
	}

	.log-line,
	.empty {
		border-radius: 12px;
		padding: 0.72rem 0.8rem;
		background: rgba(248, 250, 252, 0.95);
		border: 1px solid rgba(226, 232, 240, 0.9);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.78rem;
		color: #334155;
		white-space: pre-wrap;
		word-break: break-word;
	}

	@media (max-width: 960px) {
		.page {
			grid-template-columns: 1fr;
			padding: 1rem;
		}
	}
</style>
