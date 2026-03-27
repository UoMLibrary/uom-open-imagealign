<script lang="ts">
	import { onMount } from 'svelte';
	import { clear, del, entries, keys } from 'idb-keyval';
	import { appConfigState } from '$lib/config/appConfigStore.svelte';
	import { settingsState } from '$lib/config/settingsStore.svelte';

	const APP_CONFIG_KEY = 'uom-imagealign:app-config:v1';
	const SETTINGS_KEY = 'uom-imagealign:settings:v1';
	const CACHE_PREFIXES = ['work::', 'thumb::', 'prep::', 'norm::', 'trim::'];

	type BucketStats = {
		count: number;
		bytes: number;
	};

	type StorageBreakdown = {
		indexedDb: BucketStats;
		localStorage: BucketStats;
		work: BucketStats;
		thumbnails: BucketStats;
		prepared: BucketStats;
		normalised: BucketStats;
		otherIndexedDb: BucketStats;
	};

	let browserUsage = $state(0);
	let browserQuota = $state(0);
	let browserPercent = $state(0);
	let breakdown = $state(createEmptyBreakdown());
	let refreshTimer: ReturnType<typeof setInterval> | null = null;
	let loading = $state(true);
	let busyAction = $state<'cache' | 'indexeddb' | 'local' | 'all' | null>(null);
	let feedback = $state('');

	function createEmptyBucket(): BucketStats {
		return { count: 0, bytes: 0 };
	}

	function createEmptyBreakdown(): StorageBreakdown {
		return {
			indexedDb: createEmptyBucket(),
			localStorage: createEmptyBucket(),
			work: createEmptyBucket(),
			thumbnails: createEmptyBucket(),
			prepared: createEmptyBucket(),
			normalised: createEmptyBucket(),
			otherIndexedDb: createEmptyBucket()
		};
	}

	function formatBytes(bytes: number) {
		if (!bytes) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
	}

	function estimateValueSize(value: unknown): number {
		if (value instanceof Blob) return value.size;
		if (typeof value === 'string') return new TextEncoder().encode(value).length;

		try {
			return new TextEncoder().encode(JSON.stringify(value)).length;
		} catch {
			return 0;
		}
	}

	function addToBucket(bucket: BucketStats, bytes: number) {
		bucket.count += 1;
		bucket.bytes += bytes;
	}

	function maybeConfirm(message: string): boolean {
		if (!appConfigState.confirmBeforeClearingStorage) return true;
		return window.confirm(message);
	}

	async function refresh() {
		loading = true;
		feedback = '';

		try {
			if (navigator.storage?.estimate) {
				const estimate = await navigator.storage.estimate();
				browserUsage = estimate.usage ?? 0;
				browserQuota = estimate.quota ?? 0;
				browserPercent = browserQuota ? (browserUsage / browserQuota) * 100 : 0;
			}

			const next = createEmptyBreakdown();
			const localEncoder = new TextEncoder();

			for (let index = 0; index < localStorage.length; index += 1) {
				const key = localStorage.key(index);
				if (!key || !key.startsWith('uom-imagealign:')) continue;

				const value = localStorage.getItem(key) ?? '';
				addToBucket(next.localStorage, localEncoder.encode(value).length);
			}

			const allEntries = await entries();

			for (const [key, value] of allEntries) {
				if (typeof key !== 'string') continue;

				const bytes = estimateValueSize(value);
				addToBucket(next.indexedDb, bytes);

				if (key.startsWith('work::')) {
					addToBucket(next.work, bytes);
				} else if (key.startsWith('thumb::')) {
					addToBucket(next.thumbnails, bytes);
				} else if (key.startsWith('prep::')) {
					addToBucket(next.prepared, bytes);
				} else if (key.startsWith('norm::') || key.startsWith('trim::')) {
					addToBucket(next.normalised, bytes);
				} else {
					addToBucket(next.otherIndexedDb, bytes);
				}
			}

			breakdown = next;
		} finally {
			loading = false;
		}
	}

	async function clearDerivedCache() {
		if (
			!maybeConfirm(
				'Clear the browser-side derived image cache? This removes stored working images, thumbnails, and derived artefacts from IndexedDB.'
			)
		) {
			return;
		}

		busyAction = 'cache';

		try {
			const allKeys = await keys();

			for (const key of allKeys) {
				if (typeof key !== 'string') continue;
				if (CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
					await del(key);
				}
			}

			feedback = 'Derived image cache cleared from IndexedDB.';
			await refresh();
		} finally {
			busyAction = null;
		}
	}

	async function clearIndexedDbStore() {
		if (
			!maybeConfirm(
				'Clear the full IndexedDB key-value store used by this app? This is broader than cache-only clearing and removes any browser-side data stored there.'
			)
		) {
			return;
		}

		busyAction = 'indexeddb';

		try {
			await clear();
			feedback = 'IndexedDB store cleared.';
			await refresh();
		} finally {
			busyAction = null;
		}
	}

	async function clearLocalAppData() {
		if (
			!maybeConfirm(
				'Clear saved settings profiles and app config from localStorage? The application will recreate defaults immediately.'
			)
		) {
			return;
		}

		busyAction = 'local';

		try {
			localStorage.removeItem(SETTINGS_KEY);
			localStorage.removeItem(APP_CONFIG_KEY);
			settingsState.resetAll();
			appConfigState.reset();
			feedback = 'Saved local settings and config were reset.';
			await refresh();
		} finally {
			busyAction = null;
		}
	}

	async function clearAllAppStorage() {
		if (
			!maybeConfirm(
				'Clear all browser-side app storage? This removes IndexedDB data and resets saved local settings/config to defaults.'
			)
		) {
			return;
		}

		busyAction = 'all';

		try {
			await clear();
			localStorage.removeItem(SETTINGS_KEY);
			localStorage.removeItem(APP_CONFIG_KEY);
			settingsState.resetAll();
			appConfigState.reset();
			feedback = 'All browser-side app storage was cleared and defaults were restored.';
			await refresh();
		} finally {
			busyAction = null;
		}
	}

	function restartRefreshTimer() {
		if (refreshTimer) clearInterval(refreshTimer);
		refreshTimer = setInterval(refresh, appConfigState.storageRefreshIntervalSeconds * 1000);
	}

	onMount(() => {
		void refresh();
		restartRefreshTimer();

		return () => {
			if (refreshTimer) clearInterval(refreshTimer);
		};
	});

	$effect(() => {
		appConfigState.storageRefreshIntervalSeconds;
		restartRefreshTimer();
	});
