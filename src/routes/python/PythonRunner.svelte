<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { runPython } from '../../lib/pyEngine';

	export let script: string;
	export let data: any;

	const dispatch = createEventDispatcher();

	let running = false;
	let error: string | null = null;

	export async function run() {
		running = true;
		error = null;

		try {
			const result = await runPython(script, data);
			dispatch('result', result);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			dispatch('error', error);
		} finally {
			running = false;
		}
	}
</script>
