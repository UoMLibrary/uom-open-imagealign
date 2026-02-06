<script>
	import { toast } from './toast';
</script>

{#if $toast}
	<div class="toast {$toast.type}">
		{$toast.message}
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		top: calc(48px + 0.75rem);
		right: 0;

		min-width: 280px;
		max-width: 360px;

		padding: 0.9rem 1.1rem;

		border-top-left-radius: 10px;
		border-bottom-left-radius: 10px;

		font-size: 0.85rem;
		font-weight: 600;
		line-height: 1.4;

		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;

		color: white;
		background: #374151;

		box-shadow:
			0 12px 24px rgba(0, 0, 0, 0.25),
			0 2px 6px rgba(0, 0, 0, 0.15);

		z-index: 2000;

		animation:
			toast-in 180ms ease-out,
			toast-out 300ms ease-in 1s forwards;
	}

	.toast.success {
		background: #16a34a;
	}

	.toast.error {
		background: #dc2626;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(-12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes toast-out {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(12px);
		}
	}
</style>
