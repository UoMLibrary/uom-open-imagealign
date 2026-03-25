<script lang="ts">
	import type OpenSeadragon from 'openseadragon';
	import CompareViewerOpacitySlider from './CompareViewerOpacitySlider.svelte';

	type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right';
	type AnnotationMode = 'pan' | 'rectangle' | 'polygon';

	type Props = {
		viewer?: OpenSeadragon.Viewer | null;
		zoomStep?: number;

		position?: ToolbarPosition;
		collapsed?: boolean;

		overlayOpacity?: number;

		showAnnotationControls?: boolean;
		annotationsVisible?: boolean;
		annotationMode?: AnnotationMode;

		canUsePan?: boolean;
		canUseRectangle?: boolean;
		canUsePolygon?: boolean;

		onOverlayOpacityChange?: (value: number) => void;
		onModeChange?: (mode: AnnotationMode) => void;
		onAnnotationsVisibleChange?: (visible: boolean) => void;
		onCollapsedChange?: (collapsed: boolean) => void;
	};

	let {
		viewer = null,
		zoomStep = 1.2,

		position = 'left',
		collapsed = $bindable(false),

		overlayOpacity = $bindable(0.6),

		showAnnotationControls = false,
		annotationsVisible = $bindable(true),
		annotationMode = $bindable<AnnotationMode>('pan'),

		canUsePan = true,
		canUseRectangle = true,
		canUsePolygon = true,

		onOverlayOpacityChange,
		onModeChange,
		onAnnotationsVisibleChange,
		onCollapsedChange
	}: Props = $props();

	const isVertical = $derived(position === 'left' || position === 'right');

	function home() {
		viewer?.viewport?.goHome?.();
	}

	function zoomIn() {
		if (!viewer?.viewport) return;
		const current = viewer.viewport.getZoom(true);
		viewer.viewport.zoomTo(current * zoomStep);
	}

	function zoomOut() {
		if (!viewer?.viewport) return;
		const current = viewer.viewport.getZoom(true);
		viewer.viewport.zoomTo(current / zoomStep);
	}

	function setCollapsed(next: boolean) {
		collapsed = next;
		onCollapsedChange?.(next);
	}

	function toggleCollapsed() {
		setCollapsed(!collapsed);
	}

	function setMode(next: AnnotationMode) {
		if (!annotationsVisible) return;
		annotationMode = next;
		onModeChange?.(next);
	}

	function setAnnotationsVisible(next: boolean) {
		annotationsVisible = next;
		onAnnotationsVisibleChange?.(next);
	}

	function toggleAnnotationsVisible() {
		setAnnotationsVisible(!annotationsVisible);
	}

	function setOpacity(next: number) {
		overlayOpacity = next;
		onOverlayOpacityChange?.(next);
	}
</script>

<div
	class="toolbar"
	class:vertical={isVertical}
	class:horizontal={!isVertical}
	class:left={position === 'left'}
	class:right={position === 'right'}
	class:top={position === 'top'}
	class:bottom={position === 'bottom'}
	class:collapsed
