<script lang="ts">
	type Pt = { x: number; y: number };
	type Pair = { source: Pt; target: Pt };

	export let pairs: Pair[] = [];
	export let maxPairs = 120;

	export let activeIndex: number | null = null;

	export let onSelect: (index: number) => void;
	export let onRemove: (index: number) => void;
	export let onAddCorners: () => void;

	function fmt(n: number) {
		return n.toFixed(4);
	}
</script>

{#if !pairs.length}
	<div class="empty">
		<div class="empty-text">
			No point pairs yet. Click <b>Source</b> to add points (hold Shift if enabled), or start with:
		</div>

		<div class="empty-actions">
			<button class="btn" type="button" on:click={onAddCorners}>Add 4 corner points</button>
		</div>
	</div>
{:else}
	<div class="list" aria-label="Point pairs">
		{#each pairs as p, i (i)}
			<div
				class="row"
				class:active={i === activeIndex}
				role="button"
				tabindex="0"
				on:click={() => onSelect(i)}
				on:keydown={(e) => (e.key === 'Enter' || e.key === ' ' ? onSelect(i) : null)}
			>
				<div class="idx">{i + 1}.</div>

				<div class="stack">
					<div class="line">
						<span class="tag">S</span>
						<span class="mono">({fmt(p.source.x)}, {fmt(p.source.y)})</span>
					</div>

					<div class="line muted">
						<span class="tag">T</span>
						<span class="mono">({fmt(p.target.x)}, {fmt(p.target.y)})</span>
					</div>
				</div>

				<button
					class="icon-btn"
					type="button"
					on:click|stopPropagation={() => onRemove(i)}
					aria-label="Remove pair {i + 1}"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
						<path
							d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9zm1 12h8a2 2 0 0 0 2-2V7H6v12a2 2 0 0 0 2 2z"
							fill="currentColor"
						/>
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.btn {
		all: unset;
		cursor: pointer;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: white;
		color: #0f172a;
	}
	.btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.empty {
		color: #334155;
		font-size: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.empty-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: grid;
		grid-template-columns: 34px 1fr 30px;
		align-items: center;
		gap: 8px;

		padding: 6px 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(0, 0, 0, 0.06);
		cursor: pointer;

		user-select: none;
	}

	.row:focus-visible {
		outline: 2px solid rgba(2, 132, 199, 0.55);
		outline-offset: 2px;
	}

	.row.active {
		outline: 2px solid rgba(2, 132, 199, 0.35);
	}

	.idx {
		font-weight: 800;
		color: #334155;
		text-align: right;
	}

	/* NEW: vertical stack for S/T */
	.stack {
		display: grid;
		grid-auto-rows: min-content;
		gap: 2px;
		min-width: 0;
	}

	.line {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		color: #0f172a;
		font-size: 0.78rem;
	}

	.line.muted {
		opacity: 0.75;
	}

	.tag {
		font-weight: 800;
		color: #334155;
	}

	.mono {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.7rem;
	}

	.icon-btn {
		all: unset;
		cursor: pointer;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		color: rgba(124, 45, 18, 0.9);
		background: rgba(251, 191, 36, 0.15);
		border: 1px solid rgba(124, 45, 18, 0.16);
	}

	.icon-btn:hover {
		background: rgba(251, 191, 36, 0.25);
	}
</style>
