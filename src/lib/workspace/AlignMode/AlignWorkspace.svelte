<script lang="ts">
	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import ImageThumbnail from '$lib/ui/shared/ImageThumbnail.svelte';

	import { groups, imagesById, alignments } from '$lib/core/projectStore';

	let LeftPanelOpen = true;

	/* -------------------------------------------------
	   Strategy toolbar scaffold
	------------------------------------------------- */

	type AlignStrategy = 'manual' | 'keypoints' | 'affine';

	const STRATEGIES: { id: AlignStrategy; label: string; hint: string }[] = [
		{ id: 'manual', label: 'Manual', hint: 'Drag / nudge into place' },
		{ id: 'keypoints', label: 'Keypoints', hint: 'Auto match features (later)' },
		{ id: 'affine', label: 'Affine', hint: 'Corner/warp (later)' }
	];

	let strategy: AlignStrategy = 'manual';

	/* -------------------------------------------------
	   Group selection
	------------------------------------------------- */

	let selectedGroupId: string | null = null;

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
	   Active alignment pair (target = base image)
	   For now we align "work images" (runtimeUri).
------------------------------------------------- */

	type ActivePair = {
		groupId: string;
		targetImageId: string;
		sourceImageId: string;
		targetUrl: string;
		sourceUrl: string;
	};

	let activePair: ActivePair | null = null;

	$: {
		if (!selectedGroup || selectedGroup.imageIds.length === 0) {
			activePair = null;
		} else {
			const targetImageId = selectedGroup.baseImageId ?? selectedGroup.imageIds[0];

			// Pick a "source" that isn't the base if possible
			const firstNonBase =
				selectedGroup.imageIds.find((id) => id !== targetImageId) ?? targetImageId;

			const targetUrl = $imagesById[targetImageId]?.runtimeUri ?? '';
			const sourceUrl = $imagesById[firstNonBase]?.runtimeUri ?? '';

			activePair =
				targetUrl && sourceUrl
					? {
							groupId: selectedGroup.id,
							targetImageId,
							sourceImageId: firstNonBase,
							targetUrl,
							sourceUrl
						}
					: null;
		}
	}

	/* -------------------------------------------------
	   Alignment persistence scaffold
	   Upsert by (sourceImageId, targetImageId)
------------------------------------------------- */

	function saveAlignment(data: unknown) {
		if (!activePair) return;

		const { sourceImageId, targetImageId } = activePair;

		alignments.update((list) => {
			const idx = list.findIndex(
				(a: any) => a.sourceImageId === sourceImageId && a.targetImageId === targetImageId
			);

			const nextAlignment = {
				// These two fields definitely exist (used elsewhere in projectStore)
				sourceImageId,
				targetImageId,

				// Everything else is scaffold / flexible until your ImageAlignment type is final
				strategy,
				data,
				updatedAt: Date.now()
			} as any;

			if (idx !== -1) {
				const next = [...(list as any[])];
				next[idx] = { ...(next[idx] as any), ...nextAlignment };
				return next as any;
			}

			return [...(list as any[]), nextAlignment] as any;
		});
	}

	$: existingAlignment =
		activePair &&
		($alignments as any[]).find(
			(a) =>
				a.sourceImageId === activePair.sourceImageId && a.targetImageId === activePair.targetImageId
		);
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
		<!-- Toolbar (strategy selection) -->
		<div class="toolbar">
			<div class="toolbar-left">
				<div class="toolbar-title">Alignment</div>
				<div class="segmented">
					{#each STRATEGIES as s (s.id)}
						<button
							type="button"
							class="seg-btn"
							class:active={strategy === s.id}
							title={s.hint}
							on:click={() => (strategy = s.id)}
						>
							{s.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="toolbar-right">
				{#if activePair}
					<div class="pair-meta">
						<span class="pill">target: {activePair.targetImageId.slice(0, 8)}</span>
						<span class="pill">source: {activePair.sourceImageId.slice(0, 8)}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Tool area -->
		<div class="tool-area">
			{#if !activePair}
				<div class="empty-main">Select a group to start aligning</div>
			{:else if strategy === 'manual'}
				<div class="tool-shell">
					<div class="tool-header">
						<div class="tool-name">Manual alignment (placeholder)</div>
						<button
							type="button"
							class="save-btn"
							on:click={() =>
								saveAlignment({
									kind: 'placeholder',
									note: 'Saved from manual tool scaffold',
									// Example: identity transform placeholder
									transform: { type: 'identity' }
								})}
						>
							Save alignment
						</button>
					</div>

					<div class="tool-content">
						<div class="img-pane">
							<div class="pane-title">Target (base)</div>
							<img src={activePair.targetUrl} alt="Target image" />
						</div>

						<div class="img-pane">
							<div class="pane-title">Source (to align)</div>
							<img src={activePair.sourceUrl} alt="Source image" />
						</div>
					</div>

					{#if existingAlignment}
						<details class="debug">
							<summary>Existing alignment (debug)</summary>
							<pre>{JSON.stringify(existingAlignment, null, 2)}</pre>
						</details>
					{/if}
				</div>
			{:else}
				<div class="tool-shell">
					<div class="tool-header">
						<div class="tool-name">{STRATEGIES.find((s) => s.id === strategy)?.label} (stub)</div>
					</div>
					<div class="empty-main">
						This tool isn’t implemented yet — but the workspace structure is ready.
					</div>
				</div>
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

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.75rem;
		background: rgba(255, 255, 255, 0.97);
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.toolbar-title {
		font-weight: 700;
		color: #111827;
		font-size: 0.9rem;
	}

	.segmented {
		display: inline-flex;
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 10px;
		overflow: hidden;
		background: white;
	}

	.seg-btn {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.6rem;
		font-size: 0.8rem;
		color: #0f172a;
	}

	.seg-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.seg-btn.active {
		background: rgba(0, 0, 0, 0.08);
		font-weight: 700;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pair-meta {
		display: flex;
		gap: 0.35rem;
	}

	.pill {
		font-size: 0.72rem;
		color: #334155;
		background: rgba(0, 0, 0, 0.06);
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
	}

	.tool-area {
		flex: 1;
		min-height: 0;
		padding: 0.75rem;
		overflow: auto;
	}

	.tool-shell {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		padding: 0.75rem;
		min-height: 240px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tool-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.tool-name {
		font-weight: 700;
		color: #111827;
		font-size: 0.9rem;
	}

	.save-btn {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: #d1fae5;
		color: #065f46;
		font-weight: 700;
	}

	.save-btn:hover {
		background: #a7f3d0;
	}

	.tool-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		min-height: 0;
	}

	.img-pane {
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 10px;
		background: white;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pane-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		padding: 0.45rem 0.6rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.img-pane img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #f3f4f6;
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

	.debug {
		font-size: 0.8rem;
		color: #334155;
	}

	.debug pre {
		margin: 0.5rem 0 0;
		background: rgba(0, 0, 0, 0.04);
		padding: 0.5rem;
		border-radius: 8px;
		overflow: auto;
		max-height: 220px;
	}
</style>
