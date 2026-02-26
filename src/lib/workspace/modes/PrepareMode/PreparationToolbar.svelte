<script lang="ts">
	export let selectedImage;
</script>

<div class="toolbar">
	<span>Editing ID: {selectedImage.id}</span>
</div>

<style>
	.toolbar {
		padding: 0.5rem 1rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		font-size: 0.8rem;
		color: #4b5563;
	}
</style>
