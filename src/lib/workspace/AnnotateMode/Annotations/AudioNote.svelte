<script>
	import { createEventDispatcher, onDestroy } from 'svelte';
	import BinButton from '$lib/ui/shared/buttons/BinButton.svelte';

	export let audio = null; // { url, duration } OR null

	const dispatch = createEventDispatcher();

	let mediaRecorder;
	let chunks = [];
	let stream;

	let recording = false;
	let playing = false;
	let audioEl;

	async function startRecording() {
		if (!navigator.mediaDevices?.getUserMedia) {
			alert('Audio recording not supported');
			return;
		}

		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		mediaRecorder = new MediaRecorder(stream);
		chunks = [];

		mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

		mediaRecorder.onstop = () => {
			const blob = new Blob(chunks, { type: 'audio/webm' });
			const url = URL.createObjectURL(blob);

			dispatch('recorded', {
				blob,
				url,
				duration: audioEl?.duration ?? null
			});

			cleanup();
		};

		mediaRecorder.start();
		recording = true;
	}

	function stopRecording() {
		mediaRecorder?.stop();
		recording = false;
	}

	function play() {
		if (!audioEl) return;
		audioEl.play();
		playing = true;
	}

	function stop() {
		audioEl.pause();
		audioEl.currentTime = 0;
		playing = false;
	}

	function cleanup() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
	}

	onDestroy(() => {
		cleanup();
	});
</script>

<div class="audio-note">
	{#if audio}
		<audio bind:this={audioEl} src={audio.url} on:ended={() => (playing = false)} />

		<button on:click={playing ? stop : play}>
			{playing ? '⏹' : '▶'}
		</button>

		<BinButton title="Delete audio" on:click={() => dispatch('deleted')} />
	{:else}
		<button class:recording on:click={recording ? stopRecording : startRecording}>
			{recording ? '⏹ Stop' : '🎙'}
		</button>
	{/if}
</div>

<style>
	.audio-note {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
	}

	button {
		border: none;
		background: none;
		/* border-radius: 4px; */
		padding: 0.2rem 0.4rem;
		cursor: pointer;
	}

	button.recording {
		background: none;
		border-color: none;
	}
</style>
