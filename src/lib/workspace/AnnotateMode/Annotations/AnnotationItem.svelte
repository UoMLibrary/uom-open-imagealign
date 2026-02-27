<script>
	import { createEventDispatcher } from 'svelte';
	import AudioNote from './AudioNote.svelte';
	import SpeechToText from './SpeechToText.svelte';
	import PageLockItemToggle from './PageLockItemToggle.svelte';
	import BinButton from '$lib/ui/shared/buttons/BinButton.svelte';

	export let annotation;
	export let selected = false;

	const dispatch = createEventDispatcher();

	/* -----------------------------
	   Local state
	----------------------------- */

	let title = annotation.title ?? '';
	let body = annotation.body?.[0]?.value ?? '';
	let interimTitleText = '';
	let interimText = '';
	let locked = annotation.locked ?? false;

	$: if (annotation) {
		title = annotation.title ?? '';
		body = annotation.body?.[0]?.value ?? '';
		locked = annotation.locked ?? false;
	}

	function commit() {
		dispatch('update', {
			...annotation,
			title,
			locked,
			body: [
				{
					type: 'TextualBody',
					value: body,
					purpose: 'commenting'
				}
			]
		});
	}

	/* -----------------------------
	   Speech to text
	----------------------------- */

	function handleSpeechTitleFinal(e) {
		title = (title + ' ' + e.detail).trim();
		interimTitleText = '';
		commit();
	}

	function handleSpeechTitleInterim(e) {
		interimTitleText = e.detail;
	}

	function handleSpeechFinal(e) {
		body = (body + ' ' + e.detail).trim();
		interimText = '';
		commit();
	}

	function handleSpeechInterim(e) {
		interimText = e.detail;
	}

	/* -----------------------------
	   Audio note
	----------------------------- */

	function handleRecorded(e) {
		dispatch('update', {
			...annotation,
			audio: {
				url: e.detail.url,
				blob: e.detail.blob
			}
		});
	}

	function removeAudio() {
		dispatch('update', {
			...annotation,
			audio: null
		});
	}

	function handleLockChange(e) {
		locked = e.detail.locked;
		commit();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="annotation-item" class:selected on:click={() => dispatch('select', annotation.id)}>
	<!-- ---------- Header ---------- -->
	<header>
		<input
			class="title"
			type="text"
			placeholder="Annotation title"
			bind:value={title}
			on:blur={commit}
			on:keydown={(e) => e.key === 'Enter' && e.target.blur()}
		/>
		<SpeechToText on:final={handleSpeechTitleFinal} on:interim={handleSpeechTitleInterim} />

		<BinButton title="Delete annotation" on:click={() => dispatch('delete', annotation.id)} />
	</header>

	<!-- ---------- Text area + dictate ---------- -->
	<div class="text-wrap">
		<!-- svelte-ignore element_invalid_self_closing_tag -->
		<textarea
			class="body"
			rows="3"
			placeholder="Add a note…"
			value={body + (interimText ? ' ' + interimText : '')}
			on:input={(e) => (body = e.target.value)}
			on:blur={commit}
		/>

		<div class="dictate">
			<SpeechToText on:final={handleSpeechFinal} on:interim={handleSpeechInterim} />
		</div>
	</div>

	<!-- ---------- Footer controls ---------- -->
	<footer>
		<AudioNote audio={annotation.audio} on:recorded={handleRecorded} on:deleted={removeAudio} />

		<PageLockItemToggle {locked} on:change={handleLockChange} />
	</footer>
</div>

<style>
	.annotation-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;

		padding: 0.3rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: #fff;

		cursor: pointer;
	}

	.annotation-item.selected {
		border-color: #5aa9ff;
		background: #eef6ff;
	}

	/* ---------- Header ---------- */

	header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.title {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 600;

		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.25);
		background: transparent;
	}

	.title:focus {
		outline: none;
		border-bottom-color: #5aa9ff;
	}

	/* ---------- Text area ---------- */

	.text-wrap {
		position: relative;
	}

	.body {
		width: 100%;
		resize: vertical;

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;

		font-size: 0.85rem;
		line-height: 1.4;

		padding: 0.4rem 0.5rem 1.6rem 0.5rem;

		border-radius: 6px;
		border: 1px solid rgba(0, 0, 0, 0.15);
	}

	.body:focus {
		outline: none;
		border-color: #5aa9ff;
	}

	/* ---------- Dictate overlay ---------- */

	.dictate {
		position: absolute;
		right: 0.35rem;
		bottom: 0.35rem;
	}

	/* ---------- Footer ---------- */

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
</style>
