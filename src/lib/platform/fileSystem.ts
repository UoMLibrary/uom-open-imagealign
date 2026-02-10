/**
 * Detects whether the current browser environment supports the
 * File System Access API (e.g. `showDirectoryPicker`).
 *
 * This is used to decide whether the application can offer
 * native folder selection and re-linking of local image files,
 * or must fall back to `<input type="file" webkitdirectory>`.
 *
 * The check is intentionally feature-based (not user-agent based)
 * to ensure correct behaviour across browsers and hosting contexts.
 */

export function supportsFileSystemAccess(): boolean {
	return 'showDirectoryPicker' in window;
}


