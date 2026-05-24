/**
 * PostMessage communication bridge for the macos-web Svelte 5 app.
 *
 * When the app runs inside an iframe on the CommandAGI platform, this module:
 *   - Listens for messages from the parent with `source: 'commandagi-embed'`
 *   - Sends a `simulation-ready` signal on initialization
 *   - Sends periodic heartbeats every 5 seconds
 *   - Handles `screenshot-request` by capturing the page via html2canvas
 *   - Handles `event-forward` with an acknowledgement
 */

import type html2canvasModule from 'html2canvas';
import { apps_config } from '🍎/configs/apps/apps-config';
import { windowManager, apps, type AppID } from '🍎/state/apps.svelte';
import { mkdir, read_file, write_file } from '🍎/state/vfs.svelte';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inbound message shapes sent by the parent (SimulationEmbed). */
interface ScreenshotRequestMessage {
	source: 'commandagi-embed';
	type: 'screenshot-request';
	requestId: string;
}

interface EventForwardMessage {
	source: 'commandagi-embed';
	type: 'event-forward';
	requestId?: string;
	eventType: string;
	payload: Record<string, unknown>;
}

interface SynthuxCommandMessage {
	source: 'synthux-executor';
	type: 'synthux-command';
	requestId: string;
	command: {
		type: 'synthux.targetAction' | 'synthux.getState';
		action?: Record<string, unknown>;
	};
}

type InboundMessage = ScreenshotRequestMessage | EventForwardMessage | SynthuxCommandMessage;

/** Outbound message shapes sent to the parent. */
interface SimulationReadyMessage {
	source: 'commandagi-simulation';
	type: 'simulation-ready';
	environmentType: 'macos-webapp';
}

interface HeartbeatMessage {
	source: 'commandagi-simulation';
	type: 'heartbeat';
}

interface ScreenshotResponseMessage {
	source: 'commandagi-simulation';
	type: 'screenshot-response';
	requestId: string;
	dataUrl?: string;
	error?: string;
}

interface EventForwardAckMessage {
	source: 'commandagi-simulation';
	type: 'event-forward-ack';
	requestId?: string;
	eventType: string;
}

interface SynthuxCommandResultMessage {
	source: 'synthux-environment';
	type: 'synthux-command-result';
	requestId: string;
	ok: boolean;
	event: string;
	target?: string;
	state: Record<string, unknown>;
	observation: string;
	error?: string;
}

type OutboundMessage =
	| SimulationReadyMessage
	| HeartbeatMessage
	| ScreenshotResponseMessage
	| EventForwardAckMessage
	| SynthuxCommandResultMessage;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postToParent(message: OutboundMessage): void {
	try {
		window.parent.postMessage(message, '*');
	} catch {
		// Silently ignore -- the parent may not exist (standalone mode).
	}
}

function isInboundMessage(data: unknown): data is InboundMessage {
	return (
		typeof data === 'object' &&
		data !== null &&
		((data as Record<string, unknown>).source === 'commandagi-embed' ||
			(data as Record<string, unknown>).source === 'synthux-executor') &&
		typeof (data as Record<string, unknown>).type === 'string'
	);
}

// ---------------------------------------------------------------------------
// SynthUX command execution
// ---------------------------------------------------------------------------

const SURFACE_APP: Record<string, AppID> = {
	slack: 'messages',
	notion: 'notes',
	github: 'safari',
	editor: 'vscode',
	terminal: 'terminal',
	browser: 'safari',
	dashboard: 'safari',
};

function isAppID(value: unknown): value is AppID {
	return typeof value === 'string' && value in apps_config;
}

function synthuxPath(path: string): string {
	if (path.startsWith('/')) return path;
	return `/Users/user/Documents/SynthUX/${path.replace(/^\/+/, '')}`;
}

function ensureParentDirs(path: string): void {
	const parts = path.split('/').filter(Boolean);
	let current = '';
	for (const part of parts.slice(0, -1)) {
		current += `/${part}`;
		mkdir(current);
	}
}

