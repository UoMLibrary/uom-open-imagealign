<script lang="ts">
	export let src: string;
	export let label: string | undefined = undefined;
</script>

<div class="thumb">
	<img {src} alt={label ?? 'Image'} />
	{#if label}
		<div class="label">{label}</div>
	{/if}
</div>

<style>
	.thumb {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 120px;
	}

	img {
		width: 100%;
		height: 90px;
		object-fit: cover;
		border-radius: 4px;
		background: #eee;
	}

	.label {
		font-size: 0.7rem;
		color: #444;
		word-break: break-word;
	}
</style>
