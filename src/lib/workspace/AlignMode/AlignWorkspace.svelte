<script lang="ts">
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';

	import { groups, imagesById, alignments } from '$lib/core/projectStore';
	import { upsertAlignment } from '$lib/core/projectStore';
	import type { ImageAlignment } from '$lib/core/types';

	import AlignToolbar, { type AlignStrategy } from './AlignToolbar.svelte';

	// Tools
	import KeypointAlignTool from './tools/KeypointAlignTool.svelte';
	import ManualAlignTool from './tools/ManualAlignTool.svelte';

	let LeftPanelOpen = true;

	let strategy: AlignStrategy = 'manual';

	let selectedGroupId: string | null = null;

	// Default selection to first group
	$: {
		const list = $groups;

		if (list.length === 0) {
			selectedGroupId = null;
		} else if (!selectedGroupId || !list.some((g) => g.id === selectedGroupId)) {
			selectedGroupId = list[0].id;
		}
	}

	$: selectedGroup = selectedGroupId ? $groups.find((g) => g.id === selectedGroupId) : null;

	function selectGroup(id: string) {
		selectedGroupId = id;
	}

	/* -------------------------------------------------
	   Active pair
	   target = baseImageId
	   source = first non-base, else base (single-image group)
	------------------------------------------------- */

	type ActivePair = {
		groupId: string;
		targetImageId: string;
		sourceImageId: string;
		targetUrl: string;
		sourceUrl: string;
		targetContentHash: string;
		sourceContentHash: string;
	};

	let activePair: ActivePair | null = null;

	$: {
		if (!selectedGroup || selectedGroup.imageIds.length === 0) {
			activePair = null;
		} else {
			const targetImageId = selectedGroup.baseImageId ?? selectedGroup.imageIds[0];
			const sourceImageId =
				selectedGroup.imageIds.find((id) => id !== targetImageId) ?? targetImageId;

			const target = $imagesById[targetImageId];
			const source = $imagesById[sourceImageId];

			const targetUrl = target?.runtimeUri ?? '';
			const sourceUrl = source?.runtimeUri ?? '';

			const targetContentHash = target?.hashes?.contentHash ?? '';
			const sourceContentHash = source?.hashes?.contentHash ?? '';

			activePair =
				targetUrl && sourceUrl && targetContentHash && sourceContentHash
					? {
							groupId: selectedGroup.id,
							targetImageId,
							sourceImageId,
							targetUrl,
							sourceUrl,
							targetContentHash,
							sourceContentHash
						}
					: null;
		}
	}

	$: existingAlignment =
		activePair &&
		($alignments as ImageAlignment[]).find(
			(a) =>
				a.sourceImageId === activePair.sourceImageId && a.targetImageId === activePair.targetImageId
		);

	/* -------------------------------------------------
	   Save from tools
	   method = strategy (records which approach produced the transform)
	------------------------------------------------- */

	function saveFromTool(draft: {
		confidence?: number;
		transform: ImageAlignment['transform'];
		methodData?: Record<string, any>;
	}) {
		if (!activePair) return;

		const next: ImageAlignment = {
			sourceImageId: activePair.sourceImageId,
			targetImageId: activePair.targetImageId,
			sourceContentHash: activePair.sourceContentHash,
			targetContentHash: activePair.targetContentHash,
			confidence: draft.confidence ?? 0.8,
			method: strategy,
			transform: draft.transform
			// If you add methodData to schema + types, include it here:
			// methodData: draft.methodData
		} as any;

		upsertAlignment(next);
	}
</script>

