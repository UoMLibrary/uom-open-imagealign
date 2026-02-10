<script lang="ts">
	import { images } from '$lib/stores/projectStore';
	import { groupingState } from '$lib/stores/groupingStore';
	import GroupProposalList from '../GroupProposalList.svelte';
	import { groupByVisualProfile } from '$lib/strategies/grouping/byVisualProfile';
	import { extractVisualProfile } from '$lib/image/visualProfile';

	let threshold = 0.9;
	let profiles = new Map<string, number[]>();
	let profilesReady = false;

	async function buildProfiles() {
		profiles.clear();

		for (const img of $images) {
			if (!img.uri) continue;

			const el = new Image();
			el.src = img.uri;
			await el.decode();

			profiles.set(img.id, extractVisualProfile(el));
		}

		profilesReady = true;
	}

	async function run() {
		if (!profilesReady) {
			await buildProfiles();
		}

		groupingState.set({
			proposals: groupByVisualProfile($images, profiles, threshold),
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
		<input type="range" min="0.5" max="1" step="0.01" bind:value={threshold} on:input={run} />
	</label>

	<button on:click={run}> Propose groups </button>

	{#if !profilesReady}
		<p class="hint">Profiles will be computed on first run.</p>
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