</script>

<div class="storage-panel">
	<div class="section-card">
		<div class="section-header">
			<div>
				<h2>Browser Storage</h2>
				<p>
					Inspect browser-side storage used by this app. Clearing IndexedDB is possible here, and the
					current image cache is safe to rebuild.
				</p>
			</div>

			<button type="button" class="ghost-button" onclick={() => void refresh()} disabled={loading}>
				{loading ? 'Refreshing…' : 'Refresh'}
			</button>
		</div>

		<div class="usage-summary">
			<div class="summary-line">
				<div class="summary-label">Estimated browser usage</div>
				<div class="summary-value">{formatBytes(browserUsage)} / {formatBytes(browserQuota)}</div>
			</div>

			<div class="bar">
				<div class="fill" style={`width: ${Math.min(browserPercent, 100)}%`}></div>
			</div>
		</div>

		<div class="metric-grid">
			<div class="metric-card">
				<div class="metric-label">IndexedDB total</div>
				<div class="metric-value">{formatBytes(breakdown.indexedDb.bytes)}</div>
				<div class="metric-sub">{breakdown.indexedDb.count} entries</div>
			</div>

			<div class="metric-card">
				<div class="metric-label">Local settings/config</div>
				<div class="metric-value">{formatBytes(breakdown.localStorage.bytes)}</div>
				<div class="metric-sub">{breakdown.localStorage.count} localStorage keys</div>
			</div>

			<div class="metric-card">
				<div class="metric-label">Working images</div>
				<div class="metric-value">{formatBytes(breakdown.work.bytes)}</div>
				<div class="metric-sub">{breakdown.work.count} cached blobs</div>
			</div>

			<div class="metric-card">
				<div class="metric-label">Thumbnails</div>
				<div class="metric-value">{formatBytes(breakdown.thumbnails.bytes)}</div>
				<div class="metric-sub">{breakdown.thumbnails.count} cached blobs</div>
			</div>

			<div class="metric-card">
				<div class="metric-label">Prepared and normalised</div>
				<div class="metric-value">
					{formatBytes(breakdown.prepared.bytes + breakdown.normalised.bytes)}
				</div>
				<div class="metric-sub">
					{breakdown.prepared.count + breakdown.normalised.count} derived entries
				</div>
			</div>

			<div class="metric-card">
				<div class="metric-label">Other IndexedDB data</div>
				<div class="metric-value">{formatBytes(breakdown.otherIndexedDb.bytes)}</div>
				<div class="metric-sub">{breakdown.otherIndexedDb.count} entries</div>
			</div>
		</div>
	</div>

	<div class="section-card">
		<div class="section-header">
			<div>
				<h2>Management</h2>
				<p>Use the narrowest reset that solves the problem first. Cache clearing is the least disruptive option.</p>
			</div>
		</div>

		<div class="action-grid">
			<button
				type="button"
				class="action-button"
				onclick={() => void clearDerivedCache()}
				disabled={busyAction !== null}
			>
				{busyAction === 'cache' ? 'Clearing…' : 'Clear derived image cache'}
			</button>

			<button
				type="button"
				class="action-button"
				onclick={() => void clearIndexedDbStore()}
				disabled={busyAction !== null}
			>
				{busyAction === 'indexeddb' ? 'Clearing…' : 'Clear IndexedDB store'}
			</button>

			<button
				type="button"
				class="action-button"
				onclick={() => void clearLocalAppData()}
				disabled={busyAction !== null}
			>
				{busyAction === 'local' ? 'Resetting…' : 'Reset saved local settings'}
			</button>

			<button
				type="button"
				class="action-button danger"
				onclick={() => void clearAllAppStorage()}
				disabled={busyAction !== null}
			>
				{busyAction === 'all' ? 'Clearing…' : 'Clear all browser-side app data'}
			</button>
		</div>

		<p class="help-text">
			IndexedDB clearing removes the app’s browser cache. That may slow things briefly until derived images
			are regenerated, but it should not affect correctness.
		</p>

		{#if feedback}
			<div class="feedback">{feedback}</div>
		{/if}
	</div>
</div>

<style>
	.storage-panel {
		display: flex;
		flex-direction: column;
		gap: 0;
		height: 100%;
		overflow: auto;
		background: #fff;
	}

	.section-card {
		padding: 1rem;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
	}

	.section-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.section-header h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
		color: #111827;
	}

	.section-header p,
	.help-text {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: #64748b;
	}

	.usage-summary {
		padding: 0.95rem 1rem;
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(239, 246, 255, 0.88), rgba(224, 242, 254, 0.82));
		border: 1px solid rgba(59, 130, 246, 0.15);
		margin-bottom: 1rem;
	}

	.summary-line {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.6rem;
	}

	.summary-label {
		font-size: 0.84rem;
		font-weight: 700;
		color: #0f172a;
	}

	.summary-value {
		font-size: 0.84rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		color: #0f172a;
	}

	.bar {
		height: 8px;
		background: rgba(148, 163, 184, 0.2);
		border-radius: 999px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, #38bdf8, #2563eb);
		transition: width 180ms ease;
	}

	.metric-grid,
	.action-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.metric-card {
		padding: 0.95rem 1rem;
		border-radius: 14px;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.95));
		border: 1px solid rgba(148, 163, 184, 0.16);
	}

	.metric-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: #475569;
		margin-bottom: 0.35rem;
	}

	.metric-value {
		font-size: 1.05rem;
		font-weight: 700;
		color: #0f172a;
		margin-bottom: 0.15rem;
	}

	.metric-sub {
		font-size: 0.76rem;
		color: #64748b;
	}

	.action-button,
	.ghost-button {
		appearance: none;
		border: 1px solid rgba(15, 23, 42, 0.12);
		background: #fff;
		color: #111827;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}

	.action-button:hover,
	.ghost-button:hover {
		background: #f8fafc;
	}

	.action-button:disabled,
	.ghost-button:disabled {
		opacity: 0.65;
		cursor: progress;
	}

	.action-button.danger {
		border-color: rgba(220, 38, 38, 0.18);
		background: rgba(254, 242, 242, 0.92);
		color: #991b1b;
	}

	.help-text {
		margin-top: 1rem;
	}

	.feedback {
		margin-top: 0.9rem;
		padding: 0.75rem 0.85rem;
		border-radius: 10px;
		background: rgba(236, 253, 245, 0.9);
		border: 1px solid rgba(16, 185, 129, 0.14);
		color: #065f46;
		font-size: 0.84rem;
	}

	@media (max-width: 800px) {
		.section-header,
		.summary-line {
			flex-direction: column;
		}

		.metric-grid,
		.action-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
