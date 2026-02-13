<script>
	export let inline = false;
</script>

<header class="panel-header">
	<div class:inner-inline={inline} class="inner">
		<slot />
	</div>
</header>

<style>
	.panel-header {
		padding: 0.1rem 0.75rem;
		background: #eee;
		border-bottom: 1px solid #ddd;
		font-weight: bold;
	}

	.inner {
		display: block;
	}

	.inner-inline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
