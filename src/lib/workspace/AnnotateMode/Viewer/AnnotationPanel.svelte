<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

	export let annotations = [];
	export let selectedAnnotationId = null;
	export let open = true;

	const dispatch = createEventDispatcher();

	function select(id) {
		dispatch('select', id);
	}

	function remove(id) {
		dispatch('delete', id);
	}

	function onKeyDown(e) {
		// Avoid stealing focus from inputs
		if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
			return;
		}

		// Only toggle if there *are* annotations
		if (!annotations.length) return;

		if (e.key === 'Tab') {
			e.preventDefault();
			open = !open;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', onKeyDown);
	});
</script>

<div class="panel" class:collapsed={!open}>
	<aside class:collapsed={!open}>
		<header>
			<strong>Annotations</strong>
		</header>

		{#if open}
			{#if annotations.length === 0}
				<div class="empty">No annotations</div>
			{:else}
				<ul class="list">
					{#each annotations as a}
						<li class:selected={a.id === selectedAnnotationId} on:click={() => select(a.id)}>
							<div class="title">
								{a.type ?? 'Annotation'}
							</div>

							<div class="actions">
								<button title="Delete annotation" on:click|stopPropagation={() => remove(a.id)}>
									🗑
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</aside>

	<!--  Floating toggle -->
	<button
		class="panel-toggle"
		on:click={() => (open = !open)}
		aria-label="Toggle annotations panel"
	>
		{open ? '⟩' : '⟨'}
	</button>
</div>

<style>
	/* Container wrapper */
	.panel {
		position: relative;
		height: 100%;
	}

	/* Aside panel */
	aside {
		position: absolute;
		top: 0;
		right: 0;
		width: 280px;
		height: 100%;
		background: #f9f9f9;
		border-left: 1px solid #ddd;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: width 0.2s ease;
		z-index: 20;
	}

	aside.collapsed {
		width: 0;
		border-left: none;
		background: transparent;
	}

	header {
		padding: 0.5rem;
		background: #eee;
		border-bottom: 1px solid #ddd;
	}

	.empty {
		padding: 1rem;
		color: #777;
		font-size: 0.9rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}

	.list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		cursor: pointer;
		border-bottom: 1px solid #eee;
	}

	.list li.selected {
		background: #dbeafe;
	}

	.list li:hover {
		background: #eef2ff;
	}

	.title {
		font-size: 0.85rem;
	}

	.actions button {
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0.6;
	}

	.actions button:hover {
		opacity: 1;
	}

	/* Toggle button */
	.panel-toggle {
		position: fixed;
		top: 50%;
		right: 0;
		transform: translateY(-50%);
		z-index: 30;

		background: #eee;
		border: 1px solid #ccc;
		border-right: none;
		padding: 0.4rem 0.5rem;
		cursor: pointer;
		border-radius: 4px 0 0 4px;
		opacity: 0.6;
	}

	.panel-toggle:hover {
		opacity: 1;
	}
</style>
