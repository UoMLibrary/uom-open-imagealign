<script>
	import Modal from './Modal.svelte';

	export let open = false;
</script>

<Modal {open} title="How to use this tool" on:close={() => (open = false)}>
	<p>
		This tool prepares image sets for annotation by analysing a directory of images and generating
		paired (or grouped) image sets suitable for visual comparison and annotation.
	</p>

	<h3>Basic usage</h3>
	<ul>
		<li>Select a directory containing related images</li>
		<li>The tool scans filenames and image characteristics to suggest image pairs</li>
		<li>Each pair is reviewed and assigned a base image</li>
		<li>A project file is generated for use in the annotation tool</li>
	</ul>

	<h3>How image pairing works</h3>
	<ul>
		<li>Initial pairing attempts are based on filename similarity and ordering</li>
		<li>Additional strategies may compare image dimensions and visual similarity</li>
		<li>Pairs can be adjusted manually where automatic matching is ambiguous</li>
	</ul>

	<h3>Base image and coordinate system</h3>
	<ul>
		<li>Each image pair has a designated base image</li>
		<li>The base image defines the coordinate system for annotations</li>
		<li>
			If required, a transformation can be applied to the base image to match the paired image
		</li>
	</ul>

	<h3>Output</h3>
	<ul>
		<li>The result is a <code>project.json</code> file</li>
		<li>This file can be opened directly in the annotation tool</li>
		<li>Image pairing, base image selection, and transformations are stored together</li>
	</ul>
</Modal>
