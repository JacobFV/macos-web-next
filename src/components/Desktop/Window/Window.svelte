<script lang="ts">
	import {
		bounds,
		BoundsFrom,
		Compartment,
		ControlFrom,
		controls,
		disabled,
		draggable,
		events,
		position,
	} from '@neodrag/svelte';
	import { onMount } from 'svelte';
	import { sineInOut } from 'svelte/easing';
	import { elevation } from '🍎/actions';
	import { apps_config } from '🍎/configs/apps/apps-config.ts';
	import { rand_int } from '🍎/helpers/random.ts';
	import { sleep } from '🍎/helpers/sleep';
	import { apps, windowManager, type AppID } from '🍎/state/apps.svelte.ts';
	import { preferences } from '🍎/state/preferences.svelte.ts';

	import AppNexus from '../../apps/AppNexus.svelte';
	import TrafficLights from './TrafficLights.svelte';

	const { app_id }: { app_id: AppID } = $props();

	let dragging_enabled = $state(true);

	let is_maximized = $state(windowManager.windowStates[app_id]?.maximized ?? false);
	let minimized_transform = $state<string>();

	let windowEl = $state<HTMLElement>();

	const { height, width } = apps_config[app_id];
	const resizable = apps_config[app_id].resizable !== false;
	let ws = $derived(windowManager.windowStates[app_id]);

	const remModifier = +height * 1.2 >= window.innerHeight ? 24 : 16;

	const MIN_W = 220;
	const MIN_H = 160;

	const randX = rand_int(-600, 600);
	const randY = rand_int(-100, 100);

	const disabledComp = Compartment.of(() => disabled(!dragging_enabled));

	const initial_x = ws?.x ?? (document.body.clientWidth / 2 + randX) / 2;
	const initial_y = ws?.y ?? (100 + randY) / 2;

	// Tracks the drag offset that neodrag should apply. We bump this during resize
	// to keep neodrag's internal offset in sync — otherwise the next drag would
	// "jump" because the element's transform was changed behind neodrag's back.
	let posX = $state(initial_x);
	let posY = $state(initial_y);

	const positionComp = Compartment.of(() =>
		position({ current: { x: posX, y: posY } }),
	);

	// neodrag writes `style.translate` (not `style.transform`). The translate
	// offset is NOT the same as `rect.left` — the element's static position
	// (parent grid row, TopBar height, etc.) adds an extra offset. Read the
	// translate directly so posX always means "neodrag offset" everywhere.
	function readTranslate(): { x: number; y: number } {
		if (!windowEl) return { x: 0, y: 0 };
		const tr = windowEl.style.translate;
		if (!tr) return { x: 0, y: 0 };
		const parts = tr.split(/\s+/);
		return { x: parseFloat(parts[0]) || 0, y: parseFloat(parts[1]) || 0 };
	}

	function startResize(edge: string, e: PointerEvent) {
		if (!resizable || is_maximized || !windowEl) return;
		// Stop propagation so neodrag's documentElement pointerdown listener
		// doesn't also pick this up and start dragging the window. (controls
		// plugin can't block reliably because the title-bar drag handle is
		// inside the lazy-loaded AppNexus and isn't in the DOM at @attach time.)
		e.preventDefault();
		e.stopPropagation();
		windowManager.focusApp(app_id);

		// Belt-and-suspenders: also disable neodrag for the duration of the resize.
		dragging_enabled = false;

		const rect = windowEl.getBoundingClientRect();
		const startW = rect.width;
		const startH = rect.height;
		const startMouseX = e.clientX;
		const startMouseY = e.clientY;
		const startPosX = posX;
		const startPosY = posY;

		function onMove(ev: PointerEvent) {
			if (!windowEl) return;
			const dx = ev.clientX - startMouseX;
			const dy = ev.clientY - startMouseY;

			let newW = startW;
			let newH = startH;
			let newPosX = startPosX;
			let newPosY = startPosY;

			if (edge.includes('e')) newW = startW + dx;
			if (edge.includes('w')) { newW = startW - dx; newPosX = startPosX + dx; }
			if (edge.includes('s')) newH = startH + dy;
			if (edge.includes('n')) { newH = startH - dy; newPosY = startPosY + dy; }

			if (newW < MIN_W) {
				if (edge.includes('w')) newPosX = startPosX + (startW - MIN_W);
				newW = MIN_W;
			}
			if (newH < MIN_H) {
				if (edge.includes('n')) newPosY = startPosY + (startH - MIN_H);
				newH = MIN_H;
			}

			// Size: write directly to DOM for smoothness; style:width binding doesn't
			// fight back because ws.width hasn't changed yet.
			windowEl.style.width = `${newW}px`;
			windowEl.style.height = `${newH}px`;

			// Position: drive neodrag via posX/posY → positionComp reconfigures →
			// position plugin's setForcedPosition keeps ctx.offset in sync.
			if (edge.includes('w')) posX = newPosX;
			if (edge.includes('n')) posY = newPosY;
		}

		function onUp() {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			dragging_enabled = true;
			recordWindowGeometry();
		}

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	function focusApp() {
		windowManager.focusApp(app_id);
	}

	function windowCloseTransition(
		el: HTMLElement,
		{ duration = preferences.reduced_motion ? 0 : 300 }: SvelteTransitionConfig = {},
	): SvelteTransitionReturnType {
		const existingTransform = getComputedStyle(el).transform;

		return {
			duration,
			easing: sineInOut,
			css: (t) => `opacity: ${t}; transform: ${existingTransform} scale(${t})`,
		};
	}

	async function maximizeApp() {
		if (!preferences.reduced_motion) {
			windowEl.style.transition = 'height 0.3s ease, width 0.3s ease, transform 0.3s ease';
		}

		if (!is_maximized) {
			dragging_enabled = false;

			minimized_transform = windowEl.style.transform;
			windowEl.style.transform = `translate(0px, 0px)`;

			windowEl.style.width = `100%`;
			// windowEl.style.height = 'calc(100vh - 1.7rem - 5.25rem)';
			windowEl.style.height = 'calc(100vh - 1.7rem)';
		} else {
			dragging_enabled = true;
			windowEl.style.transform = minimized_transform;

			windowEl.style.width = `${(ws?.width ?? +width) / remModifier}rem`;
			windowEl.style.height = `${(ws?.height ?? +height) / remModifier}rem`;
		}

		is_maximized = !is_maximized;

		windowManager.toggleMaximize(app_id);

		await sleep(300);

		if (!preferences.reduced_motion) windowEl.style.transition = '';
	}

	function closeApp() {
		windowManager.closeApp(app_id);
	}

	function onAppDragStart() {
		focusApp();
		windowManager.setDragging(true);
	}

	function onAppDragEnd() {
		windowManager.setDragging(false);
		recordWindowGeometry();
	}

	function recordWindowGeometry() {
		if (!windowEl || ws?.maximized) return;
		const rect = windowEl.getBoundingClientRect();
		// Sync posX/posY to neodrag's actual translate offset (NOT rect.left,
		// which includes the element's static layout offset). Otherwise the
		// next position-compartment flush forces the translate to a viewport
		// coord, snapping the window away by the static offset.
		const tr = readTranslate();
		posX = tr.x;
		posY = tr.y;
		windowManager.updateGeometry(app_id, {
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height,
		});
	}

	onMount(() => windowEl?.focus());
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	role="application"
	class="container"
	class:dark={preferences.theme.scheme === 'dark'}
	class:active={apps.active === app_id}
	class:closing={ws?.closing}
	style:width={ws?.maximized ? '100%' : `${(ws?.width ?? +width) / remModifier}rem`}
	style:height={ws?.maximized ? 'calc(100vh - 1.7rem)' : `${(ws?.height ?? +height) / remModifier}rem`}
	style:z-index={ws?.zIndex ?? apps.z_indices[app_id]}
	tabindex="-1"
	bind:this={windowEl}
	{@attach draggable(() => [
		controls({ allow: ControlFrom.selector('.app-window-drag-handle') }),
		bounds(BoundsFrom.viewport({ bottom: -6000, top: 27.2, left: -6000, right: -6000 })),
		disabledComp,
		positionComp,
		events({ onDragStart: onAppDragStart, onDragEnd: onAppDragEnd }),
	])}
	onclick={focusApp}
	onkeydown={() => {}}
	out:windowCloseTransition
>
	<div class="tl-container {app_id}" use:elevation={'window-traffic-lights'}>
		<TrafficLights {app_id} on_maximize_click={maximizeApp} on_close_app={closeApp} />
	</div>

	<AppNexus {app_id} is_being_dragged={apps.is_being_dragged} />

	{#if resizable && !is_maximized}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-n" onpointerdown={(e) => startResize('n', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-s" onpointerdown={(e) => startResize('s', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-w" onpointerdown={(e) => startResize('w', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-e" onpointerdown={(e) => startResize('e', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-nw" onpointerdown={(e) => startResize('nw', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-ne" onpointerdown={(e) => startResize('ne', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-sw" onpointerdown={(e) => startResize('sw', e)}></div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="resize-handle resize-se" onpointerdown={(e) => startResize('se', e)}></div>
	{/if}
</section>

<style>
	.container {
		--elevated-shadow: 0px 8.5px 10px rgba(0, 0, 0, 0.115), 0px 68px 80px rgba(0, 0, 0, 0.23);

		width: 100%;
		height: 100%;

		display: grid;
		grid-template-rows: 1fr;

		position: absolute;

		will-change: width, height;

		border-radius: 0.75rem;
		overflow: hidden;
		box-shadow: var(--elevated-shadow);

		background-color: #f5f5f7;

		cursor: var(--system-cursor-default), auto;

		&.active {
			/* // --elevated-shadow: 0px 6.7px 12px rgba(0, 0, 0, 0.218), 0px 22.3px 40.2px rgba(0, 0, 0, 0.322),
      //   0px 100px 180px rgba(0, 0, 0, 0.54); */
			--elevated-shadow: 0px 8.5px 10px rgba(0, 0, 0, 0.28), 0px 68px 80px rgba(0, 0, 0, 0.56);
		}

		&.dark {
			background-color: #1e1e1e;

			& > :global(section),
			& > :global(div) {
				border-radius: inherit;
				box-shadow:
					inset 0 0 0 0.9px hsla(var(--system-color-dark-hsl), 0.3),
					0 0 0 1px hsla(var(--system-color-light-hsl), 0.5),
					var(--elevated-shadow);
			}
		}
	}

	.tl-container {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;

		/* // Necessary, as `.container` tries to apply shadow on it */
		box-shadow: none !important;
	}

	/* Edge resize handles. .container has overflow: hidden, so handles sit inside the
	   bounds. The dark-mode `& > :global(div)` rule on .container would otherwise apply
	   a box-shadow + inherited radius to these — reset those so the handles are
	   invisible and the visible hit area matches the actual pointer-event area. */
	.resize-handle {
		position: absolute;
		z-index: 1000;
		box-shadow: none !important;
		border-radius: 0 !important;
		background: transparent;
	}

	/* Corner size = 14px so the NW corner barely touches the traffic-lights
	   (which start at top: 0.75rem / left: 0.75rem = 12px). Edges butt up
	   against corners with no gap and no overlap. */
	.resize-n  { top: 0;    left: 14px; right: 14px; height: 10px; cursor: ns-resize; }
	.resize-s  { bottom: 0; left: 14px; right: 14px; height: 10px; cursor: ns-resize; }
	.resize-w  { left: 0;   top: 14px;  bottom: 14px; width: 10px; cursor: ew-resize; }
	.resize-e  { right: 0;  top: 14px;  bottom: 14px; width: 10px; cursor: ew-resize; }
	.resize-nw { top: 0;    left: 0;    width: 14px; height: 14px; cursor: nwse-resize; }
	.resize-ne { top: 0;    right: 0;   width: 14px; height: 14px; cursor: nesw-resize; }
	.resize-sw { bottom: 0; left: 0;    width: 14px; height: 14px; cursor: nesw-resize; }
	.resize-se { bottom: 0; right: 0;   width: 14px; height: 14px; cursor: nwse-resize; }
</style>
