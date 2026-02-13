<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';

	import { images, groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../../../workspace/panels/GroupProposalList.svelte';
	import { groupByVisualProfile } from '$lib/strategies/grouping/byVisualProfile';
	import { extractVisualProfile } from '$lib/domain/image/visualProfile';

	let threshold = 0.9;

	let profiles = new Map<string, number[]>();
	let building = false;
	let running = false;
	let cancelled = false;

	let lastImageSignature = '';

	onDestroy(() => {
		cancelled = true;
	});

	/* ----------------------------------
	   Build visual profiles (lazy)
	----------------------------------- */
	async function buildProfiles() {
		const $images = get(images);

		building = true;
		profiles.clear();

		for (const img of $images) {
			if (cancelled) return;
			if (!img.uri) continue;

			const el = new Image();
			el.src = img.uri;
			await el.decode();

			if (cancelled) return;

			profiles.set(img.id, extractVisualProfile(el));
		}

		building = false;
	}

	/* ----------------------------------
	   Explicit execution
	----------------------------------- */
	export async function run() {
		if (running) return;

		running = true;
		cancelled = false;

		try {
			const $images = get(images);
			const $groups = get(groups);

			// Detect if images changed (simple signature)
			const signature = $images.map((i) => i.id).join('|');

			if (signature !== lastImageSignature) {
				lastImageSignature = signature;
				await buildProfiles();
			}

			if (cancelled) return;

			const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

			const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

			const proposals = groupByVisualProfile(eligibleImages, profiles, threshold);

			if (cancelled) return;

			groupingState.set({
				proposals,
				selected: new Set()
			});
		} finally {
			running = false;
		}
	}

	export function cancel() {
		cancelled = true;
	}

	/* ----------------------------------
	   Run only when slider released
	----------------------------------- */
	function handleSliderChange() {
		cancel();
		run();
	}
</script>

<div class="tool">
	<p class="description">
		Group images by overall colour and tone, ignoring layout and exact pixels.
	</p>

	<label class="slider">
		Similarity: {Math.round(threshold * 100)}%
		<input
			type="range"
			min="0.5"
			max="1"
			step="0.01"
			bind:value={threshold}
			on:change={handleSliderChange}
		/>
	</label>

	{#if building}
		<p class="hint">Computing visual profiles…</p>
	{/if}

	{#if running && !building}
		<p class="hint">Grouping images…</p>
	{/if}

	<GroupProposalList />
</div>

<style>
	.tool {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.description {
		font-size: 0.85rem;
		color: #555;
	}

	.slider {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: #555;
	}

	.hint {
		font-size: 0.75rem;
		color: #777;
	}
</style>
