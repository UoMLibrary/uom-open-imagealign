<script>
	import MainVIew from '$lib/ImageAlign/MainView.svelte';
</script>

<main>
	<MainVIew />
</main>

<svelte:head>
	<title>Image Alignment Tool</title>
	<meta
		name="description"
		content="Experimental image alignment and registration tool for research, exploration, and prototyping workflows."
	/>
</svelte:head>

<style>
	main {
		position: relative;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}
</style>
