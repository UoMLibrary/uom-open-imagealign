<script lang="ts">
	type Pt = { x: number; y: number };
	type Pair = { source: Pt; target: Pt };

	export let pairs: Pair[] = [];
	export let maxPairs = 120;

	export let activeIndex: number | null = null;

	// Callback props (Svelte 5-friendly)
	export let onSelect: (index: number) => void;
	export let onRemove: (index: number) => void;
	export let onAddCorners: () => void;
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
	<div class="list">
		{#each pairs as p, i (i)}
			<div class="row" class:active={i === activeIndex} on:click={() => onSelect(i)}>
				<div class="idx">{i + 1}</div>

				<div class="coords">
					<div>
						Base:
						<span class="mono">{p.source.x.toFixed(4)}, {p.source.y.toFixed(4)}</span>
					</div>
					<div>
						Move:
						<span class="mono">{p.target.x.toFixed(4)}, {p.target.y.toFixed(4)}</span>
					</div>
				</div>

				<button class="remove" type="button" on:click|stopPropagation={() => onRemove(i)}>
					Remove
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
		grid-template-columns: 34px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(0, 0, 0, 0.06);
		cursor: pointer;
	}

	.row.active {
		outline: 2px solid rgba(2, 132, 199, 0.35);
	}

	.idx {
		font-weight: 800;
		color: #334155;
	}

	.coords {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		font-size: 0.82rem;
		color: #0f172a;
	}

	.mono {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
	}

	.remove {
		all: unset;
		cursor: pointer;
		font-size: 0.78rem;
		padding: 4px 8px;
		border-radius: 8px;
		background: rgba(251, 191, 36, 0.22);
		border: 1px solid rgba(124, 45, 18, 0.18);
		color: #7c2d12;
	}
</style>
