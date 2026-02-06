<script>
	import Modal from './Modal.svelte';

	export let open = false;
</script>

<Modal {open} title="About this tool" on:close={() => (open = false)}>
	<p>
		This application is designed to support the preparation stage of image-based annotation
		workflows. It focuses on organising collections of related images into structured pairs or
		groups that can be analysed and annotated consistently.
	</p>

	<p>
		Rather than annotating images directly, the tool generates structured project data that is
		consumed by the annotation viewer. This separation allows pairing, alignment, and annotation to
		be treated as distinct but connected stages in a broader workflow.
	</p>

	<h3>Image pairing and alignment</h3>
	<p>
		The tool attempts to identify related images using a combination of filename patterns and
		image-level characteristics. Once paired, a base image is selected to act as the coordinate
		reference for annotation placement.
	</p>

	<p>
		In cases where image dimensions differ, the base image may require a transformation to align it
		correctly with its paired image. Future versions of the tool are intended to integrate image
		alignment processes that automatically generate and store transformation matrices.
	</p>

	<h3>Technologies used</h3>
	<ul>
		<li>
			<a href="https://svelte.dev/docs/kit/introduction" target="_blank" rel="noopener noreferrer">
				SvelteKit
			</a>
			— application framework and UI architecture
		</li>
		<li>Client-side image processing techniques for analysis and comparison</li>
	</ul>

	<p>
		The output of this tool is a structured <code>project.json</code> file that captures image pairings,
		base image definitions, and any associated transformations. This file is designed to be consumed by
		downstream tools in the annotation workflow.
	</p>

	<p class="muted">
		This is an experimental application and a work in progress, intended for research, exploration,
		and prototyping workflows.
	</p>
	<p class="muted">
		For any enquiries or suggestions for further development, please contact Christopher Wilson —
		Software Developer, Artificial Intelligence and Ideas Adoption (AIIA), The University of
		Manchester.
	</p>
</Modal>
