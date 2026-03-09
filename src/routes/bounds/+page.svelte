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
	let running = false;
	let error: string | null = null;

	// Detection tuning
	let maxWorkDim = 1400; // resize large images for speed
	let blurPx = 7; // local background blur
	let diffThreshold = 44; // how different the local "ink" must be
	let inkThreshold = 16; // ignore weak/non-text regions
	let dilateX = 18; // join letters into word-ish regions
	let dilateY = 3;
	let erodeX = 4; // tidy mask after join
	let erodeY = 1;
	let minPixels = 22; // minimum changed pixels inside a component
	let minBoxArea = 160; // minimum final box area in base-image pixels
	let pad = 8; // expand box a little
	let mergeGap = 18; // merge nearby boxes
	let showMask = true;

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

	async function setFile(kind: 'base' | 'warped', file: File | null) {
		error = null;
		boxes = [];
		clearMask();

		if (kind === 'base') {
			if (baseUrl) URL.revokeObjectURL(baseUrl);
			baseUrl = null;
			baseFile = null;
			baseMeta = null;
		} else {
			if (warpedUrl) URL.revokeObjectURL(warpedUrl);
			warpedUrl = null;
			warpedFile = null;
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

	function clearMask() {
		if (maskUrl) {
			URL.revokeObjectURL(maskUrl);
			maskUrl = null;
		}
	}

	function canRun() {
		return Boolean(baseFile && warpedFile && baseMeta && warpedMeta && !running);
	}

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

	function buildDiffMask(
		baseInk: Uint8ClampedArray,
		warpedInk: Uint8ClampedArray,
		diffT: number,
		inkT: number
	) {
		const out = new Uint8Array(baseInk.length);

		for (let i = 0; i < out.length; i++) {
			const a = baseInk[i];
			const b = warpedInk[i];
			const diff = Math.abs(a - b);
			const textish = a >= inkT || b >= inkT;
			out[i] = textish && diff >= diffT ? 1 : 0;
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
		const boxes = boxesIn.map((b) => ({ ...b }));
		let changed = true;

		while (changed) {
			changed = false;

			outer: for (let i = 0; i < boxes.length; i++) {
				for (let j = i + 1; j < boxes.length; j++) {
					if (!boxesNear(boxes[i], boxes[j], gap)) continue;

					const a = boxes[i];
					const b = boxes[j];

					boxes[i] = {
						x: Math.min(a.x, b.x),
						y: Math.min(a.y, b.y),
						w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
						h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
						pixels: a.pixels + b.pixels
					};

					boxes.splice(j, 1);
					changed = true;
					break outer;
				}
			}
		}

		return boxes;
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

	function maskToObjectUrl(mask: Uint8Array, width: number, height: number) {
		const canvas = makeCanvas(width, height);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not create mask canvas');

		const imageData = ctx.createImageData(width, height);

		for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
			if (mask[i]) {
				imageData.data[p] = 255;
				imageData.data[p + 1] = 80;
				imageData.data[p + 2] = 80;
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

			let mask = buildDiffMask(baseInk, warpedInk, diffThreshold, inkThreshold);

			mask = dilate(mask, workW, workH, dilateX, dilateY);
			mask = erode(mask, workW, workH, erodeX, erodeY);

			const workBoxes = mergeBoxes(connectedBoxes(mask, workW, workH, minPixels), mergeGap);

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
				.map((box) => expandAndClampBox(box, pad, baseBitmap.width, baseBitmap.height))
				.filter((box) => box.w * box.h >= minBoxArea)
				.sort((a, b) => a.y - b.y || a.x - b.x);

			if (showMask) {
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

	function resetTuning() {
		blurPx = 7;
		diffThreshold = 44;
		inkThreshold = 16;
		dilateX = 18;
		dilateY = 3;
		erodeX = 4;
		erodeY = 1;
		minPixels = 22;
		minBoxArea = 160;
		pad = 8;
		mergeGap = 18;
		maxWorkDim = 1400;
	}

	async function copyBoxesJson() {
		await navigator.clipboard.writeText(JSON.stringify(boxes, null, 2));
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
	<h1>Manuscript change region detector</h1>
	<p class="intro">
		Upload a base image and an already aligned/warped image. This compares local dark-text
		structure, not OCR, and draws bounding rectangles around likely text changes.
	</p>

	<div class="upload-grid">
		<section class="panel">
			<h2>Base image</h2>
			<input bind:this={baseInput} type="file" accept="image/*" on:change={onBaseChange} />
			<div class="row">
				<button class="secondary" on:click={clearBase} disabled={!baseFile}>Clear</button>
			</div>

			{#if baseMeta}
				<div class="meta">
					<div><strong>{baseMeta.name}</strong></div>
					<div>{baseMeta.width} × {baseMeta.height}</div>
					<div>{formatBytes(baseMeta.size)}</div>
				</div>
			{/if}

			{#if baseUrl}
				<img class="preview" src={baseUrl} alt="Base preview" />
			{/if}
		</section>

		<section class="panel">
			<h2>Warped image</h2>
			<input bind:this={warpedInput} type="file" accept="image/*" on:change={onWarpedChange} />
			<div class="row">
				<button class="secondary" on:click={clearWarped} disabled={!warpedFile}>Clear</button>
			</div>

			{#if warpedMeta}
				<div class="meta">
					<div><strong>{warpedMeta.name}</strong></div>
					<div>{warpedMeta.width} × {warpedMeta.height}</div>
					<div>{formatBytes(warpedMeta.size)}</div>
				</div>
			{/if}

			{#if warpedUrl}
				<img class="preview" src={warpedUrl} alt="Warped preview" />
			{/if}
		</section>
	</div>

	<section class="panel">
		<div class="toolbar">
			<div class="toolbar-left">
				<button class="primary" on:click={detectChanges} disabled={!canRun()}>
					{running ? 'Detecting…' : 'Detect change regions'}
				</button>
				<button class="secondary" on:click={resetTuning}>Reset tuning</button>
				<label class="check">
					<input type="checkbox" bind:checked={showMask} />
					Build mask preview
				</label>
			</div>

			<div class="toolbar-right">
				<span class="chip">{boxes.length} boxes</span>
			</div>
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="controls">
			<label>
				<span>Max work dim</span>
				<input type="range" min="800" max="2200" step="100" bind:value={maxWorkDim} />
				<em>{maxWorkDim}</em>
			</label>

			<label>
				<span>Blur</span>
				<input type="range" min="1" max="18" step="1" bind:value={blurPx} />
				<em>{blurPx}px</em>
			</label>

			<label>
				<span>Diff threshold</span>
				<input type="range" min="10" max="100" step="1" bind:value={diffThreshold} />
				<em>{diffThreshold}</em>
			</label>

			<label>
				<span>Ink threshold</span>
				<input type="range" min="0" max="60" step="1" bind:value={inkThreshold} />
				<em>{inkThreshold}</em>
			</label>

			<label>
				<span>Join X</span>
				<input type="range" min="0" max="40" step="1" bind:value={dilateX} />
				<em>{dilateX}</em>
			</label>

			<label>
				<span>Join Y</span>
				<input type="range" min="0" max="12" step="1" bind:value={dilateY} />
				<em>{dilateY}</em>
			</label>

			<label>
				<span>Trim X</span>
				<input type="range" min="0" max="12" step="1" bind:value={erodeX} />
				<em>{erodeX}</em>
			</label>

			<label>
				<span>Trim Y</span>
				<input type="range" min="0" max="6" step="1" bind:value={erodeY} />
				<em>{erodeY}</em>
			</label>

			<label>
				<span>Min changed pixels</span>
				<input type="range" min="1" max="120" step="1" bind:value={minPixels} />
				<em>{minPixels}</em>
			</label>

			<label>
				<span>Min box area</span>
				<input type="range" min="20" max="2500" step="10" bind:value={minBoxArea} />
				<em>{minBoxArea}</em>
			</label>

			<label>
				<span>Pad</span>
				<input type="range" min="0" max="30" step="1" bind:value={pad} />
				<em>{pad}px</em>
			</label>

			<label>
				<span>Merge gap</span>
				<input type="range" min="0" max="40" step="1" bind:value={mergeGap} />
				<em>{mergeGap}px</em>
			</label>
		</div>
	</section>

	{#if baseUrl}
		<section class="panel">
			<header class="result-head">
				<h2>Base image with detected change boxes</h2>
				{#if boxes.length}
					<button class="secondary" on:click={copyBoxesJson}>Copy boxes JSON</button>
				{/if}
			</header>

			<div class="image-stage">
				<img src={baseUrl} alt="Base image with overlays" />
				{#if baseMeta}
					{#each boxes as box, i}
						<div
							class="box"
							title={`#${i + 1} ${box.x},${box.y} ${box.w}×${box.h}`}
							style={`left:${(box.x / baseMeta.width) * 100}%; top:${(box.y / baseMeta.height) * 100}%; width:${(box.w / baseMeta.width) * 100}%; height:${(box.h / baseMeta.height) * 100}%;`}
						>
							<span>{i + 1}</span>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/if}

	{#if maskUrl}
		<section class="panel">
			<h2>Grouped difference mask</h2>
			<img class="mask-preview" src={maskUrl} alt="Difference mask preview" />
		</section>
	{/if}

	{#if boxes.length}
		<section class="panel">
			<h2>Detected boxes</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>#</th>
							<th>x</th>
							<th>y</th>
							<th>w</th>
							<th>h</th>
							<th>pixels</th>
						</tr>
					</thead>
					<tbody>
						{#each boxes as box, i}
							<tr>
								<td>{i + 1}</td>
								<td>{box.x}</td>
								<td>{box.y}</td>
								<td>{box.w}</td>
								<td>{box.h}</td>
								<td>{box.pixels}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<details>
				<summary>JSON</summary>
				<pre>{JSON.stringify(boxes, null, 2)}</pre>
			</details>
		</section>
	{/if}
</div>

<style>
	:global(html) {
		height: auto;
		overflow-y: auto;
	}

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

	:global(#svelte),
	:global(body > div) {
		min-height: 100vh;
	}

	.page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;

		min-height: 100vh;
		overflow: visible;
	}

	h1,
	h2 {
		margin: 0;
	}

	.intro {
		margin: 0;
		color: #57534e;
	}

	.upload-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.panel {
		background: white;
		border: 1px solid #e7e5e4;
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

		overflow: visible;
	}

	.row,
	.toolbar,
	.result-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 0.8rem 1rem;
	}

	.controls label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.9rem;
	}

	.controls label span {
		font-weight: 600;
		color: #44403c;
	}

	.controls label em {
		font-style: normal;
		color: #78716c;
		font-size: 0.85rem;
	}

	input[type='file'],
	select,
	button {
		font: inherit;
	}

	input[type='range'] {
		width: 100%;
	}

	button {
		padding: 0.55rem 0.8rem;
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

	.secondary {
		background: white;
		color: #292524;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: #44403c;
	}

	.meta {
		font-size: 0.92rem;
		color: #57534e;
		display: grid;
		gap: 0.2rem;
	}

	.preview,
	.mask-preview {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: 10px;
		border: 1px solid #e7e5e4;
	}

	.image-stage {
		position: relative;
		display: inline-block;
		max-width: 100%;
		border: 1px solid #e7e5e4;
		border-radius: 10px;
		overflow: hidden;
		background: #fafaf9;
	}

	.image-stage img {
		display: block;
		max-width: 100%;
		height: auto;
	}

	.box {
		position: absolute;
		box-sizing: border-box;
		border: 3px solid #111111;
		background: rgba(255, 255, 255, 0.06);
		pointer-events: none;
	}

	.box span {
		position: absolute;
		top: -1.4rem;
		left: 0;
		background: #111111;
		color: white;
		font-size: 0.75rem;
		line-height: 1;
		padding: 0.18rem 0.35rem;
		border-radius: 6px;
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

	.error {
		margin: 0;
		color: #b91c1c;
		font-weight: 600;
	}

	.table-wrap {
		overflow: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.92rem;
	}

	th,
	td {
		text-align: left;
		padding: 0.55rem 0.6rem;
		border-bottom: 1px solid #f1f5f9;
	}

	th {
		color: #57534e;
		background: #fafaf9;
	}

	pre {
		margin: 0;
		padding: 0.9rem;
		background: #0f172a;
		color: #e2e8f0;
		border-radius: 10px;
		overflow: auto;
		font-size: 0.85rem;
	}

	@media (max-width: 900px) {
		.upload-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
