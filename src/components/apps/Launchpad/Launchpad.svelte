<script lang="ts">
	import { apps_config } from '🍎/configs/apps/apps-config';
	import { windowManager, type AppID } from '🍎/state/apps.svelte';

	let search_query = $state('');
	let current_page = $state(0);

	const app_entries = Object.entries(apps_config) as [AppID, (typeof apps_config)[AppID]][];

	const filtered_apps = $derived(
		search_query
			? app_entries.filter(([, config]) =>
				config.title.toLowerCase().includes(search_query.toLowerCase())
			)
			: app_entries
	);

	const items_per_page = 20;
	const total_pages = $derived(Math.ceil(filtered_apps.length / items_per_page));
	const page_apps = $derived(
		filtered_apps.slice(current_page * items_per_page, (current_page + 1) * items_per_page)
	);

	function open_app(app_id: AppID) {
		const config = apps_config[app_id];
		if (!config.should_open_window) {
			config.external_action?.(null);
			return;
		}
		windowManager.openApp(app_id);
	}
</script>

<section class="container">
	<header class="app-window-drag-handle titlebar"></header>

	<div class="content">
		<div class="search-bar">
			<input
				type="text"
				bind:value={search_query}
				placeholder="Search"
			/>
		</div>

		<div class="app-grid">
			{#each page_apps as [app_id, config]}
				<button class="app-item" onclick={() => open_app(app_id)}>
					<img
						src="./app-icons/{app_id}/256.webp"
						alt={config.title}
						class="app-icon"
					/>
					<span class="app-label">{config.title}</span>
				</button>
			{/each}
		</div>

		{#if total_pages > 1}
			<div class="page-dots">
				{#each Array(total_pages) as _, i}
					<button
						class="dot"
						class:active={current_page === i}
						onclick={() => current_page = i}
					></button>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.container {
		height: 100%;
		width: 100%;
		background-color: rgba(30, 30, 30, 0.85);
		backdrop-filter: blur(30px);
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--system-font-family);
		color: white;
	}

	.titlebar {
		padding: 12px;
		min-height: 36px;
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0 24px 24px;
		overflow: hidden;
	}

	.search-bar {
		margin-bottom: 24px;
		width: 220px;

		input {
			width: 100%;
			padding: 8px 14px;
			border: none;
			border-radius: 8px;
			background: rgba(255, 255, 255, 0.12);
			font-size: 14px;
			color: white;
			text-align: center;

			&::placeholder {
				color: rgba(255, 255, 255, 0.5);
			}

			&:focus {
				outline: none;
				background: rgba(255, 255, 255, 0.18);
				text-align: left;
			}
		}
	}

	.app-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
		gap: 20px;
		width: 100%;
		flex: 1;
		align-content: start;
		overflow-y: auto;
	}

	.app-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border: none;
		background: none;
		cursor: pointer;
		padding: 6px;
		border-radius: 8px;

		&:hover {
			background: rgba(255, 255, 255, 0.08);
		}

		&:active .app-icon {
			transform: scale(0.9);
		}
	}

	.app-icon {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		transition: transform 0.1s;
	}

	.app-label {
		font-size: 11px;
		color: white;
		text-align: center;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.page-dots {
		display: flex;
		gap: 8px;
		padding: 12px 0;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.3);
		cursor: pointer;
		padding: 0;

		&.active {
			background: rgba(255, 255, 255, 0.85);
		}

		&:hover:not(.active) {
			background: rgba(255, 255, 255, 0.5);
		}
	}
</style>
