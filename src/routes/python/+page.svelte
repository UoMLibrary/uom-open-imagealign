<script lang="ts">
	import PythonRunner from './PythonRunner.svelte';

	let script = `def process(data):
    return [x for x in data if x["value"] > 10]
`;

	let data = [
		{ name: 'A', value: 5 },
		{ name: 'B', value: 15 },
		{ name: 'C', value: 25 }
	];

	// ✅ Editable string version
	let dataText = JSON.stringify(data, null, 2);

	let output: any = null;
	let error: string | null = null;

	let runner;

	function run() {
		try {
			// ✅ Parse just before running
			data = JSON.parse(dataText);
			error = null;
			runner.run();
		} catch (err) {
			error = 'Invalid JSON';
		}
	}

	function handleResult(e) {
		output = e.detail;
	}

	function handleError(e) {
		error = e.detail;
	}
</script>

<div class="layout">
	<div>
		<h3>Python Script</h3>
		<textarea bind:value={script} rows="10"></textarea>

		<h3>Input Data (JSON)</h3>
		<textarea bind:value={dataText} rows="10"></textarea>

		<button on:click={run}>Run</button>
	</div>

	<div>
		<h3>Output</h3>
		<pre>{JSON.stringify(output, null, 2)}</pre>

		{#if error}
			<h3>Error</h3>
			<pre class="error">{error}</pre>
		{/if}
	</div>
</div>

<PythonRunner bind:this={runner} {script} {data} on:result={handleResult} on:error={handleError} />

<style>
	.layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	textarea {
		width: 100%;
		font-family: monospace;
	}

	pre {
		background: #111;
		color: #0f0;
		padding: 1rem;
		overflow: auto;
	}

	.error {
		color: red;
	}
</style>
