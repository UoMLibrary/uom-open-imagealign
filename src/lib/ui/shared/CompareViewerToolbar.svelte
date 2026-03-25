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
	class:left={position === 'left'}
	class:right={position === 'right'}
	class:top={position === 'top'}
	class:bottom={position === 'bottom'}
	class:vertical={isVertical}
	class:horizontal={!isVertical}
>
	<div class="toolbar-shell" class:collapsed-shell={collapsed}>
		<div class="toolbar-body">
			<button
				class="icon-button collapse-button"
				type="button"
				aria-label={collapsed ? 'Open toolbar' : 'Collapse toolbar'}
				aria-expanded={!collapsed}
				onclick={toggleCollapsed}
			>
				{#if position === 'left'}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
					</svg>
				{:else if position === 'right'}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d={collapsed ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
					</svg>
				{:else if position === 'top'}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d={collapsed ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d={collapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
					</svg>
				{/if}
			</button>

			{#if !collapsed}
				<div class="group nav-group" aria-label="View controls">
					<button
						class="icon-button"
						type="button"
						aria-label="Home view"
						disabled={!viewer}
						onclick={home}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M4 11.5L12 5l8 6.5" />
							<path d="M7 10.5V19h10v-8.5" />
						</svg>
					</button>

					<button
						class="icon-button"
						type="button"
						aria-label="Zoom in"
						disabled={!viewer}
						onclick={zoomIn}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 5v14M5 12h14" />
						</svg>
					</button>

					<button
						class="icon-button"
						type="button"
						aria-label="Zoom out"
						disabled={!viewer}
						onclick={zoomOut}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M5 12h14" />
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
							class="icon-button tool-icon"
							class:active={annotationMode === 'pan'}
							type="button"
							disabled={!annotationsVisible || !canUsePan}
							aria-label="Pan mode"
							aria-pressed={annotationMode === 'pan'}
							onclick={() => setMode('pan')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M12 8v8" />
								<path d="M8 12h8" />

								<path d="M12 4l-2 2" />
								<path d="M12 4l2 2" />

								<path d="M12 20l-2-2" />
								<path d="M12 20l2-2" />

								<path d="M4 12l2-2" />
								<path d="M4 12l2 2" />

								<path d="M20 12l-2-2" />
								<path d="M20 12l-2 2" />
							</svg>
						</button>

						<button
							class="icon-button tool-icon"
							class:active={annotationMode === 'rectangle'}
							type="button"
							disabled={!annotationsVisible || !canUseRectangle}
							aria-label="Rectangle mode"
							aria-pressed={annotationMode === 'rectangle'}
							onclick={() => setMode('rectangle')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<rect x="5" y="7" width="14" height="10" rx="1.5" />
							</svg>
						</button>

						<button
							class="icon-button tool-icon"
							class:active={annotationMode === 'polygon'}
							type="button"
							disabled={!annotationsVisible || !canUsePolygon}
							aria-label="Polygon mode"
							aria-pressed={annotationMode === 'polygon'}
							onclick={() => setMode('polygon')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M7 17l3-9 8 3-2 7z" />
								<circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
								<circle cx="18" cy="11" r="1" fill="currentColor" stroke="none" />
								<circle cx="16" cy="18" r="1" fill="currentColor" stroke="none" />
								<circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
							</svg>
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.toolbar {
		position: absolute;
		z-index: 30;
		pointer-events: auto;
		user-select: none;
	}

	.toolbar.left {
		left: 0.15rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.toolbar.right {
		right: 0.15rem;
		top: 50%;
		transform: translateY(-50%);
	}

	.toolbar.top {
		top: 0.15rem;
		left: 50%;
		transform: translateX(-50%);
	}

	.toolbar.bottom {
		bottom: 0.15rem;
		left: 50%;
		transform: translateX(-50%);
	}

	.toolbar-shell {
		padding: 0.3rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(15, 23, 42, 0.06);
		box-shadow:
			0 8px 20px rgba(15, 23, 42, 0.11),
			0 2px 5px rgba(15, 23, 42, 0.06);
		backdrop-filter: blur(10px);
	}

	.toolbar-shell.collapsed-shell {
		padding: 0;
		border: none;
		background: transparent;
		box-shadow: none;
		backdrop-filter: none;
	}

	.toolbar-body {
		display: flex;
		gap: 0.35rem;
	}

	.vertical .toolbar-body {
		flex-direction: column;
		width: 44px;
	}

	.horizontal .toolbar-body {
		flex-direction: row;
		align-items: center;
	}

	.group {
		display: flex;
		gap: 0.3rem;
		padding: 0.28rem;
		border-radius: 12px;
		background: rgba(248, 250, 252, 0.96);
		border: 1px solid rgba(15, 23, 42, 0.045);
	}

	.vertical .group {
		flex-direction: column;
		align-items: center;
		width: 100%;
	}

	.horizontal .group {
		flex-direction: row;
		align-items: center;
	}

	.fade-group {
		gap: 0.4rem;
		padding-top: 0.35rem;
		padding-bottom: 0.35rem;
	}

	.icon-button,
	.text-chip {
		appearance: none;
		border: none;
		background: transparent;
		margin: 0;
		font: inherit;
		cursor: pointer;
	}

	.icon-button {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.09);
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
		color: #0f172a;
	}

	.icon-button:hover,
	.text-chip:hover {
		background: rgba(241, 245, 249, 1);
	}

	.icon-button.active {
		background: #0f172a;
		color: #ffffff;
	}

	.collapse-button {
		align-self: center;
	}

	.text-chip {
		width: 24px;
		height: 24px;
		border-radius: 7px;
		background: #ffffff;
		border: 1px solid rgba(15, 23, 42, 0.1);
		font-size: 0.68rem;
		font-weight: 700;
		color: #334155;
		display: grid;
		place-items: center;
		line-height: 1;
		flex: 0 0 auto;
	}

	.tool-icon {
		border-radius: 9px;
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

	.collapse-button svg {
		width: 16px;
		height: 16px;
	}

	.tool-icon svg {
		width: 19px;
		height: 19px;
	}
</style>