>
	<button
		class="collapse-button icon-button"
		type="button"
		aria-label={collapsed ? 'Open toolbar' : 'Collapse toolbar'}
		aria-expanded={!collapsed}
		onclick={toggleCollapsed}
	>
		{#if position === 'left'}
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} /></svg
			>
		{:else if position === 'right'}
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d={collapsed ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg
			>
		{:else if position === 'top'}
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d={collapsed ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} /></svg
			>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d={collapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} /></svg
			>
		{/if}
	</button>

	{#if !collapsed}
		<div class="toolbar-body">
			<div class="group nav-group" aria-label="View controls">
				<button class="icon-button" type="button" aria-label="Zoom in" onclick={zoomIn}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M12 5v14M5 12h14" />
					</svg>
				</button>

				<button class="icon-button" type="button" aria-label="Zoom out" onclick={zoomOut}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M5 12h14" />
					</svg>
				</button>

				<button class="icon-button" type="button" aria-label="Home view" onclick={home}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M4 11.5L12 5l8 6.5" />
						<path d="M7 10.5V19h10v-8.5" />
					</svg>
				</button>
			</div>

			<div class="group fade-group" aria-label="Overlay opacity">
				<button
					class="text-chip"
					type="button"
					aria-label="Show base only"
					onclick={() => setOpacity(0)}
				>
					A
				</button>

				<CompareViewerOpacitySlider
					bind:value={overlayOpacity}
					orientation={isVertical ? 'vertical' : 'horizontal'}
					onChange={setOpacity}
				/>

				<button
					class="text-chip"
					type="button"
					aria-label="Show overlay only"
					onclick={() => setOpacity(1)}
				>
					B
				</button>
			</div>

			{#if showAnnotationControls}
				<div class="group annotation-group" aria-label="Annotation controls">
					<button
						class="icon-button"
						class:active={annotationsVisible}
						type="button"
						aria-label={annotationsVisible ? 'Hide annotations' : 'Show annotations'}
						aria-pressed={annotationsVisible}
						onclick={toggleAnnotationsVisible}
					>
						{#if annotationsVisible}
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
								<circle cx="12" cy="12" r="3.2" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
								<circle cx="12" cy="12" r="3.2" />
								<path d="M4 20L20 4" />
							</svg>
						{/if}
					</button>

					<button
						class="tool-button"
						class:active={annotationMode === 'pan'}
						type="button"
						disabled={!annotationsVisible || !canUsePan}
						onclick={() => setMode('pan')}
					>
						Pan
					</button>

					<button
						class="tool-button"
						class:active={annotationMode === 'rectangle'}
						type="button"
						disabled={!annotationsVisible || !canUseRectangle}
						onclick={() => setMode('rectangle')}
					>
						Rect
					</button>

					<button
						class="tool-button"
						class:active={annotationMode === 'polygon'}
						type="button"
						disabled={!annotationsVisible || !canUsePolygon}
						onclick={() => setMode('polygon')}
					>
						Poly
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.toolbar {
		position: absolute;
		z-index: 30;
		display: flex;
		pointer-events: auto;
		user-select: none;
	}

	.toolbar.left {
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		flex-direction: row;
	}

	.toolbar.right {
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		flex-direction: row-reverse;
	}

	.toolbar.top {
		top: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		flex-direction: column;
	}

	.toolbar.bottom {
		bottom: 0.75rem;
		left: 50%;
		transform: translateX(-50%);
		flex-direction: column-reverse;
	}

	.toolbar-body {
		display: flex;
		gap: 0.55rem;
		padding: 0.55rem;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.96);
		border: 1px solid rgba(15, 23, 42, 0.08);
		box-shadow:
			0 10px 24px rgba(15, 23, 42, 0.12),
			0 2px 6px rgba(15, 23, 42, 0.08);
		backdrop-filter: blur(12px);
	}

	.toolbar.vertical .toolbar-body {
		flex-direction: column;
	}

	.toolbar.horizontal .toolbar-body {
		flex-direction: row;
		align-items: center;
	}

	.group {
		display: flex;
		gap: 0.45rem;
		padding: 0.25rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.95);
		border: 1px solid rgba(15, 23, 42, 0.06);
	}

	.toolbar.vertical .group {
		flex-direction: column;
		align-items: center;
	}

	.toolbar.horizontal .group {
		flex-direction: row;
		align-items: center;
	}

	.icon-button,
	.tool-button,
	.text-chip,
	.collapse-button {
		appearance: none;
		border: none;
		background: transparent;
		margin: 0;
		font: inherit;
		cursor: pointer;
	}

	.icon-button,
	.collapse-button {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.1);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
		color: #0f172a;
	}

	.collapse-button {
		background: rgba(255, 255, 255, 0.96);
		box-shadow:
			0 8px 18px rgba(15, 23, 42, 0.12),
			0 2px 6px rgba(15, 23, 42, 0.06);
	}

	.icon-button:hover,
	.tool-button:hover,
	.text-chip:hover,
	.collapse-button:hover {
		background: rgba(241, 245, 249, 1);
	}

	.icon-button.active,
	.tool-button.active {
		background: #0f172a;
		color: #ffffff;
	}

	.tool-button {
		height: 2.25rem;
		padding: 0 0.8rem;
		border-radius: 10px;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.1);
		font-size: 0.83rem;
		font-weight: 600;
		color: #334155;
	}

	.text-chip {
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.1);
		font-size: 0.78rem;
		font-weight: 700;
		color: #334155;
		display: grid;
		place-items: center;
	}

	button:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}

	button:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	svg {
		width: 18px;
		height: 18px;
		stroke: currentColor;
		stroke-width: 1.8;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
