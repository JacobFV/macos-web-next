<script lang="ts">
	import { interpolate } from 'popmotion';
	import { onDestroy, untrack } from 'svelte';
	import { sineInOut } from 'svelte/easing';
	import { spring, tweened } from 'svelte/motion';
	import { elevation } from '🍎/actions';
	import { apps_config } from '🍎/configs/apps/apps-config.ts';
	import { apps, windowManager, type AppID } from '🍎/state/apps.svelte.ts';
	import { preferences } from '🍎/state/preferences.svelte.ts';

	const {
		mouse_x,
		app_id,
		needs_update = false,
		vertical = false,
	}: {
		mouse_x: number | null;
		app_id: AppID;
		needs_update?: boolean;
		vertical?: boolean;
	} = $props();

	// Auto-shrink the dock so all icons + 16px padding fit the viewport.
	// Default dock_size is 48 (-> 57.6px base width); cap so that
	// (icon_count * base_width) + 32 padding <= window.innerWidth.
	const default_base_width = 57.6;
	let viewport_w = $state(typeof window !== 'undefined' ? window.innerWidth : 1440);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const onResize = () => { viewport_w = window.innerWidth; };
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
	const icon_count = $derived(Object.keys(apps_config).length);
	const dock_pref_width = $derived((preferences.dock.size / 48) * default_base_width);
	// Account for magnification: a hovered icon grows to peak_scale,
	// adding (peak_scale - 1) * base_width over the row total at the worst
	// case (cursor centered on one icon). Solve:
	//   icon_count * base + base * extra_factor + 64 <= viewport_w
	// where extra_factor = (peak_scale - 1) + 2*(side_scale - 1) +
	//                      2*(outer_scale - 1) ≈ 0.4 + 0.36 + 0.10 = 0.86
	const peak_extra_factor = 0.9;
	const fit_width = $derived(Math.max(24, Math.min(
		dock_pref_width,
		(viewport_w - 64) / (Math.max(1, icon_count) + peak_extra_factor),
	)));
	const base_width = $derived(fit_width);

	const distance_limit = $derived(base_width * 6);
	const beyond_the_distance_limit = $derived(distance_limit + 1);

	const get_distance_input = $derived([
		-distance_limit,
		-distance_limit / 1.25,
		-distance_limit / 2,
		0,
		distance_limit / 2,
		distance_limit / 1.25,
		distance_limit,
	]);

	// Softer magnification: peak at 1.4x instead of 2x.
	const get_width_output = $derived([
		base_width,
		base_width * 1.05,
		base_width * 1.18,
		base_width * 1.4,
		base_width * 1.18,
		base_width * 1.05,
		base_width,
	]);

	// When magnification is disabled, all output values are the base width (no zoom effect).
	const get_width_output_no_mag = $derived([
		base_width,
		base_width,
		base_width,
		base_width,
		base_width,
		base_width,
		base_width,
	]);

	let image_el = $state<HTMLImageElement>();

	let distance = $state(0);

	// Initialise distance to beyond limit once derived values are ready.
	$effect(() => {
		beyond_the_distance_limit;
		untrack(() => { distance = beyond_the_distance_limit; });
	});

	const width_px = spring(default_base_width, {
		damping: 0.47,
		stiffness: 0.12,
	});

	// Keep spring target in sync when base_width changes (e.g. slider drag)
	$effect(() => {
		base_width;
		untrack(() => { $width_px = base_width; });
	});

	$effect(() => {
		distance;

		const output = preferences.dock.magnification ? get_width_output : get_width_output_no_mag;
		const interp = interpolate(get_distance_input, output);

		untrack(() => ($width_px = interp(distance)));
	});

	let raf: number;
	function animate() {
		if (image_el && mouse_x !== null) {
			const rect = image_el.getBoundingClientRect();

			// For vertical dock we compare along Y axis, for bottom dock along X axis.
			const img_center = vertical
				? rect.top + rect.height / 2
				: rect.left + rect.width / 2;

			const distance_delta = mouse_x - img_center;
			distance = distance_delta;
			return;
		}

		distance = beyond_the_distance_limit;
	}

	$effect(() => {
		mouse_x;
		if (preferences.reduced_motion || apps.is_being_dragged) return;

		raf = requestAnimationFrame(animate);
	});

	const {
		title,
		should_open_window: shouldOpenWindow,
		external_action: externalAction,
	} = apps_config[app_id];

	// Spring animation for the click animation
	const appOpenIconBounceTransform = tweened(0, {
		duration: 400,
		easing: sineInOut,
	});

	async function bounceEffect() {
		// Animate the icon
		await appOpenIconBounceTransform.set(-40);

		// Now animate it back to its place
		appOpenIconBounceTransform.set(0);
	}

	async function openApp(e: MouseEvent) {
		if (!shouldOpenWindow) return externalAction?.(e);

		// For the bounce animation
		const isAppAlreadyOpen = apps.open[app_id];

		windowManager.openApp(app_id);

		if (isAppAlreadyOpen) return;

		bounceEffect();
	}

	onDestroy(() => {
		cancelAnimationFrame(raf);
	});

	const is_app_store = $derived(app_id === 'appstore');
	const show_pwa_badge = $derived(is_app_store && needs_update);

	$effect(() => {
		if (show_pwa_badge) bounceEffect();
	});

	// Bounce transform for vertical docks translates along X instead of Y.
	const bounce_style = $derived(
		vertical
			? `translate(${$appOpenIconBounceTransform}px, 0)`
			: `translate(0, ${$appOpenIconBounceTransform}px)`
	);

	// Tooltip position depends on dock orientation.
	const tooltip_style_top = $derived(
		vertical
			? 'auto'
			: preferences.reduced_motion ? '-50px' : '-35%'
	);

	const tooltip_style_left = $derived(
		vertical ? '110%' : 'auto'
	);
