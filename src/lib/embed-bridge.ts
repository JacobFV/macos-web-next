/**
 * SynthUX readiness/state bridge for low-level visual dataset capture.
 *
 * Captured dataset state must be caused by replayed browser input, not by
 * high-level bridge commands.
 */

import { windowManager, apps, type AppID } from '🍎/state/apps.svelte';

interface SynthuxCommandMessage {
	source: 'synthux-executor';
	type: 'synthux-command';
	requestId: string;
	command: {
		type: 'synthux.getState';
	};
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

function postToParent(message: SynthuxCommandResultMessage): void {
	try {
		window.parent.postMessage(message, '*');
	} catch {
		// Standalone mode has no parent frame.
	}
}

function isInboundMessage(data: unknown): data is SynthuxCommandMessage {
	return (
		typeof data === 'object' &&
		data !== null &&
		(data as Record<string, unknown>).source === 'synthux-executor' &&
		(data as Record<string, unknown>).type === 'synthux-command' &&
		((data as Record<string, unknown>).command as Record<string, unknown> | undefined)?.type === 'synthux.getState'
	);
}

function snapshot(): Record<string, unknown> {
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
	};
}

function stateResult(requestId: string): SynthuxCommandResultMessage {
	return {
		source: 'synthux-environment',
		type: 'synthux-command-result',
		requestId,
		ok: true,
		event: 'state.snapshot',
		target: 'macos-web-next',
		state: snapshot(),
		observation: 'Captured macOS web state.',
	};
}

function handleMessage(event: MessageEvent): void {
	if (!isInboundMessage(event.data)) return;
	postToParent(stateResult(event.data.requestId));
}

export function initEmbedBridge(): () => void {
	window.addEventListener('message', handleMessage);
	postToParent(stateResult('synthux-ready'));

	return () => {
		window.removeEventListener('message', handleMessage);
	};
}
