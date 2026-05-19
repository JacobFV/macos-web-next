import { apps_config } from '🍎/configs/apps/apps-config';

export type AppID = keyof typeof apps_config;

export type WindowState = {
	x: number;
	y: number;
	width: number;
	height: number;
	minimized: boolean;
	maximized: boolean;
	closing: boolean;
	zIndex: number;
};

type PersistedWindowState = Pick<WindowState, 'x' | 'y' | 'width' | 'height' | 'maximized'>;

const STORAGE_PREFIX = 'macos-web:';
const K_WINDOW_STATES = `${STORAGE_PREFIX}window-states`;
const K_OPEN_APPS = `${STORAGE_PREFIX}open-apps`;
const K_ACTIVE_APP = `${STORAGE_PREFIX}active-app`;

const app_ids = Object.keys(apps_config) as AppID[];

function app_record<T>(create: (id: AppID) => T): Record<AppID, T> {
	return Object.fromEntries(app_ids.map((id) => [id, create(id)])) as Record<AppID, T>;
}

function has_storage(): boolean {
	try {
		return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
	} catch {
		return false;
	}
}

function load_json<T>(key: string, fallback: T): T {
	if (!has_storage()) return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) as T : fallback;
	} catch {
		return fallback;
	}
}

function save_json<T>(key: string, value: T): void {
	if (!has_storage()) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// best effort only
	}
}

function create_window_state(id: AppID, index: number): WindowState {
	const config = apps_config[id];
	const width = Number(config.width ?? 600);
	const height = Number(config.height ?? 500);
	const x = Math.max(24, (globalThis.innerWidth || 1280) / 2 - width / 2 + index * 28);
	const y = Math.max(32, 80 + index * 24);
	return {
		x,
		y,
		width,
		height,
		minimized: false,
		maximized: false,
		closing: false,
		zIndex: 0,
	};
}

function clamp_window_state(state: PersistedWindowState, id: AppID): PersistedWindowState {
	const config = apps_config[id];
	const defaultWidth = Number(config.width ?? 600);
	const defaultHeight = Number(config.height ?? 500);
	const viewportWidth = globalThis.innerWidth || 1280;
	const viewportHeight = globalThis.innerHeight || 800;
	const width = Math.min(Math.max(state.width || defaultWidth, 220), viewportWidth);
	const height = Math.min(Math.max(state.height || defaultHeight, 160), viewportHeight);
	const x = Math.max(0, Math.min(state.x || 0, Math.max(0, viewportWidth - 80)));
	const y = Math.max(27.2, Math.min(state.y || 80, Math.max(27.2, viewportHeight - 80)));
	return { x, y, width, height, maximized: !!state.maximized };
}

export const apps = $state({
	open: {
		finder: false,
		safari: false,
		terminal: false,
		notes: false,
		messages: false,
		mail: false,
		photos: false,
		music: false,
		maps: false,
		'system-preferences': false,
		facetime: false,
		reminders: false,
		news: false,
		podcasts: false,
		tv: false,
		contacts: false,
		keynote: false,
		launchpad: false,
		devutils: false,
		preview: false,

		wallpapers: false,
		calculator: false,
		calendar: false,
		vscode: false,
		appstore: false,

		'purus-twitter': false,
		'view-source': true,

		vercel: true,
	} as Record<AppID, boolean>,

	active: 'finder' satisfies AppID,

	/**
	 * Maximum zIndex for the active app
	 * Initialize with -2, so that it becomes 0 when initialised
	 */
	active_z_index: -2,

	z_indices: {
		finder: 0,
		safari: 0,
		terminal: 0,
		notes: 0,
		messages: 0,
		mail: 0,
		photos: 0,
		music: 0,
		maps: 0,
		'system-preferences': 0,
		facetime: 0,
		reminders: 0,
		news: 0,
		podcasts: 0,
		tv: 0,
		contacts: 0,
		keynote: 0,
		launchpad: 0,
		devutils: 0,
		preview: 0,

		wallpapers: 0,
		calculator: 0,
		calendar: 0,
		vscode: 0,
		appstore: 0,

		'purus-twitter': 0,
		'view-source': 0,

		vercel: 0,
	} as Record<AppID, number>,

	is_being_dragged: false as boolean,

	fullscreen: {
		finder: false,
		safari: false,
		terminal: false,
		notes: false,
		messages: false,
		mail: false,
		photos: false,
		music: false,
		maps: false,
		'system-preferences': false,
		facetime: false,
		reminders: false,
		news: false,
		podcasts: false,
		tv: false,
		contacts: false,
		keynote: false,
		launchpad: false,
		devutils: false,
		preview: false,

		wallpapers: false,
		calculator: false,
		calendar: false,
		vscode: false,
		appstore: false,

		'purus-twitter': false,
		'view-source': false,

		vercel: false,
	} as Record<AppID, boolean>,
});

class MacWindowManager {
	windowStates = $state<Record<AppID, WindowState>>(app_record((id) => create_window_state(id, 0)));
	lastWindowStates = $state<Partial<Record<AppID, PersistedWindowState>>>({});
	launchArgs = $state<Partial<Record<AppID, unknown>>>({});
	private nextZIndex = $state(0);
	private hydrated = false;

	constructor() {
		this.hydrate();
	}

