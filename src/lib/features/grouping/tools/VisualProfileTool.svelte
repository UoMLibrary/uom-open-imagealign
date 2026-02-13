<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { images, groups } from '$lib/domain/project/projectStore';
	import { groupingState } from '$lib/domain/grouping/groupingStore';
	import GroupProposalList from '../../../workspace/panels/GroupProposalList.svelte';
	import { groupByVisualProfile } from '$lib/strategies/grouping/byVisualProfile';
	import { extractVisualProfile } from '$lib/domain/image/visualProfile';

	let threshold = 0.9;

	let profiles = new Map<string, number[]>();
	let profilesReady = false;
	let building = false;

	let active = true;

	onDestroy(() => {
		active = false;
	});

	/* -----------------------------
	   Build profiles (only when needed)
	----------------------------- */
	async function buildProfiles() {
		building = true;
		profiles.clear();

		for (const img of $images) {
			if (!img.uri) continue;

			const el = new Image();
			el.src = img.uri;
			await el.decode();

			profiles.set(img.id, extractVisualProfile(el));
		}

		profilesReady = true;
		building = false;
	}

	/* -----------------------------
	   Rebuild profiles when images change
	----------------------------- */
	let previousImageCount = 0;

	$: {
		if ($images.length !== previousImageCount) {
			profilesReady = false;
			previousImageCount = $images.length;
		}
	}

	/* -----------------------------
	   Auto-run grouping
	----------------------------- */
	$: run();

	async function run() {
		if (!active) return;

		if (building) return;

		if (!profilesReady) {
			await buildProfiles();
		}

		// ✅ Only exclude CONFIRMED groups (not proposals)
		const groupedIds = new Set($groups.flatMap((g) => g.imageIds));

		const eligibleImages = $images.filter((img) => !groupedIds.has(img.id));

		if (!active) return;

		groupingState.set({
			proposals: groupByVisualProfile(eligibleImages, profiles, threshold),
			selected: new Set()
		});
	}
</script>

<div class="tool">
	<p class="description">
		Group images by overall colour and tone, ignoring layout and exact pixels.
	</p>

	<label class="slider">
		Similarity: {Math.round(threshold * 100)}%
		<input type="range" min="0.5" max="1" step="0.01" bind:value={threshold} />
	</label>

	{#if building}
		<p class="hint">Computing visual profiles…</p>
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
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}

	.hint {
		font-size: 0.75rem;
		color: #777;
	}
</style>