</script>

<button onclick={openApp} aria-label="Launch {title} app" class="dock-open-app-button {app_id}">
	<p
		class="tooltip"
		class:tooltip-enabled={!apps.is_being_dragged}
		class:dark={preferences.theme.scheme === 'dark'}
		class:tooltip-vertical={vertical}
		style:top={tooltip_style_top}
		style:left={tooltip_style_left}
		style:transform={bounce_style}
		use:elevation={'dock-tooltip'}
	>
		{title}
	</p>

	<span style:transform={bounce_style}>
		<img
			bind:this={image_el}
			src="./app-icons/{app_id}/256.webp"
			alt="{title} app"
			style:width="{$width_px / 16}rem"
			draggable="false"
		/>
	</span>

	<div class="dot" class:dot-vertical={vertical} style:--opacity={+apps.open[app_id]}></div>

	{#if show_pwa_badge}
		<div class="pwa-badge" style:transform="scale({$width_px / base_width})">1</div>
	{/if}
</button>

<style>
	img {
		will-change: width;
	}

	button {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		position: relative;

		border-radius: 0.5rem;

		&:hover,
		&:focus-visible {
			.tooltip.tooltip-enabled {
				display: block;
			}
		}

		& > span {
			display: flex;
			justify-content: center;
			align-items: center;
		}
	}

	.tooltip {
		--double-border: 0 0 0 0 white;

		white-space: nowrap;

		position: absolute;

		background-color: hsla(var(--system-color-light-hsl), 0.5);
		backdrop-filter: blur(5px);

		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;

		box-shadow:
			hsla(0deg, 0%, 0%, 30%) 0px 1px 5px 2px,
			var(--double-border);

		color: var(--system-color-light-contrast);
		font-family: var(--system-font-family);
		font-weight: 400;
		font-size: 0.9rem;
		letter-spacing: 0.4px;

		display: none;

		&.dark {
			--double-border: inset 0 0 0 0.9px hsla(var(--system-color-dark-hsl), 0.3),
				0 0 0 1.2px hsla(var(--system-color-light-hsl), 0.3);
		}
	}

	/* Tooltip positioned to the right for vertical docks */
	.tooltip.tooltip-vertical {
		top: 50%;
		transform: translateY(-50%);
	}

	.dot {
		height: 4px;
		width: 4px;

		margin: 0px;

		border-radius: 50%;

		background-color: var(--system-color-dark);

		opacity: var(--opacity);
	}

	/* For vertical docks, dot sits beside the icon instead of below */
	.dot.dot-vertical {
		position: absolute;
		bottom: auto;
		left: -2px;
		top: 50%;
		transform: translateY(-50%);
	}

	.pwa-badge {
		position: absolute;
		top: 1px;
		right: -1px;

		background-color: rgba(248, 58, 58, 0.85);

		box-shadow: hsla(var(--system-color-dark-hsl), 0.4) 0px 0.5px 2px;
		border-radius: 50%;

		pointer-events: none;
		vertical-align: middle;

		width: 1.5rem;
		height: 1.5rem;

		margin: 0;
		padding: 0;

		text-align: center;
		color: white;

		font-size: 1rem;
		line-height: 1.5;
	}
</style>
