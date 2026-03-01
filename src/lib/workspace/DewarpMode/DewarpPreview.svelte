<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import OpenSeadragon from 'openseadragon';

	export type Pt = { x: number; y: number };
	export type DewarpMesh = { rows: number; cols: number; points: Pt[] };

	export let sourceUrl: string | null = null;
	export let mesh: DewarpMesh | null = null;

	// Guide lines
	export let showGuides = true;
	export let guideCount = 20;

	let guideTop = 0.08;
	let guideBottom = 0.92;

	let hostEl: HTMLDivElement | null = null;
	let viewer: OpenSeadragon.Viewer | null = null;

	let svgEl: SVGSVGElement | null = null;

	let previewUrl: string | null = null;
	let generating = false;
	let pending = false;

	let imgW = 0;
	let imgH = 0;

	let topKnob: HTMLElement | null = null;
	let bottomKnob: HTMLElement | null = null;

	let ro: ResizeObserver | null = null;

	function clamp(v: number, a: number, b: number) {
		return Math.max(a, Math.min(b, v));
	}

	function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function triAffine(
		s0: { x: number; y: number },
		s1: { x: number; y: number },
		s2: { x: number; y: number },
		d0: { x: number; y: number },
		d1: { x: number; y: number },
		d2: { x: number; y: number }
	) {
		const x0 = s0.x,
			y0 = s0.y;
		const x1 = s1.x,
			y1 = s1.y;
		const x2 = s2.x,
			y2 = s2.y;

		const X0 = d0.x,
			Y0 = d0.y;
		const X1 = d1.x,
			Y1 = d1.y;
		const X2 = d2.x,
			Y2 = d2.y;

		const denom = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
		if (Math.abs(denom) < 1e-9) return null;

		const a = (X0 * (y1 - y2) + X1 * (y2 - y0) + X2 * (y0 - y1)) / denom;
		const c = (X0 * (x2 - x1) + X1 * (x0 - x2) + X2 * (x1 - x0)) / denom;
		const e =
			(X0 * (x1 * y2 - x2 * y1) + X1 * (x2 * y0 - x0 * y2) + X2 * (x0 * y1 - x1 * y0)) / denom;

		const b = (Y0 * (y1 - y2) + Y1 * (y2 - y0) + Y2 * (y0 - y1)) / denom;
		const d = (Y0 * (x2 - x1) + Y1 * (x0 - x2) + Y2 * (x1 - x0)) / denom;
		const f =
			(Y0 * (x1 * y2 - x2 * y1) + Y1 * (x2 * y0 - x0 * y2) + Y2 * (x0 * y1 - x1 * y0)) / denom;

		return { a, b, c, d, e, f };
	}

	async function loadImage(url: string) {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.decoding = 'async';
		img.src = url;
		await img.decode();
		return img;
	}

	function getContentSize(v: OpenSeadragon.Viewer) {
		const item = v.world.getItemAt(0);
		if (!item) return null;
		const sz = item.getContentSize();
		return { w: sz.x, h: sz.y };
	}

	function clientToImage(v: OpenSeadragon.Viewer, clientX: number, clientY: number) {
		const rect = v.container.getBoundingClientRect();
		const px = clientX - rect.left;
		const py = clientY - rect.top;
		const pixelPoint = new OpenSeadragon.Point(px, py);
		const vpPoint = v.viewport.pointFromPixel(pixelPoint, true);
		return v.viewport.viewportToImageCoordinates(vpPoint);
	}

	function scheduleGuidesRedraw() {
		requestAnimationFrame(() => redrawGuides());
	}

	function ensureSvgOverlay() {
		if (!viewer || svgEl) return;
		svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svgEl.classList.add('guide-overlay');
		viewer.container.appendChild(svgEl);
	}

	function ensureKnobs() {
		if (!viewer) return;

		if (!topKnob) {
			topKnob = document.createElement('div');
			topKnob.className = 'guide-knob';
			topKnob.title = 'Drag top guide';
			topKnob.addEventListener('pointerdown', (e) => startGuideDrag(e as PointerEvent, 'top'));
		}
		if (!bottomKnob) {
			bottomKnob = document.createElement('div');
			bottomKnob.className = 'guide-knob';
			bottomKnob.title = 'Drag bottom guide';
			bottomKnob.addEventListener('pointerdown', (e) =>
				startGuideDrag(e as PointerEvent, 'bottom')
			);
		}

		// add overlays if not present
		const size = getContentSize(viewer);
		if (!size) return;

		const midX = size.w * 0.5;

		viewer.addOverlay({
			element: topKnob,
			location: viewer.viewport.imageToViewportCoordinates(
				new OpenSeadragon.Point(midX, guideTop * size.h)
			),
			placement: OpenSeadragon.Placement.CENTER
		});

		viewer.addOverlay({
			element: bottomKnob,
			location: viewer.viewport.imageToViewportCoordinates(
				new OpenSeadragon.Point(midX, guideBottom * size.h)
			),
			placement: OpenSeadragon.Placement.CENTER
		});
	}

	function updateKnobPositions() {
		if (!viewer || !topKnob || !bottomKnob) return;
		const size = getContentSize(viewer);
		if (!size) return;

		const midX = size.w * 0.5;

		viewer.updateOverlay(
			topKnob,
			viewer.viewport.imageToViewportCoordinates(new OpenSeadragon.Point(midX, guideTop * size.h)),
			OpenSeadragon.Placement.CENTER
		);
		viewer.updateOverlay(
			bottomKnob,
			viewer.viewport.imageToViewportCoordinates(
				new OpenSeadragon.Point(midX, guideBottom * size.h)
			),
			OpenSeadragon.Placement.CENTER
		);
	}

	function redrawGuides() {
		if (!viewer || !svgEl) return;
		const item = viewer.world.getItemAt(0);
		if (!item) return;

		const size = item.getContentSize();
		imgW = size.x;
		imgH = size.y;

		const rect = viewer.container.getBoundingClientRect();
		svgEl.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);

		while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

		if (!showGuides || guideCount < 2) return;

		const topY = clamp(guideTop, 0, 1);
		const botY = clamp(guideBottom, 0, 1);
		const a = Math.min(topY, botY);
		const b = Math.max(topY, botY);

		for (let i = 0; i < guideCount; i++) {
			const t = i / (guideCount - 1);
			const yNorm = a + t * (b - a);

			const pL = new OpenSeadragon.Point(0, yNorm * imgH);
			const pR = new OpenSeadragon.Point(imgW, yNorm * imgH);

			const vpL = viewer.viewport.imageToViewportCoordinates(pL);
			const vpR = viewer.viewport.imageToViewportCoordinates(pR);

			const pxL = viewer.viewport.pixelFromPoint(vpL, true);
			const pxR = viewer.viewport.pixelFromPoint(vpR, true);

			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', String(pxL.x));
			line.setAttribute('y1', String(pxL.y));
			line.setAttribute('x2', String(pxR.x));
			line.setAttribute('y2', String(pxR.y));
			line.setAttribute(
				'class',
				i === 0 || i === guideCount - 1 ? 'guide-line edge' : 'guide-line'
			);
			svgEl.appendChild(line);
		}

		updateKnobPositions();
	}

	type GuideDrag = { which: 'top' | 'bottom'; pointerId: number; nav: boolean } | null;
	let gdrag: GuideDrag = null;

	function startGuideDrag(e: PointerEvent, which: 'top' | 'bottom') {
		if (!viewer) return;
		e.preventDefault();
		e.stopPropagation();

		(e.target as HTMLElement).setPointerCapture(e.pointerId);

		const nav = (viewer as any).isMouseNavEnabled?.() ?? true;
		viewer.setMouseNavEnabled(false);
		gdrag = { which, pointerId: e.pointerId, nav };

		window.addEventListener('pointermove', onGuideMove, { passive: false });
		window.addEventListener('pointerup', onGuideEnd, { passive: false });
		window.addEventListener('pointercancel', onGuideEnd, { passive: false });
	}

	function onGuideMove(e: PointerEvent) {
		if (!viewer || !gdrag) return;
		if (e.pointerId !== gdrag.pointerId) return;
		e.preventDefault();

		const size = getContentSize(viewer);
		if (!size) return;

		const imgPt = clientToImage(viewer, e.clientX, e.clientY);
		const yNorm = clamp(imgPt.y / size.h, 0, 1);

		if (gdrag.which === 'top') guideTop = yNorm;
		else guideBottom = yNorm;

		scheduleGuidesRedraw();
	}

	function onGuideEnd(e: PointerEvent) {
		if (!viewer || !gdrag) return;
		if (e.pointerId !== gdrag.pointerId) return;

		e.preventDefault();
		viewer.setMouseNavEnabled(gdrag.nav);

		window.removeEventListener('pointermove', onGuideMove);
		window.removeEventListener('pointerup', onGuideEnd);
		window.removeEventListener('pointercancel', onGuideEnd);

		gdrag = null;
	}

	async function generatePreview() {
		if (generating) {
			pending = true;
			return;
		}
		if (!viewer || !sourceUrl || !mesh) return;
		if (mesh.points.length !== mesh.rows * mesh.cols) return;

		generating = true;

		try {
			const img = await loadImage(sourceUrl);

			const { rows, cols, points } = mesh;

			// aspect from corner distances
			const idxTL = 0;
			const idxTR = cols - 1;
			const idxBL = (rows - 1) * cols;
			const idxBR = rows * cols - 1;

			const tl = { x: points[idxTL].x * img.naturalWidth, y: points[idxTL].y * img.naturalHeight };
			const tr = { x: points[idxTR].x * img.naturalWidth, y: points[idxTR].y * img.naturalHeight };
			const bl = { x: points[idxBL].x * img.naturalWidth, y: points[idxBL].y * img.naturalHeight };
			const br = { x: points[idxBR].x * img.naturalWidth, y: points[idxBR].y * img.naturalHeight };

			const srcW = (dist(tl, tr) + dist(bl, br)) / 2;
			const srcH = (dist(tl, bl) + dist(tr, br)) / 2;
			const aspect = srcW > 1 && srcH > 1 ? srcW / srcH : 1;

			// choose output width based on panel size
			const panelW = hostEl?.clientWidth ?? 900;
			const dpr = window.devicePixelRatio || 1;
			const outW = Math.floor(clamp(panelW * dpr, 900, 2400));
			const outH = Math.max(1, Math.floor(outW / aspect));

			const canvas = document.createElement('canvas');
			canvas.width = outW;
			canvas.height = outH;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, outW, outH);
			ctx.imageSmoothingEnabled = true;

			function destNode(r: number, c: number) {
				const u = cols === 1 ? 0.5 : c / (cols - 1);
				const v = rows === 1 ? 0.5 : r / (rows - 1);
				return { x: u * outW, y: v * outH };
			}

			function srcNode(r: number, c: number) {
				const i = r * cols + c;
				return { x: points[i].x * img.naturalWidth, y: points[i].y * img.naturalHeight };
			}

			function drawTri(
				s0: { x: number; y: number },
				s1: { x: number; y: number },
				s2: { x: number; y: number },
				d0: { x: number; y: number },
				d1: { x: number; y: number },
				d2: { x: number; y: number }
			) {
				const m = triAffine(s0, s1, s2, d0, d1, d2);
				if (!m) return;

				ctx.save();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.beginPath();
				ctx.moveTo(d0.x, d0.y);
				ctx.lineTo(d1.x, d1.y);
				ctx.lineTo(d2.x, d2.y);
				ctx.closePath();
				ctx.clip();

				ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
				ctx.drawImage(img, 0, 0);
				ctx.restore();
			}

			for (let r = 0; r < rows - 1; r++) {
				for (let c = 0; c < cols - 1; c++) {
					const s00 = srcNode(r, c);
					const s10 = srcNode(r, c + 1);
					const s01 = srcNode(r + 1, c);
					const s11 = srcNode(r + 1, c + 1);

					const d00 = destNode(r, c);
					const d10 = destNode(r, c + 1);
					const d01 = destNode(r + 1, c);
					const d11 = destNode(r + 1, c + 1);

					drawTri(s00, s10, s01, d00, d10, d01);
					drawTri(s10, s11, s01, d10, d11, d01);
				}
			}

			const blob: Blob = await new Promise((resolve, reject) =>
				canvas.toBlob(
					(b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
					'image/jpeg',
					0.92
				)
			);

			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(blob);

			viewer.open({ type: 'image', url: previewUrl });
			viewer.addOnceHandler('open', () => {
				ensureSvgOverlay();
				ensureKnobs();
				scheduleGuidesRedraw();
			});
		} finally {
			generating = false;
			if (pending) {
				pending = false;
				void generatePreview();
			}
		}
	}

	// reactive trigger
	$: if (viewer && sourceUrl && mesh) {
		void generatePreview();
	}

	onMount(() => {
		if (!hostEl) return;

		viewer = OpenSeadragon({
			element: hostEl,
			prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@5.0/build/openseadragon/images/',
			showNavigator: true,
			autoResize: true,
			crossOriginPolicy: 'Anonymous',
			keyboardNavEnabled: false,
			gestureSettingsKeyboard: { rotate: false },
			gestureSettingsMouse: {
				dragToPan: true,
				clickToZoom: false,
				scrollToZoom: true,
				dblClickToZoom: false,
				pinchToZoom: true,
				dragToPanButton: true
			},
			showFullPageControl: false,
			showHomeControl: true,
			showZoomControl: true
		});

		ensureSvgOverlay();

		const redraw = () => scheduleGuidesRedraw();
		viewer.addHandler('animation', redraw);
		viewer.addHandler('zoom', redraw);
		viewer.addHandler('pan', redraw);
		viewer.addHandler('resize', redraw);

		ro = new ResizeObserver(() => {
			// (optional) could regenerate at new size; for now just redraw guides
			scheduleGuidesRedraw();
		});
		ro.observe(hostEl);
	});

	onDestroy(() => {
		ro?.disconnect();
		try {
			viewer?.destroy();
		} catch {}
		viewer = null;

		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});