<div class="align-layout">
	<SidePanel side="left" bind:open={LeftPanelOpen}>
		<div class="panel-header">
			<div class="header-row">
				<div class="panel-title">Groups</div>
			</div>
		</div>

		<div class="panel-body">
			{#if $groups.length === 0}
				<div class="empty">No groups yet</div>
			{:else}
				<div class="group-list">
					{#each $groups as group, idx (`${group.id}:${idx}`)}
						{@const base = $imagesById[group.baseImageId]}
						<button
							type="button"
							class="group-row"
							class:selected={group.id === selectedGroupId}
							on:click={() => selectGroup(group.id)}
						>
							<div class="thumb">
								{#if base}
									<ImageThumbnail
										contentHash={base.hashes?.contentHash ?? ''}
										fallbackSrc={base.runtimeUri}
										label={base.label}
										mode="thumb"
									/>
								{:else}
									<div class="thumb-fallback" aria-hidden="true" />
								{/if}
							</div>

							<div class="info">
								<div class="title">
									Group <span class="count">{group.imageIds.length}</span>
								</div>
								<div class="subtitle">{base?.label ?? 'Base image'}</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</SidePanel>

	<div class="workspace">
		<AlignToolbar {strategy} onChange={(s) => (strategy = s)}>
			<svelte:fragment slot="right">
				{#if activePair}
					<div class="pair-meta">
						<span class="pill">target: {activePair.targetImageId.slice(0, 8)}</span>
						<span class="pill">source: {activePair.sourceImageId.slice(0, 8)}</span>
						<span class="pill">method: {strategy}</span>
					</div>
				{/if}
			</svelte:fragment>
		</AlignToolbar>

		<div class="tool-area">
			{#if !activePair}
				<div class="empty-main">Select a group to start aligning</div>
			{:else}
				{#key `${activePair.sourceImageId}:${activePair.targetImageId}:${strategy}`}
					{#if strategy === 'manual'}
						<ManualAlignTool
							targetUrl={activePair.targetUrl}
							sourceUrl={activePair.sourceUrl}
							existingAlignment={existingAlignment ?? null}
							onSave={saveFromTool}
						/>
					{:else if strategy === 'keypoints'}
						<KeypointAlignTool
							targetUrl={activePair.targetUrl}
							sourceUrl={activePair.sourceUrl}
							existingAlignment={existingAlignment ?? null}
							onSave={saveFromTool}
						/>
					{:else}
						<div class="tool-stub">
							<div class="stub-title">{strategy} tool</div>
							<div class="stub-body">Not implemented yet — the workspace is wired and ready.</div>
						</div>
					{/if}
				{/key}
			{/if}
		</div>
	</div>
</div>

<style>
	.align-layout {
		display: flex;
		height: 100%;
		min-height: 0;
	}

	/* Left panel */
	.panel-header {
		padding: 0.4rem 0.75rem 0.4rem 1.75rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		line-height: 1;
		margin: 0;
	}

	.panel-body {
		padding: 0.5rem;
	}

	.empty {
		padding: 0.5rem;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.group-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.group-row {
		all: unset;
		cursor: pointer;
		display: grid;
		grid-template-columns: 44px 1fr;
		gap: 0.6rem;
		align-items: center;
		padding: 0.5rem;
		border-radius: 8px;
	}

	.group-row:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.group-row.selected {
		background: rgba(0, 0, 0, 0.08);
	}

	.thumb {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.1);
		background: white;
	}

	.thumb-fallback {
		width: 100%;
		height: 100%;
		background: repeating-linear-gradient(
			45deg,
			rgba(0, 0, 0, 0.06),
			rgba(0, 0, 0, 0.06) 6px,
			rgba(0, 0, 0, 0.02) 6px,
			rgba(0, 0, 0, 0.02) 12px
		);
	}

	.info {
		min-width: 0;
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-weight: 600;
		color: #0f172a;
		font-size: 0.85rem;
	}

	.count {
		font-weight: 600;
		color: #334155;
		font-size: 0.8rem;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
	}

	.subtitle {
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Workspace */
	.workspace {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: #eee;
	}

	.tool-area {
		flex: 1;
		min-height: 0;
		padding: 0.75rem;
		overflow: auto;
	}

	.empty-main {
		height: 100%;
		display: grid;
		place-items: center;
		color: #6b7280;
		font-size: 0.9rem;
		padding: 2rem;
		text-align: center;
	}

	.pair-meta {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.pill {
		font-size: 0.72rem;
		color: #334155;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
	}

	.tool-stub {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.75rem;
		min-height: 240px;
		display: grid;
		place-items: center;
		gap: 0.25rem;
	}

	.stub-title {
		font-weight: 700;
		color: #111827;
	}

	.stub-body {
		color: #6b7280;
		font-size: 0.9rem;
		text-align: center;
	}
</style>
