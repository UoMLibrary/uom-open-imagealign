<script lang="ts">
	import { onDestroy } from 'svelte';

	type ImageMeta = {
		name: string;
		size: number;
		type: string;
		width: number;
		height: number;
	};

	type Box = {
		x: number;
		y: number;
		w: number;
		h: number;
		pixels: number;
	};

	type PresetName = 'conservative' | 'balanced' | 'aggressive';

	let baseFile: File | null = null;
	let warpedFile: File | null = null;

	let baseUrl: string | null = null;
	let warpedUrl: string | null = null;
	let maskUrl: string | null = null;

	let baseMeta: ImageMeta | null = null;
	let warpedMeta: ImageMeta | null = null;

	let baseInput: HTMLInputElement | null = null;
	let warpedInput: HTMLInputElement | null = null;

	let boxes: Box[] = [];
	let selectedBoxIndex: number | null = null;

	let running = false;
	let error: string | null = null;

	let presetName: PresetName = 'balanced';

	// Main tuning
	let maxWorkDim = 1400;
	let blurPx = 7;
	let diffThreshold = 46;
	let inkThreshold = 16;

	// Grouping
	let joinLettersX = 18;
	let joinLettersY = 3;
	let cleanNoiseX = 4;
	let cleanNoiseY = 1;

	// Box cleanup
	let minChangedPixels = 22;
	let minBoxArea = 160;
	let boxPadding = 8;
	let mergeNearbyGap = 18;

	// View options
	let showMaskPreview = true;
	let showBoxLabels = true;

	$: selectedBox = selectedBoxIndex != null ? (boxes[selectedBoxIndex] ?? null) : null;

	function applyPreset(name: PresetName) {
		presetName = name;

		if (name === 'conservative') {
			maxWorkDim = 1400;
			blurPx = 7;
			diffThreshold = 58;
			inkThreshold = 22;
			joinLettersX = 14;
			joinLettersY = 2;
			cleanNoiseX = 4;
			cleanNoiseY = 1;
			minChangedPixels = 30;
			minBoxArea = 220;
			boxPadding = 8;
			mergeNearbyGap = 12;
			return;
		}

		if (name === 'aggressive') {
			maxWorkDim = 1600;
			blurPx = 7;
			diffThreshold = 36;
			inkThreshold = 12;
			joinLettersX = 22;
			joinLettersY = 4;
			cleanNoiseX = 4;
			cleanNoiseY = 1;
			minChangedPixels = 10;
			minBoxArea = 90;
			boxPadding = 10;
			mergeNearbyGap = 24;
			return;
		}

		// balanced
		maxWorkDim = 1400;
		blurPx = 7;
		diffThreshold = 46;
		inkThreshold = 16;
		joinLettersX = 18;
		joinLettersY = 3;
		cleanNoiseX = 4;
		cleanNoiseY = 1;
		minChangedPixels = 22;
		minBoxArea = 160;
		boxPadding = 8;
		mergeNearbyGap = 18;
	}

	function resetTuning() {
		applyPreset('balanced');
	}

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	async function readMeta(file: File): Promise<ImageMeta> {
		const bitmap = await createImageBitmap(file);

		try {
			return {
				name: file.name,
				size: file.size,
				type: file.type || 'unknown',
				width: bitmap.width,
				height: bitmap.height
			};
		} finally {
			bitmap.close();
		}
	}

	function clearMask() {
		if (maskUrl) {
			URL.revokeObjectURL(maskUrl);
			maskUrl = null;
		}
	}

	function clearResults() {
		error = null;
		boxes = [];
		selectedBoxIndex = null;
		clearMask();
	}

	async function setFile(kind: 'base' | 'warped', file: File | null) {
		clearResults();

		if (kind === 'base') {
			if (baseUrl) URL.revokeObjectURL(baseUrl);
			baseFile = null;
			baseUrl = null;
			baseMeta = null;
		} else {
			if (warpedUrl) URL.revokeObjectURL(warpedUrl);
			warpedFile = null;
			warpedUrl = null;
			warpedMeta = null;
		}

		if (!file) return;

		const url = URL.createObjectURL(file);
		const meta = await readMeta(file);

		if (kind === 'base') {
			baseFile = file;
			baseUrl = url;
			baseMeta = meta;
		} else {
			warpedFile = file;
			warpedUrl = url;
			warpedMeta = meta;
		}
	}

	async function onBaseChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		await setFile('base', file);
	}

	async function onWarpedChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		await setFile('warped', file);
	}

	function clearBase() {
		if (baseInput) baseInput.value = '';
		void setFile('base', null);
	}

	function clearWarped() {
		if (warpedInput) warpedInput.value = '';
		void setFile('warped', null);
	}

	let canRun = false;

	$: canRun = !!baseFile && !!warpedFile && !!baseMeta && !!warpedMeta && !running;

	function makeCanvas(width: number, height: number) {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		return canvas;
	}

	function toGray(data: Uint8ClampedArray) {
		const out = new Uint8ClampedArray(data.length / 4);

		for (let i = 0, j = 0; i < data.length; i += 4, j++) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			out[j] = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
		}

		return out;
	}

	function grayToImageData(gray: Uint8ClampedArray, width: number, height: number) {
		const imageData = new ImageData(width, height);

		for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
			const v = gray[j];
			imageData.data[i] = v;
			imageData.data[i + 1] = v;
			imageData.data[i + 2] = v;
			imageData.data[i + 3] = 255;
		}

		return imageData;
	}

	function blurGray(gray: Uint8ClampedArray, width: number, height: number, radiusPx: number) {
		if (radiusPx <= 0) return gray;

		const source = makeCanvas(width, height);
		const target = makeCanvas(width, height);

		const sctx = source.getContext('2d');
		const tctx = target.getContext('2d');

		if (!sctx || !tctx) throw new Error('Could not create 2D canvas context');

		sctx.putImageData(grayToImageData(gray, width, height), 0, 0);

		tctx.clearRect(0, 0, width, height);
		tctx.filter = `blur(${radiusPx}px)`;
		tctx.drawImage(source, 0, 0);
		tctx.filter = 'none';

		return toGray(tctx.getImageData(0, 0, width, height).data);
	}

	function buildInk(
		gray: Uint8ClampedArray,
		blurred: Uint8ClampedArray,
		width: number,
		height: number
	) {
		const out = new Uint8ClampedArray(width * height);

		for (let i = 0; i < out.length; i++) {
			const v = blurred[i] - gray[i];
			out[i] = v > 0 ? v : 0;
		}

		return out;
	}

	// Simple stroke-aware enhancement:
	// differences in letter shape often show up more clearly in edge strength
	// than in plain darkness alone.
	function buildEdgeMap(gray: Uint8ClampedArray, width: number, height: number) {
		const out = new Uint8ClampedArray(width * height);

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				const i = y * width + x;
				const gx = Math.abs(gray[i + 1] - gray[i - 1]);
				const gy = Math.abs(gray[i + width] - gray[i - width]);
				out[i] = Math.min(255, gx + gy);
			}
		}

		return out;
	}

	function buildCombinedDiffMask(
		baseInk: Uint8ClampedArray,
		warpedInk: Uint8ClampedArray,
		baseEdge: Uint8ClampedArray,
		warpedEdge: Uint8ClampedArray,
		diffT: number,
		inkT: number
	) {
		const out = new Uint8Array(baseInk.length);

		for (let i = 0; i < out.length; i++) {
			const a = baseInk[i];
			const b = warpedInk[i];
			const inkDiff = Math.abs(a - b);
			const edgeDiff = Math.abs(baseEdge[i] - warpedEdge[i]);
			const textish = a >= inkT || b >= inkT;

			// Use both ink difference and stroke-edge difference.
			const score = Math.max(inkDiff, Math.round(inkDiff * 0.7 + edgeDiff * 0.5));

			out[i] = textish && score >= diffT ? 1 : 0;
		}

		return out;
	}

	function buildIntegral(mask: Uint8Array, width: number, height: number) {
		const stride = width + 1;
		const integral = new Uint32Array((width + 1) * (height + 1));

		for (let y = 0; y < height; y++) {
			let row = 0;

			for (let x = 0; x < width; x++) {
				row += mask[y * width + x];
				integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + row;
			}
		}

		return integral;
	}

	function rectSum(
		integral: Uint32Array,
		width: number,
		height: number,
		x1: number,
		y1: number,
		x2: number,
		y2: number
	) {
		const stride = width + 1;

		const ax = Math.max(0, Math.min(width, x1));
		const ay = Math.max(0, Math.min(height, y1));
		const bx = Math.max(0, Math.min(width, x2));
		const by = Math.max(0, Math.min(height, y2));

		if (bx <= ax || by <= ay) return 0;

		return (
			integral[by * stride + bx] -
			integral[ay * stride + bx] -
			integral[by * stride + ax] +
			integral[ay * stride + ax]
		);
	}

	function dilate(mask: Uint8Array, width: number, height: number, rx: number, ry: number) {
		if (rx <= 0 && ry <= 0) return mask.slice();

		const out = new Uint8Array(mask.length);
		const integral = buildIntegral(mask, width, height);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const sum = rectSum(integral, width, height, x - rx, y - ry, x + rx + 1, y + ry + 1);
				out[y * width + x] = sum > 0 ? 1 : 0;
			}
		}

		return out;
	}

	function erode(mask: Uint8Array, width: number, height: number, rx: number, ry: number) {
		if (rx <= 0 && ry <= 0) return mask.slice();

		const out = new Uint8Array(mask.length);
		const integral = buildIntegral(mask, width, height);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const x1 = x - rx;
				const y1 = y - ry;
				const x2 = x + rx + 1;
				const y2 = y + ry + 1;

				const ax = Math.max(0, x1);
				const ay = Math.max(0, y1);
				const bx = Math.min(width, x2);
				const by = Math.min(height, y2);

				const area = Math.max(0, bx - ax) * Math.max(0, by - ay);
				const sum = rectSum(integral, width, height, ax, ay, bx, by);

				out[y * width + x] = sum === area ? 1 : 0;
			}
		}

		return out;
	}

	function connectedBoxes(mask: Uint8Array, width: number, height: number, minCount: number) {
		const visited = new Uint8Array(mask.length);
		const results: Box[] = [];
		const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

		for (let i = 0; i < mask.length; i++) {
			if (!mask[i] || visited[i]) continue;

			let minX = width;
			let minY = height;
			let maxX = 0;
			let maxY = 0;
			let pixels = 0;

			const stack = [i];
			visited[i] = 1;

			while (stack.length) {
				const idx = stack.pop() as number;
				const x = idx % width;
				const y = (idx / width) | 0;

				pixels++;
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;

				for (const offset of neighbors) {
					const next = idx + offset;
					if (next < 0 || next >= mask.length) continue;

					const nx = next % width;
					const ny = (next / width) | 0;

					if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
					if (!mask[next] || visited[next]) continue;

					visited[next] = 1;
					stack.push(next);
				}
			}

			if (pixels >= minCount) {
				results.push({
					x: minX,
					y: minY,
					w: maxX - minX + 1,
					h: maxY - minY + 1,
					pixels
				});
			}
		}

		return results;
	}

	function boxesNear(a: Box, b: Box, gap: number) {
		return !(
			a.x + a.w + gap < b.x ||
			b.x + b.w + gap < a.x ||
			a.y + a.h + gap < b.y ||
			b.y + b.h + gap < a.y
		);
	}

	function mergeBoxes(boxesIn: Box[], gap: number) {
		const merged = boxesIn.map((b) => ({ ...b }));
		let changed = true;

		while (changed) {
			changed = false;

			outer: for (let i = 0; i < merged.length; i++) {
				for (let j = i + 1; j < merged.length; j++) {
					if (!boxesNear(merged[i], merged[j], gap)) continue;

					const a = merged[i];
					const b = merged[j];

					merged[i] = {
						x: Math.min(a.x, b.x),
						y: Math.min(a.y, b.y),
						w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
						h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
						pixels: a.pixels + b.pixels
					};

					merged.splice(j, 1);
					changed = true;
					break outer;
				}
			}
		}

		return merged;
	}

	function expandAndClampBox(box: Box, padPx: number, width: number, height: number): Box {
		const x = Math.max(0, box.x - padPx);
		const y = Math.max(0, box.y - padPx);
		const right = Math.min(width, box.x + box.w + padPx);
		const bottom = Math.min(height, box.y + box.h + padPx);

		return {
			x,
			y,
			w: right - x,
			h: bottom - y,
			pixels: box.pixels
		};
	}

	async function maskToObjectUrl(mask: Uint8Array, width: number, height: number) {
		const canvas = makeCanvas(width, height);
		const ctx = canvas.getContext('2d');

		if (!ctx) throw new Error('Could not create mask canvas');

		const imageData = ctx.createImageData(width, height);

		for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
			if (mask[i]) {
				imageData.data[p] = 255;
				imageData.data[p + 1] = 90;
				imageData.data[p + 2] = 90;
				imageData.data[p + 3] = 255;
			} else {
				imageData.data[p] = 0;
				imageData.data[p + 1] = 0;
				imageData.data[p + 2] = 0;
				imageData.data[p + 3] = 255;
			}
		}

		ctx.putImageData(imageData, 0, 0);

		return new Promise<string>((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Failed to create mask preview'));
					return;
				}
				resolve(URL.createObjectURL(blob));
			}, 'image/png');
		});
	}

	async function detectChanges() {
		if (!baseFile || !warpedFile) return;

		running = true;
		error = null;
		boxes = [];
		selectedBoxIndex = null;
		clearMask();

		let baseBitmap: ImageBitmap | null = null;
		let warpedBitmap: ImageBitmap | null = null;

		try {
			baseBitmap = await createImageBitmap(baseFile);
			warpedBitmap = await createImageBitmap(warpedFile);

			const scale = Math.min(1, maxWorkDim / Math.max(baseBitmap.width, baseBitmap.height));
			const workW = Math.max(1, Math.round(baseBitmap.width * scale));
			const workH = Math.max(1, Math.round(baseBitmap.height * scale));

			const baseCanvas = makeCanvas(workW, workH);
			const warpedCanvas = makeCanvas(workW, workH);

			const bctx = baseCanvas.getContext('2d', { willReadFrequently: true });
			const wctx = warpedCanvas.getContext('2d', { willReadFrequently: true });

			if (!bctx || !wctx) throw new Error('Could not create canvas context');

			bctx.drawImage(baseBitmap, 0, 0, workW, workH);
			wctx.drawImage(warpedBitmap, 0, 0, workW, workH);

			const baseGray = toGray(bctx.getImageData(0, 0, workW, workH).data);
			const warpedGray = toGray(wctx.getImageData(0, 0, workW, workH).data);

			const baseBlur = blurGray(baseGray, workW, workH, blurPx);
			const warpedBlur = blurGray(warpedGray, workW, workH, blurPx);

			const baseInk = buildInk(baseGray, baseBlur, workW, workH);
			const warpedInk = buildInk(warpedGray, warpedBlur, workW, workH);

			const baseEdge = buildEdgeMap(baseInk, workW, workH);
			const warpedEdge = buildEdgeMap(warpedInk, workW, workH);

			let mask = buildCombinedDiffMask(
				baseInk,
				warpedInk,
				baseEdge,
				warpedEdge,
				diffThreshold,
				inkThreshold
			);

			mask = dilate(mask, workW, workH, joinLettersX, joinLettersY);
			mask = erode(mask, workW, workH, cleanNoiseX, cleanNoiseY);

			const workBoxes = mergeBoxes(
				connectedBoxes(mask, workW, workH, minChangedPixels),
				mergeNearbyGap
			);

			const sx = baseBitmap.width / workW;
			const sy = baseBitmap.height / workH;

			boxes = workBoxes
				.map((box) => ({
					x: Math.round(box.x * sx),
					y: Math.round(box.y * sy),
					w: Math.round(box.w * sx),
					h: Math.round(box.h * sy),
					pixels: box.pixels
				}))
				.map((box) => expandAndClampBox(box, boxPadding, baseBitmap.width, baseBitmap.height))
				.filter((box) => box.w * box.h >= minBoxArea)
				.sort((a, b) => a.y - b.y || a.x - b.x);

			if (boxes.length) selectedBoxIndex = 0;

			if (showMaskPreview) {
				maskUrl = await maskToObjectUrl(mask, workW, workH);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Detection failed';
		} finally {
			baseBitmap?.close();
			warpedBitmap?.close();
			running = false;
		}
	}

	async function copyBoxesJson() {
		if (!boxes.length) return;
		await navigator.clipboard.writeText(JSON.stringify(boxes, null, 2));
	}

	function selectBox(index: number) {
		selectedBoxIndex = index;
	}

	onDestroy(() => {
		if (baseUrl) URL.revokeObjectURL(baseUrl);
		if (warpedUrl) URL.revokeObjectURL(warpedUrl);
		if (maskUrl) URL.revokeObjectURL(maskUrl);
	});
</script>

<svelte:head>
	<title>Manuscript change region detector</title>
</svelte:head>

<div class="page">
	<header class="hero">
		<div>
			<h1>Manuscript change region detector</h1>
			<p class="intro">
				Upload a base image and an already aligned warped image. This uses local ink and
				stroke-shape differences rather than OCR, then groups likely text changes into bounding
				boxes.
			</p>
		</div>

		<div class="hero-actions">
			<button class="primary" type="button" on:click={detectChanges} disabled={!canRun}>
				{running ? 'Detecting…' : 'Detect text changes'}
			</button>

			<button class="secondary" type="button" on:click={resetTuning}>Reset tuning</button>

			{#if boxes.length}
				<button class="secondary" type="button" on:click={copyBoxesJson}>Copy boxes JSON</button>
			{/if}
		</div>
	</header>

	<section class="upload-strip">
		<div class="upload-card">
			<div class="upload-head">
				<h2>Base image</h2>
				<button class="ghost" type="button" on:click={clearBase} disabled={!baseFile}>Clear</button>
			</div>

			<input bind:this={baseInput} type="file" accept="image/*" on:change={onBaseChange} />

			{#if baseMeta}
				<div class="meta">
					<div><strong>{baseMeta.name}</strong></div>
					<div>{baseMeta.width} × {baseMeta.height}</div>
					<div>{formatBytes(baseMeta.size)}</div>
				</div>
			{/if}
		</div>

		<div class="upload-card">
			<div class="upload-head">
				<h2>Warped image</h2>
				<button class="ghost" type="button" on:click={clearWarped} disabled={!warpedFile}
					>Clear</button
				>
			</div>

			<input bind:this={warpedInput} type="file" accept="image/*" on:change={onWarpedChange} />

			{#if warpedMeta}
				<div class="meta">
					<div><strong>{warpedMeta.name}</strong></div>
					<div>{warpedMeta.width} × {warpedMeta.height}</div>
					<div>{formatBytes(warpedMeta.size)}</div>
				</div>
			{/if}
		</div>

		<div class="upload-card status-card">
			<h2>Run status</h2>
			<div class="meta">
				<div>baseFile: {baseFile ? 'yes' : 'no'}</div>
				<div>warpedFile: {warpedFile ? 'yes' : 'no'}</div>
				<div>baseMeta: {baseMeta ? 'yes' : 'no'}</div>
				<div>warpedMeta: {warpedMeta ? 'yes' : 'no'}</div>
				<div>running: {running ? 'yes' : 'no'}</div>
				<div>canRun: {canRun ? 'yes' : 'no'}</div>
			</div>

			<div class="chips">
				<span class="chip">{boxes.length} boxes</span>
				<span class="chip">{presetName}</span>
				{#if selectedBox}
					<span class="chip">selected #{selectedBoxIndex! + 1}</span>
				{/if}
			</div>

			<p class="hint">
				Start with <strong>Balanced</strong>. If it misses changes, try
				<strong>Aggressive</strong>. If it finds too many false positives, try
				<strong>Conservative</strong>.
			</p>

			{#if error}
				<p class="error">{error}</p>
			{/if}
		</div>
	</section>

	<div class="workbench">
		<aside class="sidebar panel">
			<section class="sidebar-section">
				<h3>Detection preset</h3>

				<label class="field">
					<span>Preset</span>
					<select bind:value={presetName} on:change={() => applyPreset(presetName)}>
						<option value="conservative">Conservative</option>
						<option value="balanced">Balanced</option>
						<option value="aggressive">Aggressive</option>
					</select>
				</label>
			</section>

			<section class="sidebar-section">
				<h3>Main controls</h3>

				<label class="range-field">
					<div class="range-head">
						<span>Processing size</span>
						<em>{maxWorkDim}px</em>
					</div>
					<input type="range" min="800" max="2200" step="100" bind:value={maxWorkDim} />
					<small>Higher can spot finer changes, but runs slower.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Background smoothing</span>
						<em>{blurPx}px</em>
					</div>
					<input type="range" min="1" max="18" step="1" bind:value={blurPx} />
					<small>How much page tone is smoothed out before text is measured.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Change sensitivity</span>
						<em>{diffThreshold}</em>
					</div>
					<input type="range" min="10" max="100" step="1" bind:value={diffThreshold} />
					<small>Lower finds more changes. Higher is stricter.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Ignore faint ink</span>
						<em>{inkThreshold}</em>
					</div>
					<input type="range" min="0" max="60" step="1" bind:value={inkThreshold} />
					<small>Raise this to ignore paper noise and very faint marks.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Join letters horizontally</span>
						<em>{joinLettersX}px</em>
					</div>
					<input type="range" min="0" max="40" step="1" bind:value={joinLettersX} />
					<small>Higher groups changed letters into word-like regions.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Join letters vertically</span>
						<em>{joinLettersY}px</em>
					</div>
					<input type="range" min="0" max="12" step="1" bind:value={joinLettersY} />
					<small>Usually keep this low so separate lines do not merge.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Minimum change size</span>
						<em>{minChangedPixels}px</em>
					</div>
					<input type="range" min="1" max="120" step="1" bind:value={minChangedPixels} />
					<small>Raise to remove tiny isolated detections.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Merge nearby boxes</span>
						<em>{mergeNearbyGap}px</em>
					</div>
					<input type="range" min="0" max="40" step="1" bind:value={mergeNearbyGap} />
					<small>Higher merges nearby detections into a single region.</small>
				</label>
			</section>

			<details class="sidebar-section advanced">
				<summary>Advanced cleanup</summary>

				<label class="range-field">
					<div class="range-head">
						<span>Clean mask noise (horizontal)</span>
						<em>{cleanNoiseX}px</em>
					</div>
					<input type="range" min="0" max="12" step="1" bind:value={cleanNoiseX} />
					<small>Use small values to tidy stray mask pixels after joining.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Clean mask noise (vertical)</span>
						<em>{cleanNoiseY}px</em>
					</div>
					<input type="range" min="0" max="6" step="1" bind:value={cleanNoiseY} />
					<small>Usually keep this very low.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Minimum final box area</span>
						<em>{minBoxArea}px²</em>
					</div>
					<input type="range" min="20" max="2500" step="10" bind:value={minBoxArea} />
					<small>Raise to remove small final rectangles.</small>
				</label>

				<label class="range-field">
					<div class="range-head">
						<span>Expand detected box</span>
						<em>{boxPadding}px</em>
					</div>
					<input type="range" min="0" max="30" step="1" bind:value={boxPadding} />
					<small>Add padding so the box surrounds the full changed word.</small>
				</label>
			</details>

			<section class="sidebar-section">
				<h3>View options</h3>

				<label class="toggle">
					<input type="checkbox" bind:checked={showMaskPreview} />
					<span>Build mask preview</span>
				</label>

				<label class="toggle">
					<input type="checkbox" bind:checked={showBoxLabels} />
					<span>Show box numbers</span>
				</label>
			</section>

			{#if boxes.length}
				<section class="sidebar-section">
					<h3>Detected boxes</h3>

					<div class="box-list">
						{#each boxes as box, i}
							<button
								type="button"
								class:selected={selectedBoxIndex === i}
								class="box-row"
								on:click={() => selectBox(i)}
							>
								<div class="box-row-title">#{i + 1}</div>
								<div class="box-row-meta">
									<div>{box.x}, {box.y}</div>
									<div>{box.w} × {box.h}</div>
									<div>{box.pixels} changed px</div>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/if}
		</aside>

		<section class="viewer-grid">
			<article class="panel viewer-card">
				<header class="viewer-head">
					<h3>Base image</h3>
					{#if baseMeta}
						<span class="viewer-meta">{baseMeta.width} × {baseMeta.height}</span>
					{/if}
				</header>

				<div class="viewer-shell">
					{#if baseUrl}
						<div class="image-stage">
							<img class="viewer-image" src={baseUrl} alt="Base image" />
						</div>
					{:else}
						<div class="viewer-empty">Upload a base image</div>
					{/if}
				</div>
			</article>

			<article class="panel viewer-card">
				<header class="viewer-head">
					<h3>Warped image</h3>
					{#if warpedMeta}
						<span class="viewer-meta">{warpedMeta.width} × {warpedMeta.height}</span>
					{/if}
				</header>

				<div class="viewer-shell">
					{#if warpedUrl}
						<div class="image-stage">
							<img class="viewer-image" src={warpedUrl} alt="Warped image" />
						</div>
					{:else}
						<div class="viewer-empty">Upload a warped image</div>
					{/if}
				</div>
			</article>

			<article class="panel viewer-card">
				<header class="viewer-head">
					<h3>Difference mask</h3>
					<span class="viewer-meta">Grouped change pixels</span>
				</header>

				<div class="viewer-shell">
					{#if maskUrl}
						<div class="image-stage">
							<img class="viewer-image" src={maskUrl} alt="Difference mask" />
						</div>
					{:else if showMaskPreview}
						<div class="viewer-empty">Run detection to build a mask preview</div>
					{:else}
						<div class="viewer-empty">Mask preview is turned off</div>
					{/if}
				</div>
			</article>

			<article class="panel viewer-card">
				<header class="viewer-head">
					<h3>Detected change boxes</h3>
					{#if selectedBox}
						<span class="viewer-meta">selected #{selectedBoxIndex! + 1}</span>
					{:else}
						<span class="viewer-meta">{boxes.length} total</span>
					{/if}
				</header>

				<div class="viewer-shell">
					{#if baseUrl}
						<div class="image-stage overlay-stage">
							<img class="viewer-image" src={baseUrl} alt="Base image with change boxes" />

							{#if baseMeta}
								{#each boxes as box, i}
									<button
										type="button"
										class:selected={selectedBoxIndex === i}
										class="box"
										title={`#${i + 1} ${box.x},${box.y} ${box.w}×${box.h}`}
										style={`left:${(box.x / baseMeta.width) * 100}%; top:${(box.y / baseMeta.height) * 100}%; width:${(box.w / baseMeta.width) * 100}%; height:${(box.h / baseMeta.height) * 100}%;`}
										on:click={() => selectBox(i)}
									>
										{#if showBoxLabels}
											<span>{i + 1}</span>
										{/if}
									</button>
								{/each}
							{/if}
						</div>
					{:else}
						<div class="viewer-empty">Boxes will appear here</div>
					{/if}
				</div>
			</article>
		</section>
	</div>

	{#if boxes.length}
		<details class="panel output-panel">
			<summary>Boxes JSON</summary>
			<pre>{JSON.stringify(boxes, null, 2)}</pre>
		</details>
	{/if}
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		min-height: 100vh;
		overflow-y: auto;
		background: #f5f5f4;
		color: #1c1917;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.page {
		max-width: 1800px;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hero {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1,
	h2,
	h3 {
		margin: 0;
	}

	.intro {
		margin: 0.35rem 0 0;
		max-width: 75ch;
		color: #57534e;
	}

	.hero-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.upload-strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.upload-card,
	.panel {
		background: white;
		border: 1px solid #e7e5e4;
		border-radius: 14px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.upload-card {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.upload-head,
	.viewer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.status-card {
		justify-content: flex-start;
	}

	.workbench {
		display: grid;
		grid-template-columns: 360px minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.sidebar {
		padding: 1rem;
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #f1f5f9;
		margin-bottom: 1rem;
	}

	.sidebar-section:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.advanced summary {
		cursor: pointer;
		font-weight: 700;
	}

	.field,
	.range-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.range-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-weight: 600;
	}

	.range-field small,
	.hint {
		color: #57534e;
		font-size: 0.9rem;
		line-height: 1.35;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.viewer-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.viewer-card {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.viewer-meta {
		color: #78716c;
		font-size: 0.85rem;
	}

	.viewer-shell {
		min-height: 320px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #111827;
		border-radius: 12px;
		padding: 0.5rem;
		overflow: auto;
	}

	.viewer-empty {
		color: #cbd5e1;
		font-size: 0.95rem;
		text-align: center;
		padding: 1rem;
	}

	.image-stage {
		position: relative;
		display: inline-block;
		max-width: 100%;
		max-height: 100%;
		line-height: 0;
	}

	.viewer-image {
		display: block;
		max-width: 100%;
		max-height: clamp(260px, 42vh, 560px);
		width: auto;
		height: auto;
		border-radius: 8px;
		background: #111827;
	}

	.overlay-stage {
		background: transparent;
	}

	.box {
		position: absolute;
		box-sizing: border-box;
		border: 3px solid rgba(17, 17, 17, 0.95);
		background: rgba(255, 255, 255, 0.04);
		border-radius: 2px;
		cursor: pointer;
		padding: 0;
	}

	.box.selected {
		border-color: #2563eb;
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
	}

	.box span {
		position: absolute;
		top: -1.45rem;
		left: 0;
		background: rgba(17, 17, 17, 0.95);
		color: white;
		font-size: 0.75rem;
		line-height: 1;
		padding: 0.18rem 0.35rem;
		border-radius: 6px;
		white-space: nowrap;
	}

	.box.selected span {
		background: #2563eb;
	}

	.box-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 320px;
		overflow-y: auto;
	}

	.box-row {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: start;
		text-align: left;
	}

	.box-row-title {
		font-weight: 700;
	}

	.box-row-meta {
		display: grid;
		gap: 0.15rem;
		color: #57534e;
		font-size: 0.9rem;
	}

	.box-row.selected {
		border-color: #2563eb;
		background: #eff6ff;
	}

	.meta {
		font-size: 0.92rem;
		color: #57534e;
		display: grid;
		gap: 0.2rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: #f5f5f4;
		color: #44403c;
		border: 1px solid #e7e5e4;
		font-size: 0.85rem;
	}

	.output-panel {
		padding: 1rem;
	}

	.output-panel summary {
		cursor: pointer;
		font-weight: 700;
	}

	.error {
		margin: 0;
		color: #b91c1c;
		font-weight: 600;
	}

	input[type='file'],
	input[type='range'],
	select,
	button {
		font: inherit;
	}

	input[type='range'] {
		width: 100%;
	}

	select {
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		border: 1px solid #d6d3d1;
		background: white;
	}

	button {
		padding: 0.6rem 0.85rem;
		border-radius: 10px;
		border: 1px solid #d6d3d1;
		background: white;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.primary {
		background: #111827;
		color: white;
		border-color: #111827;
	}

	.secondary,
	.ghost {
		background: white;
		color: #292524;
	}

	pre {
		margin: 0.75rem 0 0;
		padding: 0.9rem;
		background: #0f172a;
		color: #e2e8f0;
		border-radius: 10px;
		overflow: auto;
		font-size: 0.85rem;
	}

	@media (max-width: 1300px) {
		.workbench {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
			max-height: none;
		}
	}

	@media (max-width: 1100px) {
		.upload-strip,
		.viewer-grid {
			grid-template-columns: 1fr;
		}

		.viewer-shell {
			min-height: 260px;
		}
	}
</style>
