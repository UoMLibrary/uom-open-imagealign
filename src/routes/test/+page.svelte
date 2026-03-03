<script lang="ts">
	import { get } from 'idb-keyval';

	let src: string | null = null;
	let error: string | null = null;

	const key =
		'thumb::0f1be6ca2e907808da67ca3e3e792da03681a41e014f7069235edee6c713d517::v1_256::256';

	async function load() {
		try {
			const blob = await get(key);
			console.log('Blob from IDB:', blob);

			if (!blob) {
				error = 'No blob found';
				return;
			}

			// OPTION 1 (recommended): object URL
			src = URL.createObjectURL(blob);

			// OPTION 2 (if you prefer data URL)
			// const reader = new FileReader();
			// reader.onload = () => (src = reader.result as string);
			// reader.readAsDataURL(blob);
		} catch (e) {
			error = String(e);
		}
	}

	load();
</script>

<h2>IndexedDB Thumb Test</h2>

{#if error}
	<div style="color:red">{error}</div>
{:else if src}
	<img {src} style="max-width:300px;border:1px solid #ccc" />
{:else}
	<div>Loading…</div>
{/if}
