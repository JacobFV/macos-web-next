<script lang="ts">
	import { copy_text } from '../../../state/clipboard.svelte';
	import { notify } from '../../../state/notifications.svelte';

	const {
		is_being_dragged,
	}: {
		is_being_dragged: boolean;
	} = $props();

	// --- Types ---
	type Tab = {
		id: number;
		title: string;
		url: string;
		display_url: string;
		is_start_page: boolean;
		loading: boolean;
		load_progress: number;
		can_go_back: boolean;
		can_go_forward: boolean;
		history: string[];
		history_index: number;
		error: string | null;
		favicon_color: string;
	};

	type Favorite = {
		name: string;
		url: string;
		icon: string;
		color: string;
	};

	type BookmarkItem = {
		title: string;
		url: string;
		icon: string;
		color: string;
	};

	type BookmarkFolder = {
		name: string;
		items: BookmarkItem[];
	};

	// --- Constants ---
	const favorites: Favorite[] = [
		{ name: 'Apple', url: 'https://www.apple.com', icon: 'apple', color: '#555555' },
		{ name: 'Google', url: 'https://www.google.com', icon: 'G', color: '#4285F4' },
		{ name: 'YouTube', url: 'https://www.youtube.com', icon: '\u25B6', color: '#FF0000' },
		{ name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'W', color: '#636466' },
		{ name: 'GitHub', url: 'https://github.com', icon: 'github', color: '#24292e' },
		{ name: 'Reddit', url: 'https://www.reddit.com', icon: 'r/', color: '#FF4500' },
		{ name: 'Twitter', url: 'https://twitter.com', icon: 'X', color: '#000000' },
		{ name: 'Amazon', url: 'https://www.amazon.com', icon: 'a', color: '#FF9900' },
		{ name: 'Netflix', url: 'https://www.netflix.com', icon: 'N', color: '#E50914' },
		{ name: 'LinkedIn', url: 'https://www.linkedin.com', icon: 'in', color: '#0077B5' },
		{ name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: 'SO', color: '#F48024' },
		{ name: 'MDN', url: 'https://developer.mozilla.org', icon: 'M', color: '#1B1B1B' },
		{ name: 'Figma', url: 'https://www.figma.com', icon: 'F', color: '#A259FF' },
		{ name: 'Spotify', url: 'https://www.spotify.com', icon: 'S', color: '#1DB954' },
		{ name: 'Twitch', url: 'https://www.twitch.tv', icon: 'T', color: '#9146FF' },
		{ name: 'Discord', url: 'https://discord.com', icon: 'D', color: '#5865F2' },
	];

	const frequently_visited: Favorite[] = [
		{ name: 'GitHub - agi-inc', url: 'https://github.com/agi-inc', icon: 'github', color: '#24292e' },
		{ name: 'Google Docs', url: 'https://docs.google.com', icon: 'D', color: '#4285F4' },
		{ name: 'Hacker News', url: 'https://news.ycombinator.com', icon: 'Y', color: '#FF6600' },
		{ name: 'Vercel', url: 'https://vercel.com', icon: 'V', color: '#000000' },
		{ name: 'Figma', url: 'https://figma.com', icon: 'F', color: '#A259FF' },
		{ name: 'Notion', url: 'https://notion.so', icon: 'N', color: '#000000' },
	];

	const bookmark_folders: BookmarkFolder[] = [
		{
			name: 'Favorites',
			items: [
				{ title: 'Apple', url: 'https://www.apple.com', icon: 'apple', color: '#555555' },
				{ title: 'Google', url: 'https://www.google.com', icon: 'G', color: '#4285F4' },
				{ title: 'YouTube', url: 'https://www.youtube.com', icon: '\u25B6', color: '#FF0000' },
				{ title: 'Wikipedia', url: 'https://www.wikipedia.org', icon: 'W', color: '#636466' },
				{ title: 'GitHub', url: 'https://github.com', icon: 'github', color: '#24292e' },
				{ title: 'Reddit', url: 'https://www.reddit.com', icon: 'r/', color: '#FF4500' },
			],
		},
		{
			name: 'Reading List',
			items: [
				{ title: 'Svelte 5 Runes Guide', url: 'https://svelte.dev/docs', icon: 'S', color: '#FF3E00' },
				{ title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs', icon: 'TS', color: '#3178C6' },
			],
		},
		{
			name: 'Work',
			items: [
				{ title: 'Linear', url: 'https://linear.app', icon: 'L', color: '#5E6AD2' },
				{ title: 'Slack', url: 'https://slack.com', icon: 'S', color: '#4A154B' },
				{ title: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', icon: 'V', color: '#000000' },
			],
		},
	];

	// Well-known favicon colors for domains
	const domain_colors: Record<string, string> = {
		'apple.com': '#555555',
		'google.com': '#4285F4',
		'youtube.com': '#FF0000',
		'wikipedia.org': '#636466',
		'github.com': '#24292e',
		'reddit.com': '#FF4500',
		'twitter.com': '#1DA1F2',
		'x.com': '#000000',
		'amazon.com': '#FF9900',
		'netflix.com': '#E50914',
		'linkedin.com': '#0077B5',
		'stackoverflow.com': '#F48024',
		'developer.mozilla.org': '#1B1B1B',
		'figma.com': '#A259FF',
		'notion.so': '#000000',
		'vercel.com': '#000000',
		'linear.app': '#5E6AD2',
		'slack.com': '#4A154B',
		'svelte.dev': '#FF3E00',
		'typescriptlang.org': '#3178C6',
		'facebook.com': '#1877F2',
		'instagram.com': '#E4405F',
		'tiktok.com': '#000000',
		'microsoft.com': '#00A4EF',
		'docs.google.com': '#4285F4',
		'news.ycombinator.com': '#FF6600',
		'spotify.com': '#1DB954',
		'twitch.tv': '#9146FF',
		'discord.com': '#5865F2',
	};

	function get_favicon_color(url: string): string {
		try {
			const hostname = new URL(url).hostname.replace('www.', '');
			if (domain_colors[hostname]) return domain_colors[hostname];
			// Check parent domain
			const parts = hostname.split('.');
			if (parts.length > 2) {
				const parent = parts.slice(-2).join('.');
				if (domain_colors[parent]) return domain_colors[parent];
			}
			// Generate a consistent color from hostname
			let hash = 0;
			for (let i = 0; i < hostname.length; i++) {
				hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
			}
			const hue = Math.abs(hash) % 360;
			return `hsl(${hue}, 55%, 50%)`;
		} catch {
			return '#86868b';
		}
	}

	// --- State ---
	let next_tab_id = $state(1);
	let tabs = $state<Tab[]>([create_tab()]);
	let active_tab_id = $state(0);
	let show_sidebar = $state(false);
	let is_private_browsing = $state(false);
	let url_input_focused = $state(false);
	let url_input_value = $state('');
	let hovered_tab_id = $state<number | null>(null);
	let reader_mode_active = $state(false);
	let status_bar_url = $state('');
	let url_input_el: HTMLInputElement | undefined = $state(undefined);
	let loading_timers: Map<number, { intervals: number[]; timeouts: number[] }> = new Map();

	// --- Derived ---
	const active_tab = $derived(tabs.find((t) => t.id === active_tab_id) ?? tabs[0]);
	const can_go_back = $derived(active_tab?.can_go_back ?? false);
	const can_go_forward = $derived(active_tab?.can_go_forward ?? false);

	// --- Cleanup timers on unmount ---
	$effect(() => {
		return () => {
			for (const [, timers] of loading_timers) {
				timers.intervals.forEach(clearInterval);
				timers.timeouts.forEach(clearTimeout);
			}
			loading_timers.clear();
		};
	});

	// --- Tab management ---
	function create_tab(url?: string): Tab {
		const id = next_tab_id++;
		const is_start = !url;
		return {
			id,
			title: is_start ? 'Start Page' : extract_title(url!),
			url: url || '',
			display_url: url || '',
			is_start_page: is_start,
			loading: false,
			load_progress: 0,
			can_go_back: false,
			can_go_forward: false,
			history: url ? [url] : [],
			history_index: url ? 0 : -1,
			error: null,
			favicon_color: url ? get_favicon_color(url) : '#86868b',
		};
	}

	function extract_title(url: string): string {
		try {
			const hostname = new URL(url).hostname.replace('www.', '');
			return hostname.charAt(0).toUpperCase() + hostname.slice(1);
		} catch {
			return url;
		}
	}

	function extract_display_url(url: string): string {
		try {
			const u = new URL(url);
			return u.hostname.replace('www.', '');
		} catch {
			return url;
		}
	}

	function add_tab(url?: string) {
		const new_tab = create_tab(url);
		tabs = [...tabs, new_tab];
		active_tab_id = new_tab.id;
		url_input_value = '';
		reader_mode_active = false;
	}

	function close_tab(id: number, event?: MouseEvent) {
		if (event) {
			event.stopPropagation();
		}
		// Clean up loading timers for this tab
		cleanup_tab_timers(id);

		if (tabs.length <= 1) {
			const new_tab = create_tab();
			tabs = [new_tab];
			active_tab_id = new_tab.id;
			return;
		}
		const index = tabs.findIndex((t) => t.id === id);
		tabs = tabs.filter((t) => t.id !== id);
		if (active_tab_id === id) {
			// Prefer the tab to the right, fall back to the one on the left
			const new_index = Math.min(index, tabs.length - 1);
			active_tab_id = tabs[new_index].id;
		}
	}

	function select_tab(id: number) {
		active_tab_id = id;
		reader_mode_active = false;
		const tab = tabs.find((t) => t.id === id);
		if (tab) {
			url_input_value = tab.is_start_page ? '' : tab.display_url;
		}
	}

	// --- Navigation ---
	function rewrite_via_vi(target: string): string {
		// Route any URL through the SynthUX virtual internet so the iframe
		// can render — real upstream sites send X-Frame-Options. github.com
		// gets a structured rewrite; everything else uses /web/<host>/...
		// which the VI translates into either a registered service hit or
		// a synthesized landing page (google search shell, intranet, etc).
		const net = (window as any).__synthuxInternet;
		if (!net || !net.enabled || !net.url) return target;
		try {
			const u = new URL(target);
			const host = u.hostname;
			if (host.endsWith('github.com')) {
				const parts = u.pathname.split('/').filter(Boolean);
				const owner = parts[0] || 'acme';
				const repo = parts[1] || 'api';
				if (parts[2] === 'pull' && parts[3]) {
					return `${net.url}/web/github/${owner}/${repo}/pull/${parts[3]}`;
				}
				const view = parts[2] === 'pulls' ? 'pulls' : (parts[2] || 'overview');
				return `${net.url}/web/github/${owner}/${repo}?view=${encodeURIComponent(view)}`;
			}
			// Generic VI route for any other host.
			return `${net.url}/web/${host}${u.pathname}${u.search}`;
		} catch { return target; }
	}

	function navigate(input?: string) {
		const raw = input ?? url_input_value;
		if (!raw.trim()) return;

		let target = raw.trim();
		if (!target.includes('.') && !target.startsWith('http')) {
			target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
		} else if (!target.startsWith('http://') && !target.startsWith('https://')) {
			target = 'https://' + target;
		}
		target = rewrite_via_vi(target);

		const tab_index = tabs.findIndex((t) => t.id === active_tab_id);
		if (tab_index === -1) return;

		const tab = tabs[tab_index];
		const new_history = tab.history.slice(0, tab.history_index + 1);
		new_history.push(target);

		tabs[tab_index] = {
			...tab,
			url: target,
			display_url: extract_display_url(target),
			title: extract_title(target),
			is_start_page: false,
			loading: true,
			load_progress: 0,
			history: new_history,
			history_index: new_history.length - 1,
			can_go_back: new_history.length > 1,
			can_go_forward: false,
			error: null,
			favicon_color: get_favicon_color(target),
		};

		url_input_value = extract_display_url(target);
		url_input_focused = false;
		reader_mode_active = false;
		simulate_loading(tab_index);
	}

	function cleanup_tab_timers(tab_id: number) {
		const tab_index = tabs.findIndex((t) => t.id === tab_id);
		if (tab_index !== -1) {
			const timers = loading_timers.get(tab_index);
			if (timers) {
				timers.intervals.forEach(clearInterval);
				timers.timeouts.forEach(clearTimeout);
				loading_timers.delete(tab_index);
			}
		}
	}

	function simulate_loading(tab_index: number) {
		// Clean up any existing timers for this tab index
		const existing = loading_timers.get(tab_index);
		if (existing) {
			existing.intervals.forEach(clearInterval);
			existing.timeouts.forEach(clearTimeout);
		}

		const timers = { intervals: [] as number[], timeouts: [] as number[] };
		loading_timers.set(tab_index, timers);

		let progress = 0;
		let step = 0;

		const interval = setInterval(() => {
			step++;
			// Realistic loading curve: fast start, slow middle, quick finish
			if (progress < 20) {
				// Fast initial burst (DNS + connection)
				progress += Math.random() * 15 + 10;
			} else if (progress < 60) {
				// Slow middle (downloading resources)
				progress += Math.random() * 8 + 2;
			} else if (progress < 85) {
				// Slower (rendering)
				progress += Math.random() * 5 + 1;
			} else {
				// Quick finish
				progress += Math.random() * 10 + 5;
			}

			if (progress >= 100 || step > 30) {
				progress = 100;
				clearInterval(interval);
				if (tabs[tab_index]) {
					tabs[tab_index] = { ...tabs[tab_index], loading: false, load_progress: 100 };
					notify({
						app_name: 'Safari',
						app_icon: './app-icons/safari/256.webp',
						title: 'Page Loaded',
						body: tabs[tab_index].display_url,
					});
				}
				const timeout = setTimeout(() => {
					if (tabs[tab_index]) {
						tabs[tab_index] = { ...tabs[tab_index], load_progress: 0 };
					}
					loading_timers.delete(tab_index);
				}, 400);
				timers.timeouts.push(timeout as unknown as number);
			} else {
				if (tabs[tab_index]) {
					tabs[tab_index] = { ...tabs[tab_index], load_progress: progress };
				}
			}
		}, 150) as unknown as number;
		timers.intervals.push(interval);
	}

	function go_back() {
		const tab_index = tabs.findIndex((t) => t.id === active_tab_id);
		if (tab_index === -1) return;
		const tab = tabs[tab_index];
		if (tab.history_index <= 0) return;

		const new_index = tab.history_index - 1;
		const prev_url = tab.history[new_index];

		tabs[tab_index] = {
			...tab,
			url: prev_url,
			display_url: extract_display_url(prev_url),
			title: extract_title(prev_url),
			is_start_page: false,
			loading: true,
			load_progress: 0,
			history_index: new_index,
			can_go_back: new_index > 0,
			can_go_forward: true,
			error: null,
			favicon_color: get_favicon_color(prev_url),
		};
		url_input_value = extract_display_url(prev_url);
		reader_mode_active = false;
		simulate_loading(tab_index);
	}

	function go_forward() {
		const tab_index = tabs.findIndex((t) => t.id === active_tab_id);
		if (tab_index === -1) return;
		const tab = tabs[tab_index];
		if (tab.history_index >= tab.history.length - 1) return;

		const new_index = tab.history_index + 1;
		const next_url = tab.history[new_index];

		tabs[tab_index] = {
			...tab,
			url: next_url,
			display_url: extract_display_url(next_url),
			title: extract_title(next_url),
			is_start_page: false,
			loading: true,
			load_progress: 0,
			history_index: new_index,
			can_go_back: true,
			can_go_forward: new_index < tab.history.length - 1,
			error: null,
			favicon_color: get_favicon_color(next_url),
		};
		url_input_value = extract_display_url(next_url);
		reader_mode_active = false;
		simulate_loading(tab_index);
	}

	function refresh() {
		const tab_index = tabs.findIndex((t) => t.id === active_tab_id);
		if (tab_index === -1 || tabs[tab_index].is_start_page) return;

		tabs[tab_index] = {
			...tabs[tab_index],
			loading: true,
			load_progress: 0,
			error: null,
		};
		simulate_loading(tab_index);
	}

	function navigate_to_favorite(url: string) {
		const tab_index = tabs.findIndex((t) => t.id === active_tab_id);
		if (tab_index === -1) return;

		const tab = tabs[tab_index];
		const new_history = tab.history.slice(0, tab.history_index + 1);
		new_history.push(url);

		tabs[tab_index] = {
			...tab,
			url,
			display_url: extract_display_url(url),
			title: extract_title(url),
			is_start_page: false,
			loading: true,
			load_progress: 0,
			history: new_history,
			history_index: new_history.length - 1,
			can_go_back: new_history.length > 1,
			can_go_forward: false,
			error: null,
			favicon_color: get_favicon_color(url),
		};

		url_input_value = extract_display_url(url);
		reader_mode_active = false;
		simulate_loading(tab_index);
	}

	function handle_url_focus() {
		url_input_focused = true;
		url_input_value = active_tab?.is_start_page ? '' : (active_tab?.url ?? '');
		// Select all text on focus, like real Safari
		requestAnimationFrame(() => {
			url_input_el?.select();
		});
	}

	function handle_url_blur() {
		url_input_focused = false;
		if (active_tab) {
			url_input_value = active_tab.is_start_page ? '' : active_tab.display_url;
		}
	}

	function handle_url_keydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			navigate();
			(e.target as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			url_input_focused = false;
			if (active_tab) {
				url_input_value = active_tab.is_start_page ? '' : active_tab.display_url;
			}
			(e.target as HTMLInputElement).blur();
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
			// Copy full URL to shared clipboard when address bar is focused
			if (active_tab && !active_tab.is_start_page && active_tab.url) {
				copy_text(active_tab.url);
			}
		}
	}

	function toggle_sidebar() {
		show_sidebar = !show_sidebar;
	}

	function toggle_reader_mode() {
		if (active_tab?.is_start_page) return;
		reader_mode_active = !reader_mode_active;
	}

	function navigate_from_bookmark(url: string) {
		navigate(url);
		show_sidebar = false;
	}

	function handle_safari_keydown(e: KeyboardEvent) {
		const meta = e.metaKey || e.ctrlKey;
		if (meta && e.key === 'l') {
			// Cmd+L: focus address bar (standard Safari shortcut)
			e.preventDefault();
			url_input_el?.focus();
		}
	}

	function show_status_url(url: string) {
		try {
			const u = new URL(url);
			status_bar_url = u.hostname.replace('www.', '') + (u.pathname !== '/' ? u.pathname : '');
		} catch {
			status_bar_url = url;
		}
	}

	function hide_status_url() {
		status_bar_url = '';
	}
</script>

<svelte:window onkeydown={handle_safari_keydown} />

<section class="container" class:private={is_private_browsing}>
	<!-- Unified toolbar area (tab bar + nav bar) -->
	<div class="toolbar-area" class:private-toolbar={is_private_browsing}>
		<!-- Tab Bar -->
		<header class="app-window-drag-handle tab-bar">
			<div class="tab-strip">
				{#each tabs as tab (tab.id)}
					<button
						class="tab"
						class:active={active_tab_id === tab.id}
						onmouseenter={() => hovered_tab_id = tab.id}
						onmouseleave={() => hovered_tab_id = null}
						onclick={() => select_tab(tab.id)}
						style="max-width: {Math.max(60, Math.min(240, 600 / tabs.length))}px"
					>
						{#if tab.loading}
							<span class="tab-spinner"></span>
						{:else}
							<span class="tab-favicon-circle" style="background-color: {tab.is_start_page ? 'transparent' : tab.favicon_color}">
								{#if tab.is_start_page}
									<svg width="12" height="12" viewBox="0 0 16 16" fill="#86868b">
										<path d="M8 1L1 6v8.5A1.5 1.5 0 002.5 16h3a.5.5 0 00.5-.5V10h4v5.5a.5.5 0 00.5.5h3a1.5 1.5 0 001.5-1.5V6L8 1z"/>
									</svg>
								{:else if tab.url.includes('apple.com') && tab.favicon_color === '#555555'}
									<svg width="10" height="10" viewBox="0 0 20 20" fill="white">
										<path d="M15.07 13.633c-.263.16-.437.47-.437.816 0 1.368 1.072 2.197 2.16 2.753-.186.476-.556 1.28-.917 1.77-.555.745-1.13 1.49-2.04 1.505-.89.015-1.177-.527-2.196-.527-1.02 0-1.34.512-2.19.542-.877.03-1.543-.807-2.104-1.548-1.143-1.513-2.016-4.277-0.844-6.142.58-.92 1.618-1.503 2.744-1.52 0.858-.016 1.67.578 2.195.578.526 0 1.512-.715 2.548-.61.434.019 1.654.176 2.437 1.323-.063.04-1.454.85-1.44 2.535l.084.525zm-2.83-4.947c.464-.562.777-1.343.692-2.122-.669.027-1.477.446-1.957 1.008-.43.497-.806 1.293-.706 2.056.747.058 1.508-.38 1.971-.942z" transform="scale(0.5) translate(5, 5)"/>
									</svg>
								{:else if tab.url.includes('github.com')}
									<svg width="10" height="10" viewBox="0 0 16 16" fill="white">
										<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
									</svg>
								{:else}
									<span class="tab-favicon-letter">{tab.title.charAt(0).toUpperCase()}</span>
								{/if}
							</span>
						{/if}
						<span class="tab-title">{tab.title}</span>
						{#if tabs.length > 1 && (hovered_tab_id === tab.id || active_tab_id === tab.id)}
							<!-- svelte-ignore node_invalid_placement_ssr -->
							<span
								class="tab-close"
								role="button"
								tabindex="-1"
								onclick={(e) => close_tab(tab.id, e)}
								onkeydown={(e) => { if (e.key === 'Enter') close_tab(tab.id); }}
								aria-label="Close tab"
							>
								<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
									<path d="M1.172 1.172a.5.5 0 01.707 0L4 3.293l2.121-2.121a.5.5 0 11.707.707L4.707 4l2.121 2.121a.5.5 0 01-.707.707L4 4.707 1.879 6.828a.5.5 0 01-.707-.707L3.293 4 1.172 1.879a.5.5 0 010-.707z"/>
								</svg>
							</span>
						{/if}
					</button>
				{/each}
				<button class="tab-add" onclick={() => add_tab()} aria-label="New tab">
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
						<path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		</header>

		<!-- Navigation Bar -->
		<div class="nav-bar">
			<div class="nav-left">
				<button
					class="nav-btn"
					class:active-toggle={show_sidebar}
					onclick={toggle_sidebar}
					aria-label="Toggle sidebar"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7">
						<rect x="1" y="2" width="14" height="12" rx="2"/>
						<line x1="5.5" y1="2" x2="5.5" y2="14"/>
					</svg>
				</button>

				<button
					class="nav-btn nav-arrow"
					class:disabled={!can_go_back}
					onclick={go_back}
					disabled={!can_go_back}
					aria-label="Go back"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
						<path d="M7.5 1.5L3 6l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
				<button
					class="nav-btn nav-arrow"
					class:disabled={!can_go_forward}
					onclick={go_forward}
					disabled={!can_go_forward}
					aria-label="Go forward"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
						<path d="M4.5 1.5L9 6l-4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>

			<!-- URL Bar -->
			<div class="url-bar-wrapper">
				<div class="url-bar" class:focused={url_input_focused} class:loading={active_tab?.loading}>
					{#if active_tab?.loading}
						<div class="url-bar-progress" style="width: {active_tab.load_progress}%"></div>
					{/if}
					{#if !url_input_focused && !active_tab?.is_start_page}
						<span class="url-lock">
							<svg width="10" height="10" viewBox="0 0 10 10" fill="#86868b">
								<path d="M3 4V3a2 2 0 114 0v1h.5A1.5 1.5 0 019 5.5v3A1.5 1.5 0 017.5 10h-5A1.5 1.5 0 011 8.5v-3A1.5 1.5 0 012.5 4H3zm1-1a1 1 0 112 0v1H4V3z"/>
							</svg>
						</span>
					{/if}
					<input
						type="text"
						bind:this={url_input_el}
						bind:value={url_input_value}
						onfocus={handle_url_focus}
						onblur={handle_url_blur}
						onkeydown={handle_url_keydown}
						placeholder="Search or enter website name"
						class:centered={!url_input_focused}
						spellcheck="false"
						autocomplete="off"
					/>
					{#if !url_input_focused && active_tab && !active_tab.is_start_page}
						<button
							class="url-action-btn"
							class:active-reader={reader_mode_active}
							onclick={toggle_reader_mode}
							aria-label="Toggle reader mode"
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
								<path d="M2 3h12v1H2zm0 3h12v1H2zm0 3h8v1H2zm0 3h10v1H2z"/>
							</svg>
						</button>
					{/if}
					{#if active_tab?.loading}
						<button
							class="url-action-btn"
							onclick={() => {
								const tab_index = tabs.findIndex((t) => t.id === active_tab_id);
								if (tab_index !== -1) {
									const existing = loading_timers.get(tab_index);
									if (existing) {
										existing.intervals.forEach(clearInterval);
										existing.timeouts.forEach(clearTimeout);
										loading_timers.delete(tab_index);
									}
									tabs[tab_index] = { ...tabs[tab_index], loading: false, load_progress: 0 };
								}
							}}
							aria-label="Stop loading"
						>
							<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5">
								<path d="M2 2l6 6M8 2l-6 6"/>
							</svg>
						</button>
					{:else if !url_input_focused && active_tab && !active_tab.is_start_page}
						<button
							class="url-action-btn"
							onclick={refresh}
							aria-label="Reload page"
						>
							<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
								<path d="M13.5 8a5.5 5.5 0 11-1.1-3.3"/>
								<path d="M13.5 2.5v3h-3"/>
							</svg>
						</button>
					{/if}
				</div>
			</div>

			<div class="nav-right">
				<button class="nav-btn" aria-label="Share">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7">
						<path d="M8 1v8M5 4l3-3 3 3"/>
						<path d="M3 8v5a2 2 0 002 2h6a2 2 0 002-2V8"/>
					</svg>
				</button>

				<button class="nav-btn" aria-label="Add bookmark">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.7">
						<path d="M8 2l1.796 3.64L14 6.236l-3 2.924.708 4.13L8 11.236 4.292 13.29 5 9.16 2 6.236l4.204-.596z" stroke-linejoin="round"/>
					</svg>
				</button>

				<button class="nav-btn" onclick={() => add_tab()} aria-label="New tab">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.7">
						<rect x="2" y="2" width="12" height="12" rx="2"/>
						<line x1="8" y1="5" x2="8" y2="11"/>
						<line x1="5" y1="8" x2="11" y2="8"/>
					</svg>
				</button>
			</div>
		</div>

		{#if is_private_browsing}
			<div class="private-indicator">
				<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 2C4 2 1 8 1 8s3 6 7 6 7-6 7-6-3-6-7-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z"/>
				</svg>
				Private Browsing
			</div>
		{/if}
	</div>

	<!-- Main Content Area -->
	<div class="main-area">
		<!-- Bookmarks Sidebar -->
		{#if show_sidebar}
			<aside class="sidebar">
				<div class="sidebar-header">
					<span class="sidebar-title">Bookmarks</span>
				</div>
				<div class="sidebar-content">
					{#each bookmark_folders as folder}
						<div class="sidebar-folder">
							<div class="sidebar-folder-name">
								<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
									<path d="M3 1l4 4-4 4"/>
								</svg>
								{folder.name}
							</div>
							{#each folder.items as item}
								<button
									class="sidebar-bookmark"
									onclick={() => navigate_from_bookmark(item.url)}
									onmouseenter={() => show_status_url(item.url)}
									onmouseleave={hide_status_url}
								>
									<span class="sidebar-bookmark-icon" style="background-color: {item.color}">
										{#if item.icon === 'apple'}
											<svg width="8" height="8" viewBox="0 0 20 20" fill="white">
												<path d="M15.07 13.633c-.263.16-.437.47-.437.816 0 1.368 1.072 2.197 2.16 2.753-.186.476-.556 1.28-.917 1.77-.555.745-1.13 1.49-2.04 1.505-.89.015-1.177-.527-2.196-.527-1.02 0-1.34.512-2.19.542-.877.03-1.543-.807-2.104-1.548-1.143-1.513-2.016-4.277-0.844-6.142.58-.92 1.618-1.503 2.744-1.52 0.858-.016 1.67.578 2.195.578.526 0 1.512-.715 2.548-.61.434.019 1.654.176 2.437 1.323-.063.04-1.454.85-1.44 2.535l.084.525zm-2.83-4.947c.464-.562.777-1.343.692-2.122-.669.027-1.477.446-1.957 1.008-.43.497-.806 1.293-.706 2.056.747.058 1.508-.38 1.971-.942z" transform="scale(0.5) translate(5, 5)"/>
											</svg>
										{:else if item.icon === 'github'}
											<svg width="8" height="8" viewBox="0 0 16 16" fill="white">
												<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
											</svg>
										{:else}
											<span style="font-size: 8px; font-weight: 700; color: white">{item.icon}</span>
										{/if}
									</span>
									<span class="sidebar-bookmark-title">{item.title}</span>
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</aside>
		{/if}

		<!-- Page Content -->
		<div class="content">
			{#if active_tab?.is_start_page}
				<!-- Start Page -->
				<div class="start-page">
					<div class="start-page-inner">
						<section class="start-section">
							<h2 class="start-section-title">Favorites</h2>
							<div class="favorites-grid">
								{#each favorites as fav}
									<button
										class="favorite-item"
										onclick={() => navigate_to_favorite(fav.url)}
										onmouseenter={() => show_status_url(fav.url)}
										onmouseleave={hide_status_url}
									>
										<div class="favorite-icon" style="background-color: {fav.color}">
											{#if fav.icon === 'apple'}
												<svg width="24" height="24" viewBox="0 0 20 20" fill="white">
													<path d="M15.07 13.633c-.263.16-.437.47-.437.816 0 1.368 1.072 2.197 2.16 2.753-.186.476-.556 1.28-.917 1.77-.555.745-1.13 1.49-2.04 1.505-.89.015-1.177-.527-2.196-.527-1.02 0-1.34.512-2.19.542-.877.03-1.543-.807-2.104-1.548-1.143-1.513-2.016-4.277-0.844-6.142.58-.92 1.618-1.503 2.744-1.52 0.858-.016 1.67.578 2.195.578.526 0 1.512-.715 2.548-.61.434.019 1.654.176 2.437 1.323-.063.04-1.454.85-1.44 2.535l.084.525zm-2.83-4.947c.464-.562.777-1.343.692-2.122-.669.027-1.477.446-1.957 1.008-.43.497-.806 1.293-.706 2.056.747.058 1.508-.38 1.971-.942z" transform="scale(0.82) translate(1, 1)"/>
												</svg>
											{:else if fav.icon === 'github'}
												<svg width="24" height="24" viewBox="0 0 16 16" fill="white">
													<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
												</svg>
											{:else}
												<span class="favorite-letter">{fav.icon}</span>
											{/if}
										</div>
										<span class="favorite-name">{fav.name}</span>
									</button>
								{/each}
							</div>
						</section>

						<section class="start-section">
							<h2 class="start-section-title">Frequently Visited</h2>
							<div class="frequently-grid">
								{#each frequently_visited as site}
									<button
										class="frequent-item"
										onclick={() => navigate_to_favorite(site.url)}
										onmouseenter={() => show_status_url(site.url)}
										onmouseleave={hide_status_url}
									>
										<div class="frequent-thumbnail">
											<div class="frequent-site-preview">
												<div class="frequent-site-header" style="background-color: {site.color}">
													<div class="frequent-header-left">
														<span class="frequent-site-header-dot"></span>
														<span class="frequent-site-header-dot"></span>
														<span class="frequent-site-header-dot"></span>
													</div>
													<div class="frequent-header-bar"></div>
												</div>
												<div class="frequent-site-body">
													<div class="frequent-site-nav" style="border-bottom-color: {site.color}20">
														<div class="frequent-site-logo" style="background-color: {site.color}">
															{#if site.icon === 'apple'}
																<svg width="8" height="8" viewBox="0 0 20 20" fill="white">
																	<path d="M15.07 13.633c-.263.16-.437.47-.437.816 0 1.368 1.072 2.197 2.16 2.753-.186.476-.556 1.28-.917 1.77-.555.745-1.13 1.49-2.04 1.505-.89.015-1.177-.527-2.196-.527-1.02 0-1.34.512-2.19.542-.877.03-1.543-.807-2.104-1.548-1.143-1.513-2.016-4.277-0.844-6.142.58-.92 1.618-1.503 2.744-1.52 0.858-.016 1.67.578 2.195.578.526 0 1.512-.715 2.548-.61.434.019 1.654.176 2.437 1.323-.063.04-1.454.85-1.44 2.535l.084.525zm-2.83-4.947c.464-.562.777-1.343.692-2.122-.669.027-1.477.446-1.957 1.008-.43.497-.806 1.293-.706 2.056.747.058 1.508-.38 1.971-.942z" transform="scale(0.82) translate(1, 1)"/>
																</svg>
															{:else if site.icon === 'github'}
																<svg width="8" height="8" viewBox="0 0 16 16" fill="white">
																	<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
																</svg>
															{:else}
																<span class="frequent-logo-letter">{site.icon}</span>
															{/if}
														</div>
														<div class="frequent-nav-links">
															<span class="frequent-nav-link"></span>
															<span class="frequent-nav-link"></span>
															<span class="frequent-nav-link short"></span>
														</div>
													</div>
													<div class="frequent-site-content">
														<div class="frequent-content-hero" style="background-color: {site.color}10"></div>
														<div class="frequent-content-lines">
															<span class="frequent-content-line wide"></span>
															<span class="frequent-content-line medium"></span>
															<span class="frequent-content-line narrow"></span>
														</div>
													</div>
												</div>
											</div>
										</div>
										<span class="frequent-name">{site.name}</span>
									</button>
								{/each}
							</div>
						</section>
					</div>
				</div>
			{:else if reader_mode_active}
				<!-- Reader Mode View -->
				<div class="reader-mode">
					<article class="reader-content">
						<div class="reader-site-name">{active_tab?.display_url ?? ''}</div>
						<h1 class="reader-title">{active_tab?.title ?? ''}</h1>
						<div class="reader-meta">
							<span class="reader-author">Sample Author</span>
							<span class="reader-date">February 7, 2026</span>
						</div>
						<div class="reader-divider"></div>
						<div class="reader-body">
							<p>Reader mode provides a simplified view of web page content, removing ads, navigation, and other distractions for a cleaner reading experience.</p>
							<p>This is a simulated reader view for <strong>{active_tab?.display_url ?? ''}</strong>. In a real browser, this would extract and display the main article content from the page.</p>
							<p>Safari's Reader mode automatically detects articles on web pages and reformats them with clean typography, removing clutter and ads for a better reading experience. The text is rendered in a comfortable serif typeface at an optimal reading width.</p>
							<p>Features of Reader mode include adjustable font size, background color options, and a distraction-free layout that puts the content front and center.</p>
						</div>
					</article>
				</div>
			{:else if active_tab?.error}
				<!-- Error Page -->
				<div class="error-page">
					<div class="error-content">
						<div class="error-icon">
							<svg width="56" height="56" viewBox="0 0 56 56" fill="none">
								<circle cx="28" cy="28" r="24" stroke="#c7c7cc" stroke-width="1.5"/>
								<path d="M28 16v16" stroke="#c7c7cc" stroke-width="2.5" stroke-linecap="round"/>
								<circle cx="28" cy="38" r="1.5" fill="#c7c7cc"/>
							</svg>
						</div>
						<h2 class="error-title">Safari Can't Open the Page</h2>
						<p class="error-message">Safari can't open the page "{active_tab.display_url}" because the server where this page is located isn't responding.</p>
						<button class="error-retry" onclick={refresh}>Try Again</button>
					</div>
				</div>
			{:else if !is_being_dragged}
				<!-- iframe content -->
				<iframe
					src={active_tab?.url ?? 'about:blank'}
					title="Safari Browser"
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
				></iframe>
			{:else}
				<div class="drag-overlay">
					<p>{active_tab?.display_url ?? ''}</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Status Bar (appears on hover over links) -->
	{#if status_bar_url}
		<div class="status-bar">
			<span class="status-bar-text">{status_bar_url}</span>
		</div>
	{/if}
</section>

<style>
	/* --- Container --- */
	.container {
		height: 100%;
		width: 100%;
		background-color: var(--system-color-light);
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--system-font-family);
		color: var(--system-color-light-contrast);
		position: relative;
	}

	/* --- Unified Toolbar Area --- */
	.toolbar-area {
		background: linear-gradient(to bottom, #e8e8ed, #dcdce1);
		border-bottom: 0.5px solid #b5b5b8;
		flex-shrink: 0;

		:global(body.dark) & {
			background: linear-gradient(to bottom, #3a3a3c, #323234);
			border-bottom-color: #1c1c1e;
		}
	}

	.toolbar-area.private-toolbar {
		background: linear-gradient(to bottom, #4a3b69, #3d3156);
		border-bottom-color: #2d2445;
	}

	/* --- Tab Bar --- */
	.tab-bar {
		padding: 6px 78px 0;
		min-height: 34px;
	}

	.tab-strip {
		display: flex;
		align-items: flex-end;
		gap: 1px;
		overflow-x: auto;
		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}
	}

	.tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 26px 5px 8px;
		background: transparent;
		border: none;
		border-radius: 6px 6px 0 0;
		font-size: 11px;
		color: #6e6e73;
		cursor: default;
		min-width: 50px;
		height: 28px;
		flex-shrink: 1;
		flex-grow: 0;
		transition: background-color 80ms ease, box-shadow 80ms ease;
		overflow: hidden;

		&:hover:not(.active) {
			background: rgba(0, 0, 0, 0.04);
		}

		&.active {
			background: #f5f5f7;
			color: var(--system-color-light-contrast);
			box-shadow:
				-0.5px 0 0 rgba(0, 0, 0, 0.08),
				0.5px 0 0 rgba(0, 0, 0, 0.08),
				0 -0.5px 0 rgba(0, 0, 0, 0.04);
		}

		:global(body.dark) & {
			color: #98989d;

			&:hover:not(.active) {
				background: rgba(255, 255, 255, 0.04);
			}

			&.active {
				background: #2c2c2e;
				color: #f5f5f7;
				box-shadow:
					-0.5px 0 0 rgba(0, 0, 0, 0.3),
					0.5px 0 0 rgba(0, 0, 0, 0.3),
					0 -0.5px 0 rgba(0, 0, 0, 0.2);
			}
		}
	}

	.tab-favicon-circle {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.tab-favicon-letter {
		font-size: 9px;
		font-weight: 700;
		color: white;
		line-height: 1;
	}

	.tab-spinner {
		width: 12px;
		height: 12px;
		border: 1.5px solid rgba(0, 0, 0, 0.12);
		border-top-color: #007aff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;

		:global(body.dark) & {
			border-color: rgba(255, 255, 255, 0.12);
			border-top-color: #0a85ff;
		}
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.tab-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		text-align: left;
		min-width: 0;
	}

	.tab-close {
		position: absolute;
		right: 5px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: none;
		background: none;
		border-radius: 50%;
		color: #86868b;
		cursor: pointer;
		opacity: 0;
		transition: opacity 100ms ease, background-color 80ms ease;

		.tab:hover &,
		.tab.active & {
			opacity: 0.6;
		}

		&:hover {
			background: rgba(0, 0, 0, 0.1);
			opacity: 1 !important;
		}

		:global(body.dark) &:hover {
			background: rgba(255, 255, 255, 0.15);
		}
	}

	.tab-add {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 28px;
		padding: 0;
		background: none;
		border: none;
		border-radius: 4px;
		color: #86868b;
		cursor: pointer;
		flex-shrink: 0;
		margin-left: 2px;

		&:hover {
			background: rgba(0, 0, 0, 0.06);
			color: var(--system-color-light-contrast);
		}

		:global(body.dark) &:hover {
			background: rgba(255, 255, 255, 0.08);
			color: #f5f5f7;
		}
	}

	/* --- Navigation Bar --- */
	.nav-bar {
		display: flex;
		align-items: center;
		padding: 4px 10px 6px;
		gap: 6px;
		background: #f5f5f7;

		:global(body.dark) & {
			background: #2c2c2e;
		}

		.private-toolbar & {
			background: #3d3156;
		}
	}

	.nav-left,
	.nav-right {
		display: flex;
		align-items: center;
		gap: 1px;
		flex-shrink: 0;
	}

	.nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--system-color-light-contrast);
		padding: 4px 6px;
		border-radius: 5px;
		cursor: pointer;
		min-width: 28px;
		height: 28px;

		&:hover {
			background: rgba(0, 0, 0, 0.06);
		}

		&.disabled {
			opacity: 0.3;
			cursor: default;
			pointer-events: none;
		}

		&.active-toggle {
			background: rgba(0, 122, 255, 0.12);
			color: #007aff;

			& svg {
				opacity: 1;
			}
		}

		:global(body.dark) & {
			color: #e5e5e7;

			&:hover {
				background: rgba(255, 255, 255, 0.08);
			}

			&.active-toggle {
				background: rgba(10, 133, 255, 0.2);
				color: #0a85ff;
			}
		}
	}

	.nav-arrow {
		padding: 4px;
		min-width: 24px;
	}

	/* --- URL Bar --- */
	.url-bar-wrapper {
		flex: 1;
		max-width: 600px;
		margin: 0 auto;
		min-width: 180px;
	}

	.url-bar {
		position: relative;
		display: flex;
		align-items: center;
		background: rgba(0, 0, 0, 0.06);
		border-radius: 10px;
		overflow: hidden;
		height: 30px;
		transition: background-color 120ms ease, box-shadow 120ms ease;

		&.focused {
			background: white;
			box-shadow:
				0 0 0 3px rgba(0, 122, 255, 0.3),
				0 0 0 1px rgba(0, 122, 255, 0.6);
		}

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.08);

			&.focused {
				background: #1c1c1e;
				box-shadow:
					0 0 0 3px rgba(10, 133, 255, 0.3),
					0 0 0 1px rgba(10, 133, 255, 0.6);
			}
		}

		.private-toolbar & {
			background: rgba(0, 0, 0, 0.2);

			&.focused {
				background: rgba(0, 0, 0, 0.35);
			}
		}
	}

	.url-bar-progress {
		position: absolute;
		top: 0;
		left: 0;
		height: 2px;
		background: linear-gradient(90deg, #007aff, #34aadc);
		border-radius: 0 1px 1px 0;
		transition: width 150ms cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 2;
	}

	.url-lock {
		display: flex;
		align-items: center;
		padding-left: 10px;
		flex-shrink: 0;
	}

	.url-bar input {
		width: 100%;
		height: 100%;
		padding: 0 8px;
		border: none;
		background: none;
		font-size: 12.5px;
		color: var(--system-color-light-contrast);
		outline: none;
		font-family: var(--system-font-family);

		&.centered {
			text-align: center;
			padding-left: 0;
			padding-right: 0;
		}

		&::placeholder {
			color: #86868b;
			text-align: center;
		}

		&::selection {
			background: rgba(0, 122, 255, 0.2);
		}

		:global(body.dark) & {
			color: #f5f5f7;

			&::selection {
				background: rgba(10, 133, 255, 0.3);
			}
		}

		.private-toolbar & {
			color: #e5e5e7;
		}
	}

	.url-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 6px;
		border: none;
		background: none;
		border-radius: 4px;
		cursor: pointer;
		flex-shrink: 0;
		color: var(--system-color-light-contrast);
		margin-right: 2px;

		&:hover {
			background: rgba(0, 0, 0, 0.06);
		}

		&.active-reader {
			background: rgba(0, 122, 255, 0.15);
			color: #007aff;

			& svg {
				opacity: 1;
			}
		}

		:global(body.dark) &:hover {
			background: rgba(255, 255, 255, 0.08);
		}
	}

	/* --- Private Browsing Indicator --- */
	.private-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 3px 0;
		background: rgba(0, 0, 0, 0.15);
		color: rgba(255, 255, 255, 0.8);
		font-size: 11px;
		font-weight: 500;
	}

	/* --- Main Content Area --- */
	.main-area {
		flex: 1;
		display: flex;
		overflow: hidden;
		min-height: 0;
	}

	/* --- Sidebar --- */
	.sidebar {
		width: 220px;
		min-width: 220px;
		background: rgba(242, 242, 247, 0.92);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		border-right: 0.5px solid rgba(0, 0, 0, 0.12);
		display: flex;
		flex-direction: column;
		overflow: hidden;

		:global(body.dark) & {
			background: rgba(28, 28, 30, 0.88);
			border-right-color: rgba(255, 255, 255, 0.08);
		}
	}

	.sidebar-header {
		padding: 10px 14px;
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);

		:global(body.dark) & {
			border-bottom-color: rgba(255, 255, 255, 0.06);
		}
	}

	.sidebar-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--system-color-light-contrast);
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 6px 0;
	}

	.sidebar-folder {
		margin-bottom: 4px;
	}

	.sidebar-folder-name {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		font-size: 11px;
		font-weight: 600;
		color: #86868b;
	}

	.sidebar-bookmark {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 10px 4px 22px;
		border: none;
		background: none;
		font-size: 12px;
		color: var(--system-color-light-contrast);
		cursor: pointer;
		text-align: left;
		border-radius: 0;

		&:hover {
			background: rgba(0, 0, 0, 0.04);
		}

		:global(body.dark) &:hover {
			background: rgba(255, 255, 255, 0.06);
		}
	}

	.sidebar-bookmark-icon {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.sidebar-bookmark-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* --- Content --- */
	.content {
		flex: 1;
		overflow: hidden;
		position: relative;
		min-width: 0;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: white;

		:global(body.dark) & {
			background: #1c1c1e;
		}
	}

	.drag-overlay {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background: var(--system-color-light);
		color: #86868b;
		font-size: 14px;
	}

	/* --- Start Page --- */
	.start-page {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		background: linear-gradient(180deg, #f5f5f7 0%, #ececf0 100%);

		:global(body.dark) & {
			background: linear-gradient(180deg, #1c1c1e 0%, #2c2c2e 100%);
		}
	}

	.start-page-inner {
		max-width: 720px;
		margin: 0 auto;
		padding: 40px 28px;
	}

	.start-section {
		margin-bottom: 36px;
	}

	.start-section-title {
		font-size: 20px;
		font-weight: 700;
		margin: 0 0 16px;
		color: var(--system-color-light-contrast);
	}

	.favorites-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
		gap: 8px 4px;
	}

	.favorite-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px 4px;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 10px;

		&:hover {
			background: rgba(0, 0, 0, 0.04);
		}

		&:active .favorite-icon {
			transform: scale(0.95);
		}

		:global(body.dark) &:hover {
			background: rgba(255, 255, 255, 0.06);
		}
	}

	.favorite-icon {
		width: 52px;
		height: 52px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.08),
			0 0 0 0.5px rgba(0, 0, 0, 0.06),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transition: transform 100ms ease;
	}

	.favorite-letter {
		font-size: 22px;
		font-weight: 700;
		color: white;
	}

	.favorite-name {
		font-size: 11px;
		color: #6e6e73;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 76px;

		:global(body.dark) & {
			color: #98989d;
		}
	}

	/* --- Frequently Visited --- */
	.frequently-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}

	.frequent-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 8px;
		overflow: hidden;

		&:hover .frequent-thumbnail {
			box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
		}

		&:active .frequent-thumbnail {
			transform: scale(0.98);
		}
	}

	.frequent-thumbnail {
		width: 100%;
		aspect-ratio: 16 / 10;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.06);
		transition: box-shadow 150ms ease, transform 100ms ease;
	}

	.frequent-site-preview {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: white;

		:global(body.dark) & {
			background: #2c2c2e;
		}
	}

	.frequent-site-header {
		height: 14px;
		display: flex;
		align-items: center;
		padding: 0 5px;
		gap: 0;
		flex-shrink: 0;
	}

	.frequent-header-left {
		display: flex;
		align-items: center;
		gap: 2.5px;
	}

	.frequent-site-header-dot {
		width: 3.5px;
		height: 3.5px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.5);
	}

	.frequent-header-bar {
		flex: 1;
		height: 4px;
		margin-left: 6px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 2px;
	}

	.frequent-site-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.frequent-site-nav {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 6px 3px;
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);

		:global(body.dark) & {
			border-bottom-color: rgba(255, 255, 255, 0.06);
		}
	}

	.frequent-site-logo {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.frequent-logo-letter {
		font-size: 8px;
		font-weight: 700;
		color: white;
		line-height: 1;
	}

	.frequent-nav-links {
		display: flex;
		align-items: center;
		gap: 3px;
		flex: 1;
	}

	.frequent-nav-link {
		height: 3px;
		border-radius: 1.5px;
		background: rgba(0, 0, 0, 0.1);
		width: 16px;

		&.short {
			width: 10px;
		}

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.frequent-site-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 4px 6px;
		gap: 4px;
	}

	.frequent-content-hero {
		height: 20px;
		border-radius: 2px;
		flex-shrink: 0;

		:global(body.dark) & {
			opacity: 0.5;
		}
	}

	.frequent-content-lines {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.frequent-content-line {
		height: 3px;
		border-radius: 1.5px;
		background: rgba(0, 0, 0, 0.07);

		&.wide {
			width: 90%;
		}

		&.medium {
			width: 70%;
		}

		&.narrow {
			width: 50%;
		}

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.07);
		}
	}

	.frequent-name {
		font-size: 11px;
		color: #6e6e73;
		padding: 0 4px 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		:global(body.dark) & {
			color: #98989d;
		}
	}

	/* --- Reader Mode --- */
	.reader-mode {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		background: #fafaf8;

		:global(body.dark) & {
			background: #1c1c1e;
		}
	}

	.reader-content {
		max-width: 580px;
		margin: 0 auto;
		padding: 48px 24px 64px;
	}

	.reader-site-name {
		font-size: 13px;
		font-weight: 500;
		color: #86868b;
		margin-bottom: 8px;
		font-family: var(--system-font-family);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.reader-title {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 32px;
		font-weight: 700;
		line-height: 1.2;
		margin: 0 0 12px;
		color: var(--system-color-light-contrast);
		letter-spacing: -0.3px;
	}

	.reader-meta {
		display: flex;
		gap: 12px;
		font-size: 13px;
		color: #86868b;
		margin-bottom: 20px;
	}

	.reader-author {
		font-weight: 500;
		color: #007aff;
	}

	.reader-date {
		color: #86868b;
	}

	.reader-divider {
		height: 1px;
		background: rgba(0, 0, 0, 0.08);
		margin-bottom: 28px;

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.08);
		}
	}

	.reader-body {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 19px;
		line-height: 1.75;
		color: #333;
		letter-spacing: 0.1px;

		:global(body.dark) & {
			color: #d1d1d6;
		}

		p {
			margin: 0 0 24px;
		}

		strong {
			font-weight: 700;
		}
	}

	/* --- Error Page --- */
	.error-page {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f5f7;

		:global(body.dark) & {
			background: #1c1c1e;
		}
	}

	.error-content {
		text-align: center;
		max-width: 360px;
		padding: 24px;
	}

	.error-icon {
		margin-bottom: 20px;
	}

	.error-title {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 8px;
		color: var(--system-color-light-contrast);
	}

	.error-message {
		font-size: 13px;
		color: #86868b;
		margin: 0 0 20px;
		line-height: 1.5;
	}

	.error-retry {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 16px;
		background: rgba(0, 0, 0, 0.06);
		border: none;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		color: #007aff;
		cursor: pointer;
		font-family: var(--system-font-family);

		&:hover {
			background: rgba(0, 0, 0, 0.1);
		}

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.08);
			color: #0a85ff;

			&:hover {
				background: rgba(255, 255, 255, 0.12);
			}
		}
	}

	/* --- Status Bar --- */
	.status-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		max-width: 50%;
		padding: 3px 10px;
		background: rgba(242, 242, 247, 0.92);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-top-right-radius: 4px;
		border-right: 0.5px solid rgba(0, 0, 0, 0.08);
		border-top: 0.5px solid rgba(0, 0, 0, 0.08);
		z-index: 10;
		animation: status-fade-in 100ms ease;

		:global(body.dark) & {
			background: rgba(44, 44, 46, 0.92);
			border-color: rgba(255, 255, 255, 0.08);
		}
	}

	@keyframes status-fade-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.status-bar-text {
		font-size: 11px;
		color: #6e6e73;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;

		:global(body.dark) & {
			color: #98989d;
		}
	}
</style>
