/** File opener service: bridges VFS -> app launch for file opening. */

import { apps, windowManager, type AppID } from './apps.svelte';
import { get_app_for_file } from './file-registry';
import { read_file, stat } from './vfs.svelte';

/** Wrapper object so we never reassign the exported $state (Svelte 5 module constraint). */
export const file_opener_store = $state<{ pending: { path: string; content?: string } | null }>({
	pending: null,
});

/**
 * Open a file by path. Looks up the file type registry to determine which app handles it,
 * reads the file content from VFS, sets pending_file_open state, then launches the app.
 * The target app should call consume_pending_file() on mount/focus to receive the file.
 */
export function open_file(path: string): boolean {
	const node = stat(path);
	if (!node) return false;

	if (node.type === 'dir') {
		file_opener_store.pending = { path };
		windowManager.openApp('finder', { path });
		return true;
	}

	// Check for .app directories (launch the app)
	if (node.name.endsWith('.app')) {
		const app_name = node.name.replace('.app', '').toLowerCase().replace(/\s+/g, '-');
		if (app_name in apps.open) {
			windowManager.openApp(app_name as AppID);
			return true;
		}
		return false;
	}

	const app_id = get_app_for_file(node.name);
	if (!app_id) return false;

	const content = read_file(path);
	file_opener_store.pending = { path, content: content ?? undefined };
	windowManager.openApp(app_id, { path });
	return true;
}

/**
 * Consume the pending file open request. Returns the pending file info and clears the state.
 * Apps should call this when they mount or receive focus to check if a file was opened.
 */
export function consume_pending_file(): { path: string; content?: string } | null {
	const pending = file_opener_store.pending;
	file_opener_store.pending = null;
	return pending;
}
