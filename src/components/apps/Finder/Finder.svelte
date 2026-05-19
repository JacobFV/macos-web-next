<script lang="ts">
	import type { FSNode } from '../../../state/vfs.svelte';
	import {
		vfs_version,
		ls,
		mkdir,
		rm,
		mv,
		cp,
		stat,
		format_size,
		format_date_short,
	} from '../../../state/vfs.svelte';
	import { open_file } from '../../../state/file-opener.svelte';
	import {
		clipboard_store as clipboard_state,
		copy_files as clipboard_copy_files,
		paste_files as clipboard_paste_files,
	} from '../../../state/clipboard.svelte';
	import { get_file_type_label } from '../../../state/file-registry';
	import { apps, windowManager, type AppID } from '../../../state/apps.svelte';
	import { notify } from '../../../state/notifications.svelte';

	const FINDER_ICON = './app-icons/finder/256.webp';
	const FINDER_APP = 'Finder';

	type ViewMode = 'icons' | 'list' | 'columns' | 'gallery';

	// Internal type for display in list/icon/gallery/column views
	type FileEntry = {
		name: string;
		kind: string;
		size: string;
		modified: string;
		is_dir: boolean;
		vfs_path: string;
	};

	// VFS path state — we now track the actual absolute VFS path
	let current_vfs_path = $state('/Users/user');
	let path_history = $state<string[]>(['/Users/user']);
	let history_index = $state(0);

	let selected_files = $state<Set<string>>(new Set());
	let view_mode = $state<ViewMode>('list');
	let sort_by = $state<'name' | 'modified' | 'size' | 'kind'>('name');
	let sort_asc = $state(true);
	let search_query = $state('');
	let show_hidden = $state(false);

	// Context menu state
	let ctx_visible = $state(false);
	let ctx_x = $state(0);
	let ctx_y = $state(0);
	let ctx_target_file = $state<string | null>(null);

	// Rename state
	let renaming_file = $state<string | null>(null);
	let rename_value = $state('');

	// Drag selection state
	let drag_selecting = $state(false);
	let drag_start_x = $state(0);
	let drag_start_y = $state(0);
	let drag_current_x = $state(0);
	let drag_current_y = $state(0);

	// Keyboard focus tracking
	let focused_index = $state(-1);

	// Element refs
	let content_area_el: HTMLDivElement | undefined = $state(undefined);
	let rename_input_el: HTMLInputElement | undefined = $state(undefined);

	// Map sidebar items to VFS paths
	const sidebar_favorites = [
		{ name: 'AirDrop', icon: 'airdrop', vfs_path: '' },
		{ name: 'Recents', icon: 'recents', vfs_path: '' },
		{ name: 'Applications', icon: 'applications', vfs_path: '/Applications' },
		{ name: 'Desktop', icon: 'desktop', vfs_path: '/Users/user/Desktop' },
		{ name: 'Documents', icon: 'documents', vfs_path: '/Users/user/Documents' },
		{ name: 'Downloads', icon: 'downloads', vfs_path: '/Users/user/Downloads' },
		{ name: 'Home', icon: 'home', vfs_path: '/Users/user' },
	];

	const sidebar_locations = [
		{ name: 'iCloud Drive', icon: 'icloud', vfs_path: '' },
		{ name: 'Time Machine', icon: 'timemachine', vfs_path: '' },
		{ name: 'Macintosh HD', icon: 'disk', vfs_path: '/' },
		{ name: 'Network', icon: 'network', vfs_path: '' },
	];

	const sidebar_tags = [
		{ name: 'Red', color: '#ff3b30' },
		{ name: 'Orange', color: '#ff9500' },
		{ name: 'Yellow', color: '#ffcc00' },
		{ name: 'Green', color: '#34c759' },
		{ name: 'Blue', color: '#007aff' },
		{ name: 'Purple', color: '#af52de' },
		{ name: 'Gray', color: '#8e8e93' },
	];

	// Map VFS path to a display name for breadcrumbs
	function path_display_name(vfs_path: string): string {
		if (vfs_path === '/') return 'Macintosh HD';
		if (vfs_path === '/Users/user') return 'Home';
		if (vfs_path === '/Applications') return 'Applications';
		const parts = vfs_path.split('/').filter(Boolean);
		return parts[parts.length - 1] ?? '/';
	}

	// Build breadcrumb segments from current VFS path
	const breadcrumb_segments = $derived.by(() => {
		const segments: { label: string; vfs_path: string }[] = [];
		if (current_vfs_path === '/') {
			segments.push({ label: 'Macintosh HD', vfs_path: '/' });
			return segments;
		}
		const parts = current_vfs_path.split('/').filter(Boolean);
		let accumulated = '';
		for (const part of parts) {
			accumulated += '/' + part;
			segments.push({ label: path_display_name(accumulated), vfs_path: accumulated });
		}
		return segments;
	});

	// Display name for current folder (last breadcrumb)
	const current_folder_display = $derived(
		breadcrumb_segments.length > 0
			? breadcrumb_segments[breadcrumb_segments.length - 1].label
			: 'Finder'
	);

	function get_sidebar_svg(icon: string): string {
		switch (icon) {
			case 'icloud':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 13H4a3.5 3.5 0 01-.5-6.96A5 5 0 019 2a5 5 0 014.9 4.1A3 3 0 0113.5 13z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
			case 'timemachine':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5V8l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 3.5C1.3 5 .5 6.4.5 8A7.5 7.5 0 008 15.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 3.5L1 5.5M2.5 3.5L4.5 5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			case 'airdrop':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="2"/><path d="M4 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/><path d="M1 14c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
			case 'recents':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4.5l3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
			case 'applications':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>';
			case 'desktop':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 14h6M8 12v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
			case 'documents':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h7l3 3v11H3V1z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10 1v3h3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h6M5 9h6M5 11h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>';
			case 'downloads':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2v8M5 7l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
			case 'home':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 8l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7v6a1 1 0 001 1h8a1 1 0 001-1V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
			case 'disk':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="4" width="14" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="8" r="1"/><path d="M1 10h14" stroke="currentColor" stroke-width="0.8"/></svg>';
			case 'network':
				return '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="8" cy="8" rx="3" ry="6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 8h12M3 5h10M3 11h10" stroke="currentColor" stroke-width="0.8"/></svg>';
			default:
				return '';
		}
	}

	function get_file_icon_svg(entry: FileEntry): string {
		const ext = entry.name.split('.').pop()?.toLowerCase() || '';
		const kind = entry.kind;

		if (entry.is_dir && !entry.name.endsWith('.app')) {
			return '<svg viewBox="0 0 40 34" fill="none"><path d="M2 6C2 4.34 3.34 3 5 3h10l3 4h17c1.66 0 3 1.34 3 3v18c0 1.66-1.34 3-3 3H5c-1.66 0-3-1.34-3-3V6z" fill="#64B5F6"/><path d="M2 10h36v18c0 1.66-1.34 3-3 3H5c-1.66 0-3-1.34-3-3V10z" fill="#42A5F5"/></svg>';
		}

		if (kind === 'Application' || ext === 'app') {
			return '<svg viewBox="0 0 40 40" fill="none"><rect x="4" y="4" width="32" height="32" rx="8" fill="#E0E0E0" stroke="#BDBDBD" stroke-width="1"/><rect x="8" y="8" width="24" height="24" rx="4" fill="#667eea"/><path d="M16 16h8v8h-8z" fill="white" opacity="0.8"/></svg>';
		}

		if (kind === 'PDF Document' || ext === 'pdf') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><rect x="6" y="22" width="22" height="6" rx="1" fill="#FF3B30"/><text x="17" y="27" text-anchor="middle" fill="white" font-size="5" font-weight="bold" font-family="sans-serif">PDF</text></svg>';
		}

		if (kind.includes('Image') || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><rect x="6" y="16" width="22" height="14" rx="1" fill="#E8F5E9"/><circle cx="12" cy="21" r="2" fill="#66BB6A"/><path d="M6 28l6-5 4 3 5-6 7 8H6z" fill="#43A047"/></svg>';
		}

		if (kind === 'Plain Text' || kind === 'Markdown' || ext === 'txt' || ext === 'md') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><path d="M8 16h18M8 20h18M8 24h14M8 28h10" stroke="#BDBDBD" stroke-width="1.5" stroke-linecap="round"/></svg>';
		}

		if (kind === 'Word Document' || ext === 'docx' || ext === 'doc') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><rect x="6" y="22" width="22" height="6" rx="1" fill="#2B579A"/><text x="17" y="27" text-anchor="middle" fill="white" font-size="5" font-weight="bold" font-family="sans-serif">DOC</text></svg>';
		}

		if (kind === 'Excel Spreadsheet' || ext === 'xlsx' || ext === 'xls') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><rect x="6" y="22" width="22" height="6" rx="1" fill="#217346"/><text x="17" y="27" text-anchor="middle" fill="white" font-size="5" font-weight="bold" font-family="sans-serif">XLS</text></svg>';
		}

		if (kind === 'Disk Image' || ext === 'dmg') {
			return '<svg viewBox="0 0 40 34" fill="none"><rect x="2" y="4" width="36" height="26" rx="4" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="1.5"/><circle cx="20" cy="17" r="8" fill="none" stroke="#9E9E9E" stroke-width="1.5"/><circle cx="20" cy="17" r="3" fill="#9E9E9E"/></svg>';
		}

		if (kind === 'ZIP Archive' || ext === 'zip') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><rect x="14" y="4" width="6" height="3" fill="#9E9E9E"/><rect x="14" y="10" width="6" height="3" fill="#9E9E9E"/><rect x="14" y="16" width="6" height="3" fill="#9E9E9E"/><rect x="13" y="22" width="8" height="6" rx="1" fill="#9E9E9E"/><rect x="15" y="24" width="4" height="2" rx="0.5" fill="white"/></svg>';
		}

		if (kind === 'Installer Package' || ext === 'pkg') {
			return '<svg viewBox="0 0 40 40" fill="none"><rect x="4" y="8" width="32" height="24" rx="3" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="1.5"/><path d="M4 14h32" stroke="#BDBDBD" stroke-width="1"/><circle cx="20" cy="23" r="5" fill="#42A5F5"/><path d="M18 23l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		}

		if (kind === 'Keynote Presentation' || ext === 'key') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><rect x="6" y="22" width="22" height="6" rx="1" fill="#007AFF"/><text x="17" y="27" text-anchor="middle" fill="white" font-size="5" font-weight="bold" font-family="sans-serif">KEY</text></svg>';
		}

		if (ext === 'json') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><text x="17" y="26" text-anchor="middle" fill="#FFA000" font-size="7" font-weight="bold" font-family="monospace">{}</text></svg>';
		}

		if (ext === 'sketch') {
			return '<svg viewBox="0 0 40 40" fill="none"><path d="M20 4l16 12-16 20L4 16z" fill="#FDB300"/><path d="M20 4l16 12H4z" fill="#FDD231"/><path d="M4 16l16 20 16-20" fill="#FDAD00"/></svg>';
		}

		if (ext === 'mov' || ext === 'mp4' || ext === 'avi') {
			return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/><path d="M13 18v10l9-5z" fill="#9E9E9E"/></svg>';
		}

		// Default document icon
		return '<svg viewBox="0 0 34 40" fill="none"><path d="M2 4c0-1.1.9-2 2-2h18l10 10v24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4z" fill="white" stroke="#E0E0E0" stroke-width="1.5"/><path d="M22 2v8h10" fill="#E0E0E0"/></svg>';
	}

	/** Convert an FSNode to a display FileEntry */
	function node_to_entry(node: FSNode, parent_path: string): FileEntry {
		const is_dir = node.type === 'dir';
		const full_path = parent_path === '/' ? '/' + node.name : parent_path + '/' + node.name;
		let kind: string;
		if (is_dir) {
			if (node.name.endsWith('.app')) {
				kind = 'Application';
			} else {
				kind = 'Folder';
			}
		} else {
			kind = get_file_type_label(node.name);
		}
		return {
			name: node.name,
			kind,
			size: is_dir ? '--' : format_size(node.size),
			modified: format_date_short(node.modified),
			is_dir,
			vfs_path: full_path,
		};
	}

	/** Get sorted, filtered entries from VFS for the current path */
	function get_sorted_files(entries: FileEntry[]): FileEntry[] {
		let filtered = entries;
		if (!show_hidden) {
			filtered = filtered.filter(f => !f.name.startsWith('.'));
		}
		if (search_query.trim()) {
			const q = search_query.toLowerCase();
			filtered = filtered.filter(f => f.name.toLowerCase().includes(q));
		}
		return [...filtered].sort((a, b) => {
			// Folders always first
			if (a.is_dir && !a.name.endsWith('.app') && (!b.is_dir || b.name.endsWith('.app'))) return -1;
			if ((!a.is_dir || a.name.endsWith('.app')) && b.is_dir && !b.name.endsWith('.app')) return 1;

			let cmp = 0;
			switch (sort_by) {
				case 'name':
					cmp = a.name.localeCompare(b.name);
					break;
				case 'modified':
					cmp = a.modified.localeCompare(b.modified);
					break;
				case 'size':
					cmp = parse_size(a.size) - parse_size(b.size);
					break;
				case 'kind':
					cmp = a.kind.localeCompare(b.kind);
					break;
			}
			return sort_asc ? cmp : -cmp;
		});
	}

	function parse_size(s: string): number {
		if (s === '--') return 0;
		const num = parseFloat(s);
		if (s.includes('GB')) return num * 1024 * 1024;
		if (s.includes('MB')) return num * 1024;
		if (s.includes('KB')) return num;
		return num;
	}

	// Reactive file list from VFS
	const raw_entries = $derived.by(() => {
		// Touch vfs_version to trigger reactivity on any VFS mutation
		void vfs_version.value;
		const nodes = ls(current_vfs_path);
		return nodes.map(n => node_to_entry(n, current_vfs_path));
	});

	const current_files = $derived(get_sorted_files(raw_entries));

	const item_count_text = $derived(
		(() => {
			const count = current_files.length;
			if (selected_files.size > 0) {
				return `${selected_files.size} of ${count} selected`;
			}
			return `${count} item${count !== 1 ? 's' : ''}`;
		})()
	);

	const available_text = $derived('142.8 GB available');

	function navigate_to_path(vfs_path: string) {
		if (vfs_path === current_vfs_path) return;
		// Trim forward history if we navigate from mid-history
		if (history_index < path_history.length - 1) {
			path_history = path_history.slice(0, history_index + 1);
		}
		path_history = [...path_history, vfs_path];
		history_index = path_history.length - 1;
		current_vfs_path = vfs_path;
		selected_files = new Set();
		renaming_file = null;
		search_query = '';
		focused_index = -1;
	}

	function navigate_sidebar(item: { name: string; vfs_path: string }) {
		if (!item.vfs_path) return; // AirDrop, Recents, iCloud, Time Machine, Network — no real path
		navigate_to_path(item.vfs_path);
	}

	function go_back() {
		if (history_index > 0) {
			history_index--;
			current_vfs_path = path_history[history_index];
			selected_files = new Set();
			renaming_file = null;
			focused_index = -1;
		}
	}

	function go_forward() {
		if (history_index < path_history.length - 1) {
			history_index++;
			current_vfs_path = path_history[history_index];
			selected_files = new Set();
			renaming_file = null;
			focused_index = -1;
		}
	}

	function handle_file_click(file: FileEntry, event: MouseEvent) {
		renaming_file = null;
		const idx = current_files.indexOf(file);
		if (event.metaKey || event.ctrlKey) {
			const new_set = new Set(selected_files);
			if (new_set.has(file.name)) {
				new_set.delete(file.name);
			} else {
				new_set.add(file.name);
			}
			selected_files = new_set;
		} else if (event.shiftKey && focused_index >= 0) {
			const start = Math.min(focused_index, idx);
			const end = Math.max(focused_index, idx);
			const new_set = new Set<string>();
			for (let i = start; i <= end; i++) {
				new_set.add(current_files[i].name);
			}
			selected_files = new_set;
		} else {
			selected_files = new Set([file.name]);
		}
		focused_index = idx;
	}

	function handle_file_dblclick(file: FileEntry) {
		if (file.is_dir && !file.name.endsWith('.app')) {
			// Navigate into directory
			navigate_to_path(file.vfs_path);
		} else if (file.name.endsWith('.app')) {
			// Launch the app
			const app_name = file.name.replace('.app', '').toLowerCase().replace(/\s+/g, '-');
			if (app_name in apps.open) {
				windowManager.openApp(app_name as AppID);
			}
		} else {
			// Open the file with the appropriate app
			open_file(file.vfs_path);
		}
	}

	function handle_context_menu(event: MouseEvent, file_name: string | null) {
		event.preventDefault();
		event.stopPropagation();

		const rect = (event.currentTarget as HTMLElement).closest('.content-area')?.getBoundingClientRect();
		if (rect) {
			ctx_x = event.clientX - rect.left;
			ctx_y = event.clientY - rect.top;
		} else {
			ctx_x = event.clientX;
			ctx_y = event.clientY;
		}

		ctx_target_file = file_name;
		if (file_name && !selected_files.has(file_name)) {
			selected_files = new Set([file_name]);
		}
		ctx_visible = true;
	}

	function close_context_menu() {
		ctx_visible = false;
	}

	const can_paste = $derived(clipboard_state.current !== null && clipboard_state.current.type === 'files');

	function ctx_action(action: string) {
		switch (action) {
			case 'new-folder': {
				// Find a unique name
				let base = 'untitled folder';
				let name = base;
				let counter = 1;
				const full_path = current_vfs_path === '/' ? '/' + name : current_vfs_path + '/' + name;
				while (stat(full_path.replace(name, counter > 1 ? `${base} ${counter}` : base)) !== null) {
					counter++;
					name = `${base} ${counter}`;
				}
				const final_path = current_vfs_path === '/' ? '/' + name : current_vfs_path + '/' + name;
				mkdir(final_path);
				notify({
					app_name: FINDER_APP,
					app_icon: FINDER_ICON,
					title: 'New Folder Created',
					body: `"${name}" created in ${path_display_name(current_vfs_path)}`,
				});
				renaming_file = name;
				rename_value = name;
				selected_files = new Set([name]);
				break;
			}
			case 'get-info':
				break;
			case 'copy': {
				const paths = [...selected_files].map(name =>
					current_vfs_path === '/' ? '/' + name : current_vfs_path + '/' + name
				);
				clipboard_copy_files(paths, 'copy');
				break;
			}
			case 'cut': {
				const paths = [...selected_files].map(name =>
					current_vfs_path === '/' ? '/' + name : current_vfs_path + '/' + name
				);
				clipboard_copy_files(paths, 'cut');
				break;
			}
			case 'paste': {
				const pasted = clipboard_paste_files();
				if (pasted) {
					const paste_count = pasted.paths.length;
					for (const src_path of pasted.paths) {
						const file_name = src_path.split('/').filter(Boolean).pop();
						if (!file_name) continue;
						const dest_path = current_vfs_path === '/'
							? '/' + file_name
							: current_vfs_path + '/' + file_name;
						if (pasted.action === 'cut') {
							mv(src_path, dest_path);
						} else {
							cp(src_path, dest_path);
						}
					}
					const item_label = paste_count === 1 ? '1 item' : `${paste_count} items`;
					notify({
						app_name: FINDER_APP,
						app_icon: FINDER_ICON,
						title: 'Paste Complete',
						body: `${item_label} ${pasted.action === 'cut' ? 'moved' : 'pasted'} to ${path_display_name(current_vfs_path)}`,
					});
				}
				break;
			}
			case 'rename':
				if (selected_files.size === 1) {
					const name = [...selected_files][0];
					renaming_file = name;
					rename_value = name;
				}
				break;
			case 'duplicate': {
				const dup_count = selected_files.size;
				for (const fname of selected_files) {
					const src_path = current_vfs_path === '/' ? '/' + fname : current_vfs_path + '/' + fname;
					const dest_path = src_path + ' copy';
					cp(src_path, dest_path);
				}
				const dup_label = dup_count === 1 ? '1 item' : `${dup_count} items`;
				notify({
					app_name: FINDER_APP,
					app_icon: FINDER_ICON,
					title: 'Copy Complete',
					body: `${dup_label} duplicated in ${path_display_name(current_vfs_path)}`,
				});
				break;
			}
			case 'move-to-trash': {
				const trash_count = selected_files.size;
				for (const fname of selected_files) {
					const full_path = current_vfs_path === '/' ? '/' + fname : current_vfs_path + '/' + fname;
					rm(full_path, true);
				}
				const trash_label = trash_count === 1 ? '1 item' : `${trash_count} items`;
				notify({
					app_name: FINDER_APP,
					app_icon: FINDER_ICON,
					title: 'Moved to Trash',
					body: `${trash_label} moved to Trash`,
				});
				selected_files = new Set();
				focused_index = -1;
				break;
			}
			case 'select-all':
				selected_files = new Set(current_files.map(f => f.name));
				break;
		}
		close_context_menu();
	}

	function finish_rename() {
		if (renaming_file && rename_value.trim()) {
			const old_path = current_vfs_path === '/'
				? '/' + renaming_file
				: current_vfs_path + '/' + renaming_file;
			const new_path = current_vfs_path === '/'
				? '/' + rename_value.trim()
				: current_vfs_path + '/' + rename_value.trim();
			if (old_path !== new_path) {
				mv(old_path, new_path);
				notify({
					app_name: FINDER_APP,
					app_icon: FINDER_ICON,
					title: 'Rename Complete',
					body: `"${renaming_file}" renamed to "${rename_value.trim()}"`,
				});
			}
			selected_files = new Set([rename_value.trim()]);
		}
		renaming_file = null;
	}

	function handle_rename_keydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			finish_rename();
		} else if (event.key === 'Escape') {
			renaming_file = null;
		}
	}

	function handle_sort(column: 'name' | 'modified' | 'size' | 'kind') {
		if (sort_by === column) {
			sort_asc = !sort_asc;
		} else {
			sort_by = column;
			sort_asc = true;
		}
	}

	function clear_selection_on_empty(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			selected_files = new Set();
			renaming_file = null;
			focused_index = -1;
		}
	}

	function navigate_to_breadcrumb(index: number) {
		const segment = breadcrumb_segments[index];
		if (segment) {
			navigate_to_path(segment.vfs_path);
		}
	}

	// Keyboard navigation
	function handle_keydown(event: KeyboardEvent) {
		if (renaming_file) return;

		const meta = event.metaKey || event.ctrlKey;

		if (meta && event.shiftKey && event.key === '.') {
			event.preventDefault();
			show_hidden = !show_hidden;
			return;
		}

		if (meta && event.key === 'a') {
			event.preventDefault();
			selected_files = new Set(current_files.map(f => f.name));
			return;
		}

		if (event.key === 'Backspace' && meta) {
			event.preventDefault();
			if (selected_files.size > 0) {
				const del_count = selected_files.size;
				for (const fname of selected_files) {
					const full_path = current_vfs_path === '/' ? '/' + fname : current_vfs_path + '/' + fname;
					rm(full_path, true);
				}
				const del_label = del_count === 1 ? '1 item' : `${del_count} items`;
				notify({
					app_name: FINDER_APP,
					app_icon: FINDER_ICON,
					title: 'Moved to Trash',
					body: `${del_label} moved to Trash`,
				});
				selected_files = new Set();
				focused_index = -1;
			}
			return;
		}

		if (meta && event.key === 'c') {
			event.preventDefault();
			if (selected_files.size > 0) {
				const paths = [...selected_files].map(name =>
					current_vfs_path === '/' ? '/' + name : current_vfs_path + '/' + name
				);
				clipboard_copy_files(paths, 'copy');
			}
			return;
		}

		if (meta && event.key === 'x') {
			event.preventDefault();
			if (selected_files.size > 0) {
				const paths = [...selected_files].map(name =>
					current_vfs_path === '/' ? '/' + name : current_vfs_path + '/' + name
				);
				clipboard_copy_files(paths, 'cut');
			}
			return;
		}

		if (meta && event.key === 'v') {
			event.preventDefault();
			ctx_action('paste');
			return;
		}

		if (event.key === 'Enter' && selected_files.size === 1) {
			event.preventDefault();
			const name = [...selected_files][0];
			const file = current_files.find(f => f.name === name);
			if (file) {
				handle_file_dblclick(file);
			}
			return;
		}

		if (event.key === 'Backspace' && !meta && history_index > 0) {
			event.preventDefault();
			go_back();
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (current_files.length === 0) return;
			const next = focused_index < current_files.length - 1 ? focused_index + 1 : focused_index;
			focused_index = next;
			if (event.shiftKey) {
				const new_set = new Set(selected_files);
				new_set.add(current_files[next].name);
				selected_files = new_set;
			} else {
				selected_files = new Set([current_files[next].name]);
			}
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (current_files.length === 0) return;
			const prev = focused_index > 0 ? focused_index - 1 : 0;
			focused_index = prev;
			if (event.shiftKey) {
				const new_set = new Set(selected_files);
				new_set.add(current_files[prev].name);
				selected_files = new_set;
			} else {
				selected_files = new Set([current_files[prev].name]);
			}
			return;
		}
	}

	// Drag selection handlers
	function handle_drag_start(event: MouseEvent) {
		if (event.target !== event.currentTarget) return;
		if (event.button !== 0) return;

		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		drag_start_x = event.clientX - rect.left;
		drag_start_y = event.clientY - rect.top;
		drag_current_x = drag_start_x;
		drag_current_y = drag_start_y;
		drag_selecting = true;

		if (!event.shiftKey && !event.metaKey) {
			selected_files = new Set();
		}
	}

	function handle_drag_move(event: MouseEvent) {
		if (!drag_selecting) return;
		const rect = content_area_el?.getBoundingClientRect();
		if (!rect) return;
		drag_current_x = event.clientX - rect.left;
		drag_current_y = event.clientY - rect.top;
	}

	function handle_drag_end() {
		drag_selecting = false;
	}

	const drag_rect_style = $derived(
		drag_selecting
			? `left:${Math.min(drag_start_x, drag_current_x)}px;top:${Math.min(drag_start_y, drag_current_y)}px;width:${Math.abs(drag_current_x - drag_start_x)}px;height:${Math.abs(drag_current_y - drag_start_y)}px`
			: ''
	);

	// Auto-focus rename input
	$effect(() => {
		if (renaming_file && rename_input_el) {
			rename_input_el.focus();
			rename_input_el.select();
		}
	});

	// Clean up drag selection on mouse up globally
	$effect(() => {
		const handler = () => {
			if (drag_selecting) {
				drag_selecting = false;
			}
		};
		window.addEventListener('mouseup', handler);
		return () => window.removeEventListener('mouseup', handler);
	});

	// Helper to check if a sidebar item is active
	function is_sidebar_active(item: { vfs_path: string }): boolean {
		return item.vfs_path !== '' && current_vfs_path === item.vfs_path;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
	class="container"
	onclick={close_context_menu}
	onkeydown={handle_keydown}
	tabindex="0"
>
	<!-- Toolbar -->
	<header class="app-window-drag-handle toolbar">
		<div class="toolbar-nav">
			<button
				class="nav-btn"
				onclick={go_back}
				disabled={history_index <= 0}
				title="Back"
			>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
					<path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
			<button
				class="nav-btn"
				onclick={go_forward}
				disabled={history_index >= path_history.length - 1}
				title="Forward"
			>
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
					<path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		</div>

		<div class="toolbar-title">
			{#each breadcrumb_segments as segment, i}
				{#if i > 0}
					<span class="title-separator">
						<svg width="7" height="10" viewBox="0 0 7 10" fill="none">
							<path d="M1.5 1.5l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</span>
				{/if}
				<button
					class="title-segment"
					class:current={i === breadcrumb_segments.length - 1}
					onclick={() => navigate_to_breadcrumb(i)}
				>
					{segment.label}
				</button>
			{/each}
		</div>

		<div class="toolbar-right">
			<div class="view-buttons">
				<button
					class="view-btn"
					class:active={view_mode === 'icons'}
					onclick={() => view_mode = 'icons'}
					title="Icon view"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<rect x="1" y="1" width="5" height="5" rx="1"/>
						<rect x="8" y="1" width="5" height="5" rx="1"/>
						<rect x="1" y="8" width="5" height="5" rx="1"/>
						<rect x="8" y="8" width="5" height="5" rx="1"/>
					</svg>
				</button>
				<button
					class="view-btn"
					class:active={view_mode === 'list'}
					onclick={() => view_mode = 'list'}
					title="List view"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<rect x="1" y="1.5" width="12" height="2" rx="0.5"/>
						<rect x="1" y="6" width="12" height="2" rx="0.5"/>
						<rect x="1" y="10.5" width="12" height="2" rx="0.5"/>
					</svg>
				</button>
				<button
					class="view-btn"
					class:active={view_mode === 'columns'}
					onclick={() => view_mode = 'columns'}
					title="Column view"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<rect x="1" y="1" width="3.5" height="12" rx="0.5"/>
						<rect x="5.5" y="1" width="3.5" height="12" rx="0.5"/>
						<rect x="10" y="1" width="3.5" height="12" rx="0.5"/>
					</svg>
				</button>
				<button
					class="view-btn"
					class:active={view_mode === 'gallery'}
					onclick={() => view_mode = 'gallery'}
					title="Gallery view"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
						<rect x="1" y="1" width="12" height="9" rx="1"/>
						<rect x="1" y="11.5" width="3" height="1.5" rx="0.5"/>
						<rect x="5.5" y="11.5" width="3" height="1.5" rx="0.5"/>
						<rect x="10" y="11.5" width="3" height="1.5" rx="0.5"/>
					</svg>
				</button>
			</div>

			<div class="toolbar-separator"></div>

			<button class="action-btn" title="Group items">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
					<rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
					<rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
					<rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
					<rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
				</svg>
			</button>

			<button class="action-btn" title="Share">
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
					<path d="M7 1v8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
					<path d="M4 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M2 9v3a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
				</svg>
			</button>

			<div class="toolbar-separator"></div>

			<div class="search-wrapper">
				<svg class="search-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
					<circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.3"/>
					<path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
				</svg>
				<input
					class="search-input"
					type="text"
					placeholder="Search"
					bind:value={search_query}
				/>
			</div>
		</div>
	</header>

	<div class="main">
		<!-- Sidebar -->
		<aside class="sidebar">
			<div class="sidebar-section">
				<div class="sidebar-section-title">Favorites</div>
				{#each sidebar_favorites as item}
					<button
						class="sidebar-item"
						class:active={is_sidebar_active(item)}
						onclick={() => navigate_sidebar(item)}
					>
						<span class="sidebar-icon" class:icon-active={is_sidebar_active(item)}>
							{@html get_sidebar_svg(item.icon)}
						</span>
						<span class="sidebar-label">{item.name}</span>
					</button>
				{/each}
			</div>

			<div class="sidebar-section">
				<div class="sidebar-section-title">Locations</div>
				{#each sidebar_locations as item}
					<button
						class="sidebar-item"
						class:active={is_sidebar_active(item)}
						onclick={() => navigate_sidebar(item)}
					>
						<span class="sidebar-icon" class:icon-active={is_sidebar_active(item)}>
							{@html get_sidebar_svg(item.icon)}
						</span>
						<span class="sidebar-label">{item.name}</span>
					</button>
				{/each}
			</div>

			<div class="sidebar-section">
				<div class="sidebar-section-title">Tags</div>
				{#each sidebar_tags as tag}
					<button class="sidebar-item tag-item">
						<span class="tag-dot" style="background-color: {tag.color}"></span>
						<span class="sidebar-label">{tag.name}</span>
					</button>
				{/each}
				<button
					class="sidebar-item all-tags-item"
					onclick={() => {}}
				>
					<svg class="sidebar-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
						<path d="M1 3.5A1.5 1.5 0 012.5 2h4.586a1.5 1.5 0 011.06.44l5.415 5.414a1.5 1.5 0 010 2.122l-4.586 4.585a1.5 1.5 0 01-2.121 0L1.439 9.146A1.5 1.5 0 011 8.086V3.5z" stroke="currentColor" stroke-width="1.3"/>
						<circle cx="4.5" cy="5.5" r="1" fill="currentColor"/>
					</svg>
					<span>All Tags…</span>
				</button>
			</div>
		</aside>

		<!-- Content area -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="content-area"
			bind:this={content_area_el}
			oncontextmenu={(e) => handle_context_menu(e, null)}
			onclick={clear_selection_on_empty}
			onmousedown={handle_drag_start}
			onmousemove={handle_drag_move}
			onmouseup={handle_drag_end}
		>
			{#if view_mode === 'list'}
				<!-- List view -->
				<div class="column-headers">
					<button class="col-header col-name" onclick={() => handle_sort('name')}>
						<span>Name</span>
						{#if sort_by === 'name'}
							<svg class="sort-chevron" class:desc={!sort_asc} width="8" height="5" viewBox="0 0 8 5" fill="none">
								<path d="M1 4L4 1L7 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						{/if}
					</button>
					<button class="col-header col-modified" onclick={() => handle_sort('modified')}>
						<span>Date Modified</span>
						{#if sort_by === 'modified'}
							<svg class="sort-chevron" class:desc={!sort_asc} width="8" height="5" viewBox="0 0 8 5" fill="none">
								<path d="M1 4L4 1L7 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						{/if}
					</button>
					<button class="col-header col-size" onclick={() => handle_sort('size')}>
						<span>Size</span>
						{#if sort_by === 'size'}
							<svg class="sort-chevron" class:desc={!sort_asc} width="8" height="5" viewBox="0 0 8 5" fill="none">
								<path d="M1 4L4 1L7 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						{/if}
					</button>
					<button class="col-header col-kind" onclick={() => handle_sort('kind')}>
						<span>Kind</span>
						{#if sort_by === 'kind'}
							<svg class="sort-chevron" class:desc={!sort_asc} width="8" height="5" viewBox="0 0 8 5" fill="none">
								<path d="M1 4L4 1L7 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						{/if}
					</button>
				</div>

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="file-list" onclick={clear_selection_on_empty}>
					{#if current_files.length === 0}
						<div class="empty-folder">
							<div class="empty-folder-content">
								<svg class="empty-folder-icon" width="64" height="64" viewBox="0 0 64 64" fill="none">
									<path d="M8 16c0-2.21 2.69-4 6-4h14l4 6h18c3.31 0 6 1.79 6 4v28c0 2.21-2.69 4-6 4H14c-3.31 0-6-1.79-6-4V16z" fill="#D1D1D6" opacity="0.5"/>
									<path d="M8 22h48v28c0 2.21-2.69 4-6 4H14c-3.31 0-6-1.79-6-4V22z" fill="#C7C7CC" opacity="0.4"/>
								</svg>
								<span class="empty-folder-text">
									{#if search_query}
										No items match "{search_query}"
									{:else}
										This folder is empty
									{/if}
								</span>
							</div>
						</div>
					{/if}
					{#each current_files as file, i (file.name)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="file-row"
							class:selected={selected_files.has(file.name)}
							class:focused={focused_index === i}
							class:even={i % 2 === 0}
							onclick={(e) => { e.stopPropagation(); handle_file_click(file, e); }}
							ondblclick={() => handle_file_dblclick(file)}
							oncontextmenu={(e) => handle_context_menu(e, file.name)}
							role="button"
							tabindex="-1"
						>
							<span class="col-name">
								<span class="file-icon-wrapper list-icon">
									{@html get_file_icon_svg(file)}
								</span>
								{#if renaming_file === file.name}
									<input
										class="rename-input"
										type="text"
										bind:value={rename_value}
										bind:this={rename_input_el}
										onblur={finish_rename}
										onkeydown={handle_rename_keydown}
									/>
								{:else}
									<span class="file-name-text">{file.name}</span>
								{/if}
							</span>
							<span class="col-modified">{file.modified}</span>
							<span class="col-size">{file.size}</span>
							<span class="col-kind">{file.kind}</span>
						</div>
					{/each}
				</div>

			{:else if view_mode === 'icons'}
				<!-- Icon view -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="icon-grid" onclick={clear_selection_on_empty}>
					{#if current_files.length === 0}
						<div class="empty-folder">
							<div class="empty-folder-content">
								<svg class="empty-folder-icon" width="64" height="64" viewBox="0 0 64 64" fill="none">
									<path d="M8 16c0-2.21 2.69-4 6-4h14l4 6h18c3.31 0 6 1.79 6 4v28c0 2.21-2.69 4-6 4H14c-3.31 0-6-1.79-6-4V16z" fill="#D1D1D6" opacity="0.5"/>
									<path d="M8 22h48v28c0 2.21-2.69 4-6 4H14c-3.31 0-6-1.79-6-4V22z" fill="#C7C7CC" opacity="0.4"/>
								</svg>
								<span class="empty-folder-text">
									{#if search_query}
										No items match "{search_query}"
									{:else}
										This folder is empty
									{/if}
								</span>
							</div>
						</div>
					{/if}
					{#each current_files as file, i (file.name)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="icon-item"
							class:selected={selected_files.has(file.name)}
							onclick={(e) => { e.stopPropagation(); handle_file_click(file, e); }}
							ondblclick={() => handle_file_dblclick(file)}
							oncontextmenu={(e) => handle_context_menu(e, file.name)}
							role="button"
							tabindex="-1"
						>
							<div class="icon-image">
								{@html get_file_icon_svg(file)}
							</div>
							{#if renaming_file === file.name}
								<input
									class="rename-input icon-rename"
									type="text"
									bind:value={rename_value}
									bind:this={rename_input_el}
									onblur={finish_rename}
									onkeydown={handle_rename_keydown}
								/>
							{:else}
								<div class="icon-label" class:selected-label={selected_files.has(file.name)}>
									{file.name}
								</div>
							{/if}
						</div>
					{/each}
				</div>

			{:else if view_mode === 'columns'}
				<!-- Column view -->
				<div class="column-view">
					<div class="column-pane">
						{#each current_files as file, i (file.name)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="column-row"
								class:selected={selected_files.has(file.name)}
								onclick={(e) => { e.stopPropagation(); handle_file_click(file, e); }}
								ondblclick={() => handle_file_dblclick(file)}
								oncontextmenu={(e) => handle_context_menu(e, file.name)}
								role="button"
								tabindex="-1"
							>
								<span class="file-icon-wrapper column-icon">
									{@html get_file_icon_svg(file)}
								</span>
								<span class="column-file-name">{file.name}</span>
								{#if file.is_dir}
									<span class="column-arrow">
										<svg width="6" height="10" viewBox="0 0 6 10" fill="none">
											<path d="M1 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</span>
								{/if}
							</div>
						{/each}
						{#if current_files.length === 0}
							<div class="empty-column">Empty</div>
						{/if}
					</div>

					<!-- Preview column for selected file -->
					{#if selected_files.size === 1}
						{@const sel_name = [...selected_files][0]}
						{@const sel_file = current_files.find(f => f.name === sel_name)}
						{#if sel_file}
							<div class="column-pane preview-column">
								<div class="preview-icon">
									{@html get_file_icon_svg(sel_file)}
								</div>
								<div class="preview-name">{sel_file.name}</div>
								<div class="preview-details">
									<div class="preview-detail-row">
										<span class="preview-label">Kind</span>
										<span class="preview-value">{sel_file.kind}</span>
									</div>
									<div class="preview-detail-row">
										<span class="preview-label">Size</span>
										<span class="preview-value">{sel_file.size}</span>
									</div>
									<div class="preview-detail-row">
										<span class="preview-label">Modified</span>
										<span class="preview-value">{sel_file.modified}</span>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>

			{:else if view_mode === 'gallery'}
				<!-- Gallery view -->
				<div class="gallery-view">
					<div class="gallery-preview-area">
						{#if selected_files.size === 1}
							{@const sel_name = [...selected_files][0]}
							{@const sel_file = current_files.find(f => f.name === sel_name)}
							{#if sel_file}
								<div class="gallery-large-icon">
									{@html get_file_icon_svg(sel_file)}
								</div>
								<div class="gallery-file-name">{sel_file.name}</div>
								<div class="gallery-file-info">{sel_file.kind} &mdash; {sel_file.size}</div>
							{/if}
						{:else}
							<div class="gallery-placeholder">Select a file to preview</div>
						{/if}
					</div>
					<div class="gallery-strip">
						{#each current_files as file, i (file.name)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="gallery-thumb"
								class:selected={selected_files.has(file.name)}
								onclick={(e) => { e.stopPropagation(); handle_file_click(file, e); }}
								ondblclick={() => handle_file_dblclick(file)}
								oncontextmenu={(e) => handle_context_menu(e, file.name)}
								role="button"
								tabindex="-1"
							>
								<span class="gallery-thumb-icon">
									{@html get_file_icon_svg(file)}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Drag selection rectangle -->
			{#if drag_selecting && Math.abs(drag_current_x - drag_start_x) + Math.abs(drag_current_y - drag_start_y) > 4}
				<div class="drag-select-rect" style={drag_rect_style}></div>
			{/if}

			<!-- Context menu -->
			{#if ctx_visible}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="context-menu"
					style="left: {ctx_x}px; top: {ctx_y}px;"
					onclick={(e) => e.stopPropagation()}
				>
					{#if ctx_target_file}
						<button class="ctx-item" onclick={() => ctx_action('get-info')}>
							<span class="ctx-text">Get Info</span>
							<span class="ctx-shortcut">&#8984;I</span>
						</button>
						<button class="ctx-item" onclick={() => ctx_action('rename')}>
							<span class="ctx-text">Rename</span>
						</button>
						<div class="ctx-divider"></div>
						<button class="ctx-item" onclick={() => ctx_action('copy')}>
							<span class="ctx-text">Copy</span>
							<span class="ctx-shortcut">&#8984;C</span>
						</button>
						<button class="ctx-item" onclick={() => ctx_action('cut')}>
							<span class="ctx-text">Cut</span>
							<span class="ctx-shortcut">&#8984;X</span>
						</button>
						<button class="ctx-item" onclick={() => ctx_action('duplicate')}>
							<span class="ctx-text">Duplicate</span>
							<span class="ctx-shortcut">&#8984;D</span>
						</button>
						<div class="ctx-divider"></div>
						<button class="ctx-item destructive" onclick={() => ctx_action('move-to-trash')}>
							<span class="ctx-text">Move to Trash</span>
							<span class="ctx-shortcut">&#8984;&#9003;</span>
						</button>
					{:else}
						<button class="ctx-item" onclick={() => ctx_action('new-folder')}>
							<span class="ctx-text">New Folder</span>
							<span class="ctx-shortcut">&#8984;&#8679;N</span>
						</button>
						<div class="ctx-divider"></div>
						<button class="ctx-item" onclick={() => ctx_action('get-info')}>
							<span class="ctx-text">Get Info</span>
							<span class="ctx-shortcut">&#8984;I</span>
						</button>
						<div class="ctx-divider"></div>
						{#if can_paste}
							<button class="ctx-item" onclick={() => ctx_action('paste')}>
								<span class="ctx-text">Paste Item</span>
								<span class="ctx-shortcut">&#8984;V</span>
							</button>
							<div class="ctx-divider"></div>
						{/if}
						<button class="ctx-item" onclick={() => ctx_action('select-all')}>
							<span class="ctx-text">Select All</span>
							<span class="ctx-shortcut">&#8984;A</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Status bar -->
	<footer class="status-bar">
		<span>{item_count_text}</span>
		<span>{available_text}</span>
	</footer>
</section>

<style>
	.container {
		height: 100%;
		width: 100%;
		background-color: var(--system-color-light);
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--system-font-family);
		font-size: 13px;
		color: var(--system-color-light-contrast);
		-webkit-font-smoothing: antialiased;
		user-select: none;
		outline: none;
	}

	/* ===== Toolbar ===== */
	.toolbar {
		display: flex;
		align-items: center;
		padding: 0 12px;
		background: linear-gradient(180deg, #f6f6f6 0%, #ececec 100%);
		border-bottom: 0.5px solid #c4c4c6;
		gap: 8px;
		height: 52px;
		min-height: 52px;
		flex-shrink: 0;

		:global(body.dark) & {
			background: linear-gradient(180deg, #3c3c3e 0%, #323234 100%);
			border-bottom-color: #1c1c1e;
		}
	}

	.toolbar-nav {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 24px;
		background: none;
		border: none;
		color: #4a4a4c;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;

		&:hover:not(:disabled) {
			background-color: rgba(0, 0, 0, 0.06);
		}

		&:active:not(:disabled) {
			background-color: rgba(0, 0, 0, 0.1);
		}

		&:disabled {
			opacity: 0.3;
			cursor: default;
		}

		:global(body.dark) & {
			color: #b0b0b4;

			&:hover:not(:disabled) {
				background-color: rgba(255, 255, 255, 0.08);
			}

			&:active:not(:disabled) {
				background-color: rgba(255, 255, 255, 0.12);
			}
		}
	}

	.toolbar-title {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		overflow: hidden;
	}

	.title-separator {
		display: flex;
		align-items: center;
		color: #8e8e93;
		flex-shrink: 0;
	}

	.title-segment {
		background: none;
		border: none;
		padding: 2px 6px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		color: #636366;
		white-space: nowrap;
		font-family: inherit;
		font-weight: 400;
		overflow: hidden;
		text-overflow: ellipsis;

		&:hover {
			background: rgba(0, 0, 0, 0.06);
			color: #1c1c1e;
		}

		&.current {
			font-weight: 600;
			color: var(--system-color-light-contrast);
		}

		:global(body.dark) & {
			color: #8e8e93;

			&:hover {
				background: rgba(255, 255, 255, 0.06);
				color: white;
			}

			&.current {
				color: white;
			}
		}
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.view-buttons {
		display: flex;
		background: rgba(0, 0, 0, 0.06);
		border-radius: 6px;
		padding: 2px;
		gap: 1px;

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.08);
		}
	}

	.view-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 22px;
		background: none;
		border: none;
		color: #6e6e73;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;

		&.active {
			background: white;
			color: #1c1c1e;
			box-shadow: 0 0.5px 2px rgba(0,0,0,0.12), 0 0 0.5px rgba(0,0,0,0.08);
		}

		&:hover:not(.active) {
			color: #3c3c3e;
		}

		:global(body.dark) & {
			color: #8e8e93;

			&.active {
				background: #5a5a5c;
				color: white;
				box-shadow: 0 0.5px 2px rgba(0,0,0,0.3);
			}

			&:hover:not(.active) {
				color: #c7c7cc;
			}
		}
	}

	.toolbar-separator {
		width: 1px;
		height: 18px;
		background: rgba(0, 0, 0, 0.1);
		margin: 0 4px;
		flex-shrink: 0;

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 24px;
		background: none;
		border: none;
		color: #6e6e73;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;

		&:hover {
			background: rgba(0, 0, 0, 0.06);
			color: #3c3c3e;
		}

		&:active {
			background: rgba(0, 0, 0, 0.1);
		}

		:global(body.dark) & {
			color: #8e8e93;

			&:hover {
				background: rgba(255, 255, 255, 0.08);
				color: #c7c7cc;
			}

			&:active {
				background: rgba(255, 255, 255, 0.12);
			}
		}
	}

	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 7px;
		color: #8e8e93;
		pointer-events: none;
	}

	.search-input {
		width: 140px;
		height: 24px;
		padding: 0 8px 0 24px;
		border: none;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.06);
		font-size: 12px;
		color: var(--system-color-light-contrast);
		outline: none;
		font-family: inherit;

		&::placeholder {
			color: #8e8e93;
		}

		&:focus {
			background: rgba(0, 0, 0, 0.08);
			box-shadow: 0 0 0 2.5px rgba(0, 122, 255, 0.35);
		}

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.08);

			&:focus {
				background: rgba(255, 255, 255, 0.1);
				box-shadow: 0 0 0 2.5px rgba(10, 132, 255, 0.4);
			}
		}
	}

	/* ===== Main layout ===== */
	.main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* ===== Sidebar ===== */
	.sidebar {
		width: 200px;
		min-width: 200px;
		background-color: rgba(244, 244, 249, 0.92);
		border-right: 0.5px solid #d1d1d6;
		overflow-y: auto;
		padding: 6px 0;
		backdrop-filter: blur(20px);

		:global(body.dark) & {
			background-color: rgba(30, 30, 32, 0.88);
			border-right-color: #38383a;
		}
	}

	.sidebar-section {
		margin-bottom: 8px;
	}

	.sidebar-section-title {
		font-size: 11px;
		font-weight: 700;
		color: #86868b;
		padding: 8px 10px 4px;
		text-align: left;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: calc(100% - 8px);
		margin: 0 4px;
		padding: 3px 6px;
		height: 22px;
		border: none;
		background: none;
		font-size: 13px;
		color: var(--system-color-light-contrast);
		cursor: pointer;
		text-align: left;
		border-radius: 6px;
		font-family: inherit;

		&:hover:not(.active) {
			background-color: rgba(0, 0, 0, 0.04);
		}

		&.active {
			background-color: rgba(0, 122, 255, 0.18);
			color: var(--system-color-light-contrast);
		}

		:global(body.dark) &:hover:not(.active) {
			background-color: rgba(255, 255, 255, 0.06);
		}

		:global(body.dark) &.active {
			background-color: rgba(10, 132, 255, 0.25);
			color: white;
		}
	}

	.sidebar-icon {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: #007aff;

		:global(svg) {
			width: 14px;
			height: 14px;
		}

		:global(body.dark) & {
			color: #0a84ff;
		}
	}

	.sidebar-icon.icon-active {
		color: #007aff;

		:global(body.dark) & {
			color: #0a84ff;
		}
	}

	.sidebar-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1;
	}

	.tag-item {
		gap: 8px;
	}

	.tag-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.all-tags-item {
		color: rgba(0, 0, 0, 0.5);
		font-size: 12px;

		:global(body.dark) & {
			color: rgba(255, 255, 255, 0.45);
		}
	}

	/* ===== Content area ===== */
	.content-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		background: white;

		:global(body.dark) & {
			background: #1e1e20;
		}
	}

	/* ===== List view ===== */
	.column-headers {
		display: flex;
		padding: 0 12px;
		border-bottom: 0.5px solid #d8d8dc;
		font-size: 11px;
		font-weight: 500;
		color: #86868b;
		background-color: #f6f6f6;
		min-height: 24px;
		flex-shrink: 0;

		:global(body.dark) & {
			border-bottom-color: rgba(255, 255, 255, 0.08);
			background-color: rgba(255, 255, 255, 0.04);
			color: #8e8e93;
		}
	}

	.col-header {
		display: flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		border-right: 0.5px solid rgba(0, 0, 0, 0.08);
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 500;
		color: #86868b;
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;

		&:last-child {
			border-right: none;
		}

		&:hover {
			color: #4a4a4c;
			background: rgba(0, 0, 0, 0.03);
		}

		:global(body.dark) & {
			border-right-color: rgba(255, 255, 255, 0.06);
			color: #8e8e93;

			&:hover {
				color: #c7c7cc;
				background: rgba(255, 255, 255, 0.03);
			}
		}
	}

	.sort-chevron {
		flex-shrink: 0;
		transition: transform 0.15s ease;
	}

	.sort-chevron.desc {
		transform: rotate(180deg);
	}

	.col-name {
		flex: 2.5;
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.col-modified {
		flex: 1.2;
		min-width: 0;
	}

	.col-size {
		width: 80px;
		text-align: right;
		flex-shrink: 0;
		justify-content: flex-end;
	}

	.col-kind {
		flex: 1;
		text-align: right;
		justify-content: flex-end;
		min-width: 0;
	}

	.file-list {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.file-row {
		display: flex;
		padding: 0 12px;
		background: transparent;
		width: 100%;
		font-size: 13px;
		color: var(--system-color-light-contrast);
		cursor: default;
		text-align: left;
		align-items: center;
		height: 24px;
		min-height: 24px;
		outline: none;
		border-bottom: none;

		&.even {
			background-color: rgba(0, 0, 0, 0.02);
		}

		&:hover:not(.selected) {
			background-color: rgba(0, 0, 0, 0.04);
		}

		&.selected {
			background-color: rgba(0, 122, 255, 0.15);
			color: var(--system-color-light-contrast);
		}

		&.selected.focused {
			background-color: rgba(0, 122, 255, 0.22);
		}

		:global(body.dark) & {
			&.even {
				background-color: rgba(255, 255, 255, 0.02);
			}

			&:hover:not(.selected) {
				background-color: rgba(255, 255, 255, 0.04);
			}

			&.selected {
				background-color: rgba(10, 132, 255, 0.2);
				color: white;
			}

			&.selected.focused {
				background-color: rgba(10, 132, 255, 0.3);
			}
		}
	}

	.file-icon-wrapper {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;

		:global(svg) {
			display: block;
		}
	}

	.list-icon {
		width: 16px;
		height: 16px;

		:global(svg) {
			width: 16px;
			height: 16px;
		}
	}

	.file-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.rename-input {
		background: white;
		border: 2px solid #007aff;
		border-radius: 4px;
		padding: 1px 4px;
		font-size: 13px;
		font-family: inherit;
		color: #1c1c1e;
		outline: none;
		width: 200px;
		min-width: 100px;
		height: 20px;

		:global(body.dark) & {
			background: #2c2c2e;
			border-color: #0a84ff;
			color: white;
		}
	}

	/* ===== Icon view ===== */
	.icon-grid {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: 2px;
		padding: 16px 20px;
		overflow-y: auto;
	}

	.icon-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 96px;
		padding: 8px 4px 6px;
		border-radius: 8px;
		cursor: default;
		outline: none;

		&:hover:not(.selected) {
			background: rgba(0, 0, 0, 0.04);
		}

		&.selected {
			background: rgba(0, 122, 255, 0.1);
		}

		:global(body.dark) &:hover:not(.selected) {
			background: rgba(255, 255, 255, 0.04);
		}

		:global(body.dark) &.selected {
			background: rgba(10, 132, 255, 0.15);
		}
	}

	.icon-image {
		width: 64px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 4px;

		:global(svg) {
			width: 60px;
			height: 60px;
		}
	}

	.icon-label {
		font-size: 11px;
		text-align: center;
		line-height: 1.3;
		max-width: 88px;
		word-break: break-word;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		padding: 1px 4px;
		border-radius: 4px;
	}

	.selected-label {
		background: #007aff;
		color: white;

		:global(body.dark) & {
			background: #0a84ff;
		}
	}

	.icon-rename {
		width: 84px;
		text-align: center;
		min-width: 60px;
	}

	/* ===== Column view ===== */
	.column-view {
		flex: 1;
		display: flex;
		overflow-x: auto;
	}

	.column-pane {
		min-width: 220px;
		max-width: 280px;
		border-right: 0.5px solid #d8d8dc;
		overflow-y: auto;
		flex-shrink: 0;
		padding: 2px 0;

		:global(body.dark) & {
			border-right-color: #38383a;
		}
	}

	.column-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 8px;
		margin: 0 4px;
		cursor: default;
		outline: none;
		height: 22px;
		border-radius: 5px;

		&:hover:not(.selected) {
			background: rgba(0, 0, 0, 0.04);
		}

		&.selected {
			background: rgba(0, 122, 255, 0.18);
			color: var(--system-color-light-contrast);
		}

		:global(body.dark) &:hover:not(.selected) {
			background: rgba(255, 255, 255, 0.04);
		}

		:global(body.dark) &.selected {
			background: rgba(10, 132, 255, 0.25);
			color: white;
		}
	}

	.column-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;

		:global(svg) {
			width: 16px;
			height: 16px;
		}
	}

	.column-file-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 13px;
	}

	.column-arrow {
		color: #8e8e93;
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.column-row.selected .column-arrow {
		color: #007aff;

		:global(body.dark) & {
			color: #0a84ff;
		}
	}

	.empty-column {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #8e8e93;
		font-size: 13px;
	}

	.preview-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 24px 16px;
		min-width: 200px;
		background: rgba(0, 0, 0, 0.015);

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.015);
		}
	}

	.preview-icon {
		width: 64px;
		height: 64px;
		margin-bottom: 10px;

		:global(svg) {
			width: 64px;
			height: 64px;
		}
	}

	.preview-name {
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		margin-bottom: 16px;
		word-break: break-word;
	}

	.preview-details {
		width: 100%;
	}

	.preview-detail-row {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		font-size: 11px;
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);

		:global(body.dark) & {
			border-bottom-color: rgba(255, 255, 255, 0.06);
		}
	}

	.preview-label {
		color: #8e8e93;
	}

	.preview-value {
		font-weight: 500;
	}

	/* ===== Gallery view ===== */
	.gallery-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.gallery-preview-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(0, 0, 0, 0.01);

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.01);
		}
	}

	.gallery-large-icon {
		width: 128px;
		height: 128px;
		margin-bottom: 12px;

		:global(svg) {
			width: 128px;
			height: 128px;
		}
	}

	.gallery-file-name {
		font-size: 15px;
		font-weight: 600;
		margin-bottom: 4px;
		text-align: center;
	}

	.gallery-file-info {
		font-size: 12px;
		color: #8e8e93;
	}

	.gallery-placeholder {
		font-size: 14px;
		color: #8e8e93;
	}

	.gallery-strip {
		display: flex;
		overflow-x: auto;
		padding: 8px 12px;
		gap: 6px;
		border-top: 0.5px solid #d8d8dc;
		background: rgba(0, 0, 0, 0.02);
		min-height: 64px;

		:global(body.dark) & {
			border-top-color: #38383a;
			background: rgba(255, 255, 255, 0.02);
		}
	}

	.gallery-thumb {
		width: 52px;
		height: 52px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		cursor: default;
		outline: none;
		border: 2px solid transparent;

		&:hover:not(.selected) {
			background: rgba(0, 0, 0, 0.05);
		}

		&.selected {
			border-color: #007aff;
			background: rgba(0, 122, 255, 0.08);
		}

		:global(body.dark) &.selected {
			border-color: #0a84ff;
			background: rgba(10, 132, 255, 0.12);
		}
	}

	.gallery-thumb-icon {
		width: 32px;
		height: 32px;

		:global(svg) {
			width: 32px;
			height: 32px;
		}
	}

	/* ===== Drag selection ===== */
	.drag-select-rect {
		position: absolute;
		border: 1px solid rgba(0, 122, 255, 0.5);
		background: rgba(0, 122, 255, 0.08);
		border-radius: 2px;
		pointer-events: none;
		z-index: 50;

		:global(body.dark) & {
			border-color: rgba(10, 132, 255, 0.5);
			background: rgba(10, 132, 255, 0.1);
		}
	}

	/* ===== Context menu ===== */
	.context-menu {
		position: absolute;
		min-width: 220px;
		padding: 4px;
		background: rgba(248, 248, 248, 0.92);
		backdrop-filter: blur(25px) saturate(1.2);
		-webkit-backdrop-filter: blur(25px) saturate(1.2);
		border-radius: 8px;
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.12),
			0 2px 8px rgba(0, 0, 0, 0.08),
			0 0 0 0.5px rgba(0, 0, 0, 0.12);
		z-index: 100;

		:global(body.dark) & {
			background: rgba(44, 44, 46, 0.92);
			box-shadow:
				0 10px 40px rgba(0, 0, 0, 0.4),
				0 2px 8px rgba(0, 0, 0, 0.3),
				0 0 0 0.5px rgba(255, 255, 255, 0.12);
		}
	}

	.ctx-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 4px 12px;
		background: none;
		border: none;
		border-radius: 4px;
		font-size: 13px;
		color: var(--system-color-light-contrast);
		cursor: default;
		text-align: left;
		font-family: inherit;
		gap: 16px;
		height: 24px;

		&:hover {
			background: #007aff;
			color: white;
		}

		&.destructive:hover {
			background: #ff3b30;
			color: white;
		}

		:global(body.dark) &:hover {
			background: #0a84ff;
		}

		:global(body.dark) &.destructive:hover {
			background: #ff453a;
		}
	}

	.ctx-text {
		white-space: nowrap;
	}

	.ctx-shortcut {
		font-size: 12px;
		opacity: 0.5;
		white-space: nowrap;
	}

	.ctx-item:hover .ctx-shortcut {
		opacity: 0.8;
	}

	.ctx-divider {
		height: 0.5px;
		background: rgba(0, 0, 0, 0.1);
		margin: 4px 10px;

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	/* ===== Empty / status ===== */
	.empty-folder {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		min-height: 180px;
		flex: 1;
	}

	.empty-folder-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.empty-folder-icon {
		opacity: 0.6;
	}

	.empty-folder-text {
		color: #86868b;
		font-size: 14px;
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 16px;
		border-top: 0.5px solid #d8d8dc;
		font-size: 11px;
		color: #8e8e93;
		background: #f6f6f6;
		height: 22px;
		min-height: 22px;
		flex-shrink: 0;

		:global(body.dark) & {
			border-top-color: #38383a;
			background: #2a2a2c;
			color: #8e8e93;
		}
	}
</style>
