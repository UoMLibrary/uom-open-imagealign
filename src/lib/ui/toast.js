import { writable } from 'svelte/store';

export const toast = writable(null);

export function showToast(message, type = 'info', timeout = 2500) {
	toast.set({ message, type });

	if (timeout) {
		setTimeout(() => toast.set(null), timeout);
	}
}
