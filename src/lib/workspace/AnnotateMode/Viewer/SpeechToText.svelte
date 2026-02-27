<script>
	import { createEventDispatcher, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher();

	let recognition;
	let listening = false;
	let supported = false;

	function capitalizeFirst(text) {
		if (!text) return text;
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	if (typeof window !== 'undefined') {
		const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (SR) {
			supported = true;
			recognition = new SR();
			recognition.continuous = true;
			recognition.interimResults = true;
			recognition.lang = 'en-GB';

			recognition.onresult = (event) => {
				let interim = '';
				let final = '';

				for (let i = event.resultIndex; i < event.results.length; i++) {
					const text = event.results[i][0].transcript;

					if (event.results[i].isFinal) {
						const cleaned = capitalizeFirst(text.trim());
						final += cleaned.endsWith('.') ? cleaned + ' ' : cleaned + '. ';
					} else {
						let text2 = capitalizeFirst(text);
						interim += text2;
					}
				}

				if (interim) dispatch('interim', interim);
				if (final) dispatch('final', final);
			};

			recognition.onend = () => {
				listening = false;
			};
		}
	}

	function toggle() {
		if (!supported) return;

		if (listening) {
			recognition.stop();
			listening = false;
		} else {
			recognition.start();
			listening = true;
		}
	}

	onDestroy(() => {
		recognition?.stop();
	});
</script>

<button
	class="speech"
	on:click|stopPropagation={toggle}
	disabled={!supported}
	title={supported ? 'Dictate note' : 'Speech recognition not supported'}
>
	<!-- {listening ? '⏹ Dictating…' : '🎤'} -->
	{listening ? '⏹' : '🎤'}
</button>

<style>
	.speech {
		border: none;
		background: none;
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.speech:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.speech:hover:not(:disabled) {
		background: none;
	}
</style>
