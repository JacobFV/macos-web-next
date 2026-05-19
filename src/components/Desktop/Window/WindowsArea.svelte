<script lang="ts">
	import { apps_config } from '🍎/configs/apps/apps-config';
	import { apps, windowManager } from '🍎/state/apps.svelte';
</script>

<section id="windows-area">
	{#each Object.keys(apps_config) as app_id}
		{@const state = windowManager.windowStates[app_id]}
		{#if apps.open[app_id] && apps_config[app_id].should_open_window && state && (!state.minimized || state.closing)}
			{#await import('./Window.svelte') then { default: Window }}
				<Window {app_id} />
			{/await}
		{/if}
	{/each}
</section>

<style>
	section {
		display: block;

		/* // 1.7 rem is the heigh of the header
    // 5.25 rem is the height of dock
    // top: 1.75rem; */
		height: 100%;

		width: 100vw;

		justify-self: center;
	}
</style>
