<script>
	import Toast from '$lib/ui/Toast.svelte';
	import { showToast } from '$lib/ui/toast';
	import Modal from '$lib/ui/Modal.svelte';
	import Header from '$lib/Header.svelte';

	let showHelp = false;
	let showAbout = false;

	async function handleLoadProject() {
		console.log('Load project triggered');
	}

	async function handleSaveProject() {
		console.log('Save project triggered');
		showToast('Project saved successfully!');
	}
</script>

<div class="app">
	<Toast />
	<Header
		on:load-project={handleLoadProject}
		on:save-project={handleSaveProject}
		on:help={() => (showHelp = true)}
		on:about={() => (showAbout = true)}
	/>
	<div class="workspace"></div>

	<Modal open={showHelp} title="How to use this tool" on:close={() => (showHelp = false)}>
		<p>
			This tool allows you to compare pairs of images using overlays and add structured annotations
			for visual analysis.
		</p>

		<h3>Basic usage</h3>
		<ul>
			<li>Select an image pair from the left sidebar</li>
			<li>Pan and zoom images in sync</li>
			<li>Add annotations directly in the viewer</li>
			<li>Annotations are saved per image pair</li>
		</ul>

		<h3>Keyboard & mouse controls</h3>
		<ul>
			<li><kbd>[</kbd> — Open image pair sidebar</li>
			<li><kbd>]</kbd> — Open annotations sidebar</li>
			<li><kbd>Escape</kbd> or <kbd>1</kbd> — Pan image mode</li>
			<li><kbd>B</kbd> or <kbd>2</kbd> — Rectangle annotation mode</li>
			<li><kbd>P</kbd> or <kbd>3</kbd> — Polygon annotation mode</li>
			<li><kbd>Mouse wheel</kbd> — Zoom</li>
			<li><kbd>Shift</kbd> + <kbd>Mouse wheel</kbd> — Fade between images</li>
		</ul>
	</Modal>

	<Modal open={showAbout} title="About this tool" on:close={() => (showAbout = false)}>
		<p>
			Designed for visual comparison, this application allows pairs of images to be overlaid and
			annotated to support detailed analysis.
		</p>

		<p>
			It runs entirely in the browser and can load projects directly from a local folder, with
			annotations saved back to the project file where the browser allows.
		</p>

		<h3>Technologies used</h3>
		<ul>
			<li>
				<a
					href="https://svelte.dev/docs/kit/introduction"
					target="_blank"
					rel="noopener noreferrer"
				>
					SvelteKit
				</a>
				— application framework and UI architecture
			</li>
			<li>
				<a href="https://openseadragon.github.io/" target="_blank" rel="noopener noreferrer">
					OpenSeadragon
				</a>
				— high-resolution image viewing and deep zoom
			</li>
			<li>
				<a href="https://annotorious.dev/" target="_blank" rel="noopener noreferrer">
					Annotorious
				</a>
				— annotation primitives and interaction models
			</li>
		</ul>

		<p>
			Rather than acting as a single, all-in-one solution, the tool is intended to form part of a
			broader workflow. Additional tools are planned to support related stages, such as image
			alignment, comparison preparation, and transformation of annotation outputs for downstream
			use.
		</p>

		<p class="muted">
			This is an experimental application and a work in progress, intended for research,
			exploration, and prototyping workflows.
		</p>
		<p class="muted">
			For any enquiries or suggestions for further development, please contact Christopher Wilson —
			Software Developer, Artificial Intelligence and Ideas Adoption (AIIA), The University of
			Manchester.
		</p>
	</Modal>
</div>