</script>

<div class="shell">
	<div class="viewer" bind:this={hostEl}></div>

	<div class="toolbar">
		<label><input type="checkbox" bind:checked={showGuides} /> Guides</label>
		<label>
			Lines
			<input
				type="number"
				min="2"
				max="80"
				step="1"
				bind:value={guideCount}
				on:input={scheduleGuidesRedraw}
			/>
		</label>
	</div>
</div>

<style>
	.shell {
		position: relative;
		width: 100%;
		height: 100%;
		background: #0b0b0b;
		overflow: hidden;
	}

	.viewer {
		position: absolute;
		inset: 0;
	}

	.toolbar {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 50;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		background: rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(4px);
		padding: 0.35rem 0.5rem;
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.9);
	}

	.toolbar label {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.82rem;
	}

	.toolbar input[type='number'] {
		width: 72px;
	}

	:global(svg.guide-overlay) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 40;
	}

	:global(.guide-line) {
		stroke: rgba(255, 255, 255, 0.3);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	:global(.guide-line.edge) {
		stroke: rgba(255, 255, 255, 0.65);
		stroke-width: 2;
	}

	:global(.guide-knob) {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		border: 2px solid rgba(255, 255, 255, 0.9);
		background: rgba(76, 159, 254, 0.85);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
		cursor: ns-resize;
		touch-action: none;
	}
</style>
