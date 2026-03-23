<script lang="ts">
	import { onMount } from 'svelte';
	import { entries } from 'idb-keyval';

	export let refreshInterval = 10000;

	// optional live updates from parent
	export let manualDeltaBytes: number = 0;

	let usage = 0;
	let quota = 0;
	let percent = 0;

	let totalBytes = 0;
	let workBytes = 0;
	let thumbBytes = 0;

	function formatBytes(bytes: number) {
		if (!bytes) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
	}

	async function updateEstimate() {
		if (!navigator.storage?.estimate) return;

		const est = await navigator.storage.estimate();
		usage = est.usage ?? 0;
		quota = est.quota ?? 0;
		percent = quota ? (usage / quota) * 100 : 0;
	}

	async function scanIndexedDB() {
		let total = 0;
		let work = 0;
		let thumb = 0;

		const all = await entries();

		for (const [key, value] of all) {
			if (typeof key !== 'string') continue;
			if (!(value instanceof Blob)) continue;

			if (key.startsWith('work::')) {
				work += value.size;
				total += value.size;
			} else if (key.startsWith('thumb::')) {
				thumb += value.size;
				total += value.size;
			}
		}

		totalBytes = total;
		workBytes = work;
		thumbBytes = thumb;
	}

	let interval: any;

	onMount(async () => {
		await scanIndexedDB();
		await updateEstimate();

		interval = setInterval(updateEstimate, refreshInterval);

		return () => clearInterval(interval);
	});

	// allow parent to push updates (fast path)
	$: if (manualDeltaBytes !== 0) {
		totalBytes += manualDeltaBytes;
	}
</script>

<div class="storage">
	<div class="section">
		<div class="row">
			<div class="label">Cache (IndexedDB)</div>
			<div class="value">{formatBytes(totalBytes)}</div>
		</div>

		<div class="row small">
			<div>Work</div>
			<div>{formatBytes(workBytes)}</div>
		</div>

		<div class="row small">
			<div>Thumbs</div>
			<div>{formatBytes(thumbBytes)}</div>
		</div>
	</div>

	<div class="section">
		<div class="row">
			<div class="label">Browser storage</div>
			<div class="value">{formatBytes(usage)} / {formatBytes(quota)}</div>
		</div>

		<div class="bar">
			<div class="fill" style={`width: ${percent}%`}></div>
		</div>
	</div>
</div>

<style>
	.storage {
		font-size: 0.85rem;
		padding: 0.6rem;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.row {
		display: flex;
		justify-content: space-between;
	}

	.row.small {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.label {
		font-weight: 600;
	}

	.value {
		font-family: monospace;
	}

	.bar {
		height: 6px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: 3px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, #60a5fa, #2563eb);
		transition: width 0.3s ease;
	}
</style>
