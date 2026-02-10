<script lang="ts">
	export let src: string;
	export let label: string | undefined = undefined;

	let broken = false;
</script>

<div class="thumb">
	{#if !broken}
		<img
			{src}
			alt={label ?? 'Image'}
			on:error={() => (broken = true)}
			on:load={() => (broken = false)}
		/>
	{:else}
		<div class="placeholder">
			<div class="placeholder-icon">🖼️</div>
			<div class="placeholder-text">
				Re-import folder<br />to relink
			</div>
		</div>
	{/if}

	{#if label}
		<div class="label">{label} - {broken}</div>
	{/if}
</div>

<style>
	.thumb {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 120px;
	}

	img,
	.placeholder {
		width: 100%;
		height: 90px;
		border-radius: 4px;
		background: #eee;
	}

	img {
		object-fit: cover;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;

		text-align: center;
		font-size: 0.65rem;
		color: #666;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.placeholder-icon {
		font-size: 1.25rem;
		margin-bottom: 0.25rem;
		opacity: 0.6;
	}

	.placeholder-text {
		line-height: 1.2;
	}

	.label {
		font-size: 0.7rem;
		color: #444;
		word-break: break-word;
	}
</style>
