<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { images, project, updateProjectUI } from '$lib/core/projectStore';

	import SidePanel from '$lib/ui/shared/SidePanel.svelte';
	import FilterSegment from '$lib/ui/shared/FilterSegment.svelte';

	import PrepareItemCell from './DewarpItemCell.svelte';
	import DewarpToolRowsOSD, { type DewarpMesh } from './DewarpToolRowsOSD.svelte';
	import DewarpToolSpineOSD from './DewarpToolSpineOSD.svelte';

	const filterOptions = [{ value: 'all', label: 'All' }] as const;
	type FilterMode = (typeof filterOptions)[number]['value'];

	let filter: FilterMode = 'all';
	let selectedId: string | null = null;
	let sidePanelOpen = true;

	$: totalCount = $images.length;

	$: selectedImage = selectedId ? ($images.find((img) => img.id === selectedId) ?? null) : null;

	$: imageUrl = selectedImage
		? (selectedImage.runtimeUri ?? selectedImage.originalUri ?? selectedImage.uri)
		: null;

	// Init selection (like PrepareWorkspace)
	$: {
		if ($images.length === 0) {
			selectedId = null;
		} else if (!selectedId) {
			const last = $project.ui?.lastSelectedImageId;
			if (last && $images.some((i) => i.id === last)) selectedId = last;
			else selectedId = $images[0].id;
		}
	}

	function selectImage(id: string) {
		selectedId = id;
		updateProjectUI({ lastSelectedImageId: id });
	}

	/* -------------------------------------------------
	   Preview (piecewise affine mesh warp)
	------------------------------------------------- */

	let previewWrap: HTMLDivElement | null = null;
	let previewCanvas: HTMLCanvasElement | null = null;
	let previewCtx: CanvasRenderingContext2D | null = null;

	let previewImg: HTMLImageElement | null = null;
	let previewImgUrl: string | null = null;

	let liveMesh: DewarpMesh | null = null;

	let previewRaf = 0;
	let ro: ResizeObserver | null = null;

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

	async function ensurePreviewImage(url: string) {
		if (previewImg && previewImgUrl === url) return previewImg;

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.decoding = 'async';
		img.src = url;

		await img.decode();

		previewImg = img;
		previewImgUrl = url;
		return img;
	}

	function schedulePreview() {
		if (previewRaf) return;
		previewRaf = requestAnimationFrame(() => {
			previewRaf = 0;
			void drawPreview();
		});
	}

	async function drawPreview() {
		if (!previewCanvas || !previewWrap || !previewCtx) return;
		if (!imageUrl || !liveMesh) return;

		const img = await ensurePreviewImage(imageUrl);

		const w = Math.max(1, Math.floor(previewWrap.clientWidth));
		const h = Math.max(1, Math.floor(previewWrap.clientHeight));
		if (previewCanvas.width !== w) previewCanvas.width = w;
		if (previewCanvas.height !== h) previewCanvas.height = h;

		const ctx = previewCtx;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, w, h);
		ctx.imageSmoothingEnabled = true;

		const { rows, cols, points } = liveMesh;
		if (points.length !== rows * cols) return;

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

		let outW = w;
		let outH = Math.floor(outW / aspect);
		if (outH > h) {
			outH = h;
			outW = Math.floor(outH * aspect);
		}

		const offX = Math.floor((w - outW) / 2);
		const offY = Math.floor((h - outH) / 2);

		function destNode(r: number, c: number) {
			const u = cols === 1 ? 0.5 : c / (cols - 1);
			const v = rows === 1 ? 0.5 : r / (rows - 1);
			return { x: offX + u * outW, y: offY + v * outH };
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
	}

	function handleMeshChange(mesh: DewarpMesh) {
		liveMesh = mesh;
		schedulePreview();
	}

	function handleConfirm(mesh: DewarpMesh) {
		console.log('DEWARP STUB', selectedImage?.id, mesh);
		liveMesh = mesh;
		schedulePreview();
	}

	onMount(() => {
		previewCtx = previewCanvas?.getContext('2d') ?? null;

		ro = new ResizeObserver(() => schedulePreview());
		if (previewWrap) ro.observe(previewWrap);
	});

	$: if (ro && previewWrap) {
		ro.disconnect();
		ro.observe(previewWrap);
	}

	onDestroy(() => {
		if (previewRaf) cancelAnimationFrame(previewRaf);
		ro?.disconnect();
	});
</script>

<div class="dewarp-layout">
	<SidePanel side="left" bind:open={sidePanelOpen} width={280}>
		<svelte:fragment slot="header">
			<div class="panel-header">
				<div class="header-row">
					<div class="panel-title">Images ({totalCount})</div>

					<FilterSegment
						options={filterOptions as any}
						value={filter}
						onChange={(v) => (filter = v as FilterMode)}
					/>
				</div>
			</div>
		</svelte:fragment>

		<div class="panel-body">
			<div class="image-list">
				{#each $images as img}
					<PrepareItemCell
						image={img}
						selected={img.id === selectedId}
						onSelect={() => selectImage(img.id)}
					/>
				{/each}
			</div>
		</div>
	</SidePanel>

	<div class="workspace">
		{#if selectedImage && imageUrl}
			<div class="main">
				<div class="osd">
					<!-- <DewarpToolRowsOSD
						{imageUrl}
						rows={12}
						cols={10}
						onMeshChange={handleMeshChange}
						onConfirm={handleConfirm}
					/> -->
					<DewarpToolSpineOSD
						{imageUrl}
						rows={14}
						cols={12}
						onMeshChange={handleMeshChange}
						onConfirm={handleConfirm}
					/>
				</div>

				<div class="preview" bind:this={previewWrap}>
					<div class="preview-title">Preview</div>
					<canvas class="preview-canvas" bind:this={previewCanvas}></canvas>
				</div>
			</div>
		{:else}
			<div class="placeholder">Select an image to dewarp</div>
		{/if}
	</div>
</div>

<style>
	.dewarp-layout {
		display: flex;
		height: 100%;
		min-height: 0;
	}

	.workspace {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.main {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 420px;
	}

	.osd {
		min-width: 0;
		min-height: 0;
	}

	.preview {
		border-left: 1px solid rgba(0, 0, 0, 0.08);
		background: #0b0b0b;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.preview-title {
		padding: 0.5rem 0.75rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.7);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.preview-canvas {
		flex: 1;
		width: 100%;
		height: 100%;
		display: block;
	}

	.placeholder {
		padding: 2rem;
		color: #6b7280;
	}
</style>