function snapshot(extra: Record<string, unknown> = {}): Record<string, unknown> {
	const openApps = Object.keys(apps.open).filter((id) => apps.open[id as AppID]);
	return {
		activeApp: apps.active,
		openApps,
		windows: Object.fromEntries(
			openApps.map((id) => {
				const state = windowManager.windowStates[id as AppID];
				return [
					id,
					state
						? {
								minimized: state.minimized,
								maximized: state.maximized,
								zIndex: state.zIndex,
								width: state.width,
								height: state.height,
							}
						: null,
				];
			}),
		),
		...extra,
	};
}

function openSurfaceApp(surface: string): AppID {
	const app = SURFACE_APP[surface] ?? 'safari';
	if (!isAppID(app)) return 'safari';
	windowManager.openApp(app);
	return app;
}

function ok(
	requestId: string,
	event: string,
	target: string,
	state: Record<string, unknown>,
	observation: string,
): SynthuxCommandResultMessage {
	return {
		source: 'synthux-environment',
		type: 'synthux-command-result',
		requestId,
		ok: true,
		event,
		target,
		state,
		observation,
	};
}

function fail(requestId: string, error: unknown): SynthuxCommandResultMessage {
	return {
		source: 'synthux-environment',
		type: 'synthux-command-result',
		requestId,
		ok: false,
		event: 'synthux.command_failed',
		state: snapshot(),
		observation: 'SynthUX command failed.',
		error: error instanceof Error ? error.message : String(error),
	};
}

function executeSynthuxTargetAction(requestId: string, action: Record<string, unknown>): SynthuxCommandResultMessage {
	const surface = String(action.surface ?? '');
	const targetAction = String(action.action ?? '');
	const target = String(action.target ?? '');
	const args = (action.args && typeof action.args === 'object' ? action.args : {}) as Record<string, unknown>;
	const app = openSurfaceApp(surface);

	if (surface === 'editor' && targetAction === 'open_file') {
		const path = synthuxPath(target);
		const content = read_file(path) ?? '';
		windowManager.openApp(app, { path });
		return ok(requestId, 'file.opened', path, snapshot({ app, path, chars: content.length }), `${apps_config[app].title} opened ${path}.`);
	}
	if (surface === 'editor' && targetAction === 'replace_buffer') {
		const path = synthuxPath(target);
		const content = String(args.preview ?? `<buffer:${String(args.chars ?? 0)} chars>`);
		ensureParentDirs(path);
		const written = write_file(path, content);
		if (!written) throw new Error(`could not write ${path}`);
		windowManager.openApp(app, { path });
		return ok(requestId, 'buffer.replaced', path, snapshot({ app, path, chars: content.length }), `${apps_config[app].title} replaced ${path}.`);
	}
	if (surface === 'editor' && targetAction === 'save_file') {
		const path = synthuxPath(target);
		return ok(requestId, 'file.saved', path, snapshot({ app, path }), `${path} is saved in the macOS VFS.`);
	}
	if (surface === 'terminal' && targetAction === 'run_command') {
		return ok(
			requestId,
			'process.exited',
			target,
			snapshot({ app, command: args.command, exitCode: args.exit_code ?? 0 }),
			`Terminal ran ${String(args.command ?? target)}.`,
		);
	}
	if (surface === 'browser' || surface === 'github' || surface === 'dashboard') {
		const event =
			targetAction === 'open_url' ? 'browser.navigated' :
			targetAction === 'search' ? 'browser.search' :
			targetAction === 'open_repo' ? 'repo.opened' :
			targetAction === 'create_branch' ? 'branch.created' :
			targetAction === 'open_pull_request' ? 'pull_request.opened' :
			targetAction === 'request_review' ? 'review.requested' :
			targetAction === 'open_panel' ? 'dashboard.panel_opened' :
			targetAction === 'set_time_range' ? 'dashboard.range_set' :
			targetAction === 'drill_into_alert' ? 'dashboard.alert_drilled' :
			'app.action';
		return ok(requestId, event, target, snapshot({ app, args }), `${apps_config[app].title} executed ${surface}.${targetAction}.`);
	}
	if (surface === 'notion' || surface === 'slack') {
		const event =
			targetAction === 'create_page' ? 'document.created' :
			targetAction === 'insert_checklist' ? 'checklist.inserted' :
			targetAction === 'attach_artifact' ? 'artifact.attached' :
			targetAction === 'edit_block' ? 'document.edited' :
			targetAction === 'open_channel' ? 'channel.opened' :
			targetAction === 'post_message' ? 'message.posted' :
			targetAction === 'scroll_history' ? 'channel.scrolled' :
			targetAction === 'react_to_message' ? 'message.reacted' :
			'app.action';
		return ok(requestId, event, target, snapshot({ app, args }), `${apps_config[app].title} executed ${surface}.${targetAction}.`);
	}

	return ok(requestId, 'app.action', target, snapshot({ app, args }), `${apps_config[app].title} accepted ${surface}.${targetAction}.`);
}