	private hydrate() {
		if (this.hydrated) return;
		this.hydrated = true;

		const savedStates = load_json<Partial<Record<AppID, PersistedWindowState>>>(K_WINDOW_STATES, {});
		this.lastWindowStates = savedStates;

		for (const id of app_ids) {
			const persisted = savedStates[id];
			const base = create_window_state(id, 0);
			this.windowStates[id] = persisted
				? { ...base, ...clamp_window_state(persisted, id) }
				: base;
		}

		const savedOpenApps = load_json<AppID[]>(K_OPEN_APPS, []);
		for (const id of savedOpenApps) {
			if (id in apps_config && apps_config[id].should_open_window) {
				this.openApp(id);
			}
		}

		const savedActive = load_json<AppID | null>(K_ACTIVE_APP, null);
		if (savedActive && savedActive in apps_config && apps.open[savedActive]) {
			this.focusApp(savedActive);
		}
	}

	openApp(id: AppID, args?: unknown) {
		const config = apps_config[id];
		if (!config.should_open_window) {
			config.external_action?.(args);
			return;
		}

		if (args !== undefined) this.launchArgs[id] = args;

		if (!apps.open[id]) {
			const index = Object.values(apps.open).filter(Boolean).length;
			const persisted = this.lastWindowStates[id];
			const base = create_window_state(id, index);
			this.windowStates[id] = persisted
				? { ...base, ...clamp_window_state(persisted, id), minimized: false, closing: false }
				: base;
			apps.open[id] = true;
		}

		this.windowStates[id].minimized = false;
		this.windowStates[id].closing = false;
		this.focusApp(id);
	}

	closeApp(id: AppID) {
		const state = this.windowStates[id];
		if (!state) return;
		this.recordWindowState(id);
		state.closing = true;
		apps.fullscreen[id] = false;
		if (apps.active === id) this.focusTopVisibleApp(id);

		setTimeout(() => {
			apps.open[id] = false;
			state.closing = false;
			state.minimized = false;
			state.maximized = false;
		}, 180);
	}

	minimizeApp(id: AppID) {
		const state = this.windowStates[id];
		if (!state) return;
		state.minimized = true;
		apps.fullscreen[id] = false;
		if (apps.active === id) this.focusTopVisibleApp(id);
	}

	focusApp(id: AppID) {
		if (!apps.open[id]) return;
		this.nextZIndex += 2;
		this.windowStates[id].zIndex = this.nextZIndex;
		apps.z_indices[id] = this.nextZIndex;
		apps.active_z_index = this.nextZIndex;
		apps.active = id;
		this.normalizeZIndices();
	}

	toggleMaximize(id: AppID) {
		const state = this.windowStates[id];
		if (!state) return;
		state.maximized = !state.maximized;
		apps.fullscreen[id] = state.maximized;
		this.recordWindowState(id);
	}

	setDragging(isDragging: boolean) {
		apps.is_being_dragged = isDragging;
	}

	updateGeometry(id: AppID, next: Partial<Pick<WindowState, 'x' | 'y' | 'width' | 'height'>>) {
		const state = this.windowStates[id];
		if (!state) return;
		Object.assign(state, next);
		this.recordWindowState(id);
	}

	recordWindowState(id: AppID) {
		const state = this.windowStates[id];
		if (!state) return;
		this.lastWindowStates[id] = {
			x: state.x,
			y: state.y,
			width: state.width,
			height: state.height,
			maximized: state.maximized,
		};
	}

	private focusTopVisibleApp(excluding?: AppID) {
		const candidates = app_ids
			.filter((id) => id !== excluding && apps.open[id] && !this.windowStates[id]?.minimized)
			.sort((a, b) => this.windowStates[b].zIndex - this.windowStates[a].zIndex);
		const next = candidates[0];
		if (next) this.focusApp(next);
	}

	normalizeZIndices() {
		const openIds = app_ids
			.filter((id) => apps.open[id])
			.sort((a, b) => this.windowStates[a].zIndex - this.windowStates[b].zIndex);
		openIds.forEach((id, index) => {
			const zIndex = (index + 1) * 2;
			this.windowStates[id].zIndex = zIndex;
			apps.z_indices[id] = zIndex;
		});
		this.nextZIndex = openIds.length * 2;
		apps.active_z_index = this.nextZIndex;
		if (apps.active && apps.open[apps.active]) {
			this.windowStates[apps.active].zIndex = this.nextZIndex + 2;
			apps.z_indices[apps.active] = this.nextZIndex + 2;
			this.nextZIndex += 2;
			apps.active_z_index = this.nextZIndex;
		}
	}
}

export const windowManager = new MacWindowManager();

export function startWindowManagerAutosave(): void {
	$effect(() => {
		for (const id of app_ids) {
			const state = windowManager.lastWindowStates[id];
			if (!state) continue;
			void state.x;
			void state.y;
			void state.width;
			void state.height;
			void state.maximized;
		}
		save_json(K_WINDOW_STATES, windowManager.lastWindowStates);
	});

	$effect(() => {
		for (const id of app_ids) void apps.open[id];
		void apps.active;
		save_json(K_OPEN_APPS, app_ids.filter((id) => apps.open[id] && apps_config[id].should_open_window));
		save_json(K_ACTIVE_APP, apps.active);
	});
}
