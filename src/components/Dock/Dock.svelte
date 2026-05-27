<svelte:options runes={true} />

<script lang="ts">
	import { elevation } from '🍎/actions';
	import { apps_config } from '🍎/configs/apps/apps-config';
	import { apps } from '🍎/state/apps.svelte';
	import { system_needs_update } from '🍎/state/system.svelte';
	import { is_dock_hidden } from '🍎/state/dock.svelte';
	import { preferences } from '🍎/state/preferences.svelte';
	import DockItem from './DockItem.svelte';
	import { untrack } from 'svelte';

	let dock_mouse_x = $state<number | null>(null);

	const HIDDEN_DOCK_THRESHOLD = 30;
	let bodyHeight = $state(0);
	let bodyWidth = $state(0);
	let mouseY = $state(0);
	let mouseX = $state(0);

	let dockContainerEl = $state<HTMLElement>();

	const dock_position = $derived(preferences.dock.position);
	const dock_auto_hide = $derived(preferences.dock.auto_hide);
	const dock_size = $derived(preferences.dock.size);
	const is_vertical = $derived(dock_position === 'left' || dock_position === 'right');

	// Compute the container height in rem based on dock_size preference.
	// Default dock_size is 48, which maps to the original 5.2rem container.
	const container_size_rem = $derived(((dock_size / 48) * 5.2).toFixed(2));

	$effect(() => {
		// Auto-hide off → dock is always visible, full stop. No edge-distance
		// math, no fullscreen exception. The user explicitly disabled hiding.
		if (!dock_auto_hide) {
			untrack(() => (is_dock_hidden.value = false));
			return;
		}

		// Close the auto-opened dock if the cursor leaves the dock area.
		if (is_vertical) {
			const edge_dist = dock_position === 'left'
				? mouseX
				: bodyWidth - mouseX;
			if (edge_dist > (dockContainerEl?.clientWidth ?? 0)) {
				untrack(() => (dock_mouse_x = null));
			}
		} else {
			if (Math.abs(mouseY - bodyHeight) > (dockContainerEl?.clientHeight ?? 0)) {
				untrack(() => (dock_mouse_x = null));
			}
		}

		if (dock_mouse_x !== null) {
			untrack(() => (is_dock_hidden.value = false));
			return;
		}

		if (is_vertical) {
			const edge_dist = dock_position === 'left'
				? mouseX
				: bodyWidth - mouseX;
			untrack(() => (is_dock_hidden.value = edge_dist > HIDDEN_DOCK_THRESHOLD));
		} else {
			untrack(() => (is_dock_hidden.value = Math.abs(mouseY - bodyHeight) > HIDDEN_DOCK_THRESHOLD));
		}
	});
</script>

<svelte:body onmousemove={({ x, y }) => { mouseX = x; mouseY = y; }} />

<svelte:window bind:innerHeight={bodyHeight} bind:innerWidth={bodyWidth} />

<section
	class="dock-container"
	class:dock-hidden={is_dock_hidden.value}
	class:dock-left={dock_position === 'left'}
	class:dock-right={dock_position === 'right'}
	class:dock-bottom={dock_position === 'bottom'}
	bind:this={dockContainerEl}
	use:elevation={'dock'}
	style:--dock-container-size="{container_size_rem}rem"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="dock-el"
		class:hidden={is_dock_hidden.value}
		class:dock-vertical={is_vertical}
		onmousemove={(event) => (dock_mouse_x = is_vertical ? event.y : event.x)}
		onmouseleave={() => (dock_mouse_x = null)}
	>
		{#each Object.entries(apps_config) as [appID, config]}
			{#if config.dock_breaks_before}
				<div class="divider" class:divider-vertical={is_vertical} aria-hidden="true"></div>
			{/if}

			<DockItem mouse_x={dock_mouse_x} app_id={appID} needs_update={system_needs_update.value} vertical={is_vertical} />
		{/each}
	</div>
</section>

<style>
	.dock-container {
		padding-bottom: 0.7rem;
		left: 0;
		bottom: 0;

		width: 100%;
		height: 5.2rem;

		padding: 0.4rem;

		display: flex;
		justify-content: center;

		&:not(.dock-hidden) {
			pointer-events: none;
		}
	}

	/* Bottom dock uses variable height from preferences */
	.dock-container.dock-bottom {
		height: var(--dock-container-size, 5.2rem);
	}

	/* Left/right docks are positioned absolutely along the side */
	.dock-container.dock-left,
	.dock-container.dock-right {
		position: fixed;
		top: 0;
		bottom: auto;
		width: var(--dock-container-size, 5.2rem);
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.dock-container.dock-left {
		left: 0;
		right: auto;
	}

	.dock-container.dock-right {
		left: auto;
		right: 0;
	}

	.dock-el {
		background-color: hsla(var(--system-color-light-hsl), 0.4);

		box-shadow:
			inset 0 0 0 0.2px hsla(var(--system-color-grey-100-hsl), 0.7),
			0 0 0 0.2px hsla(var(--system-color-grey-900-hsl), 0.7),
			hsla(0, 0%, 0%, 0.3) 2px 5px 19px 7px;

		position: relative;

		padding: 0.3rem;

		border-radius: 1.2rem;

		height: 100%;

		display: flex;
		align-items: flex-end;

		transition: transform 0.3s ease;

		&:not(.hidden) {
			pointer-events: auto;
		}

		&.hidden {
			transform: translate3d(0, 200%, 0);

			&::before {
				width: calc(100% - 2px);
				height: calc(100% - 2px);

				margin-top: 1px;
				margin-left: 1px;
			}
		}

		&::before {
			content: '';

			border-radius: 20px;

			width: 100%;
			height: 100%;

			border: inherit;

			backdrop-filter: blur(10px);

			position: absolute;
			top: 0;
			left: 0;

			z-index: -1;
		}
	}

	/* Vertical dock layout for left/right positioning */
	.dock-el.dock-vertical {
		flex-direction: column;
		align-items: center;
		height: auto;
		width: 100%;
	}

	/* Vertical dock hide/show transforms */
	.dock-container.dock-left .dock-el.hidden {
		transform: translate3d(-200%, 0, 0);
	}

	.dock-container.dock-right .dock-el.hidden {
		transform: translate3d(200%, 0, 0);
	}

	.divider {
		height: 100%;
		width: 0.2px;

		background-color: hsla(var(--system-color-dark-hsl), 0.3);

		margin: 0 4px;
	}

	.divider.divider-vertical {
		height: 0.2px;
		width: 100%;
		margin: 4px 0;
	}
</style>