function executeSynthuxCommand(data: SynthuxCommandMessage): SynthuxCommandResultMessage {
	try {
		if (data.command.type === 'synthux.getState') {
			return ok(data.requestId, 'state.snapshot', 'macos-web-next', snapshot(), 'Captured macOS web state.');
		}
		return executeSynthuxTargetAction(data.requestId, data.command.action ?? {});
	} catch (err) {
		return fail(data.requestId, err);
	}
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

/** Lazily loaded html2canvas reference. */
let html2canvas: typeof html2canvasModule | null = null;

async function captureScreenshot(): Promise<string> {
	if (!html2canvas) {
		// Dynamic import so the library is only loaded when actually needed.
		const mod = await import('html2canvas');
		html2canvas = mod.default ?? (mod as unknown as typeof html2canvasModule);
	}

	const canvas = await html2canvas(document.body, {
		// Capture at the actual iframe dimensions, no scaling.
		scale: 1,
		useCORS: true,
		allowTaint: true,
		logging: false,
		width: window.innerWidth,
		height: window.innerHeight,
		windowWidth: window.innerWidth,
		windowHeight: window.innerHeight,
	});

	return canvas.toDataURL('image/png', 0.8);
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

async function handleMessage(event: MessageEvent): Promise<void> {
	const { data } = event;

	if (!isInboundMessage(data)) {
		return;
	}

	switch (data.type) {
		case 'screenshot-request': {
			try {
				const dataUrl = await captureScreenshot();
				postToParent({
					source: 'commandagi-simulation',
					type: 'screenshot-response',
					requestId: data.requestId,
					dataUrl,
				});
			} catch (err) {
				postToParent({
					source: 'commandagi-simulation',
					type: 'screenshot-response',
					requestId: data.requestId,
					error: err instanceof Error ? err.message : String(err),
				});
			}
			break;
		}

		case 'event-forward': {
			postToParent({
				source: 'commandagi-simulation',
				type: 'event-forward-ack',
				requestId: data.requestId,
				eventType: data.eventType,
			});
			break;
		}

		case 'synthux-command': {
			postToParent(executeSynthuxCommand(data));
			break;
		}

		default:
			// Unknown message type -- ignore.
			break;
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialise the embed bridge.
 *
 * Safe to call in non-iframe contexts: the messages simply go nowhere.
 * Returns a cleanup function that removes listeners and stops the heartbeat.
 */
export function initEmbedBridge(): () => void {
	// Listen for parent messages.
	window.addEventListener('message', handleMessage);

	// Notify parent that the simulation is ready.
	postToParent({
		source: 'commandagi-simulation',
		type: 'simulation-ready',
		environmentType: 'macos-webapp',
	});

	// Start heartbeat (every 5 seconds).
	heartbeatTimer = setInterval(() => {
		postToParent({
			source: 'commandagi-simulation',
			type: 'heartbeat',
		});
	}, 5_000);

	// Return cleanup function.
	return () => {
		window.removeEventListener('message', handleMessage);
		if (heartbeatTimer !== null) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
	};
}
