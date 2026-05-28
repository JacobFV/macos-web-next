<script lang="ts">
	import type { AppID } from '🍎/state/apps.svelte';

	const {
		app_id,
		is_being_dragged,
	}: {
		app_id: AppID;
		is_being_dragged: boolean;
	} = $props();
</script>

{#if app_id === 'finder'}
	{#await import('./Finder/Finder.svelte') then { default: Finder }}
		<Finder />
	{/await}
{:else if app_id === 'safari'}
	{#await import('./Safari/Safari.svelte') then { default: Safari }}
		<Safari {is_being_dragged} />
	{/await}
{:else if app_id === 'terminal'}
	{#await import('./Terminal/Terminal.svelte') then { default: Terminal }}
		<Terminal />
	{/await}
{:else if app_id === 'notes'}
	{#await import('./Notes/Notes.svelte') then { default: Notes }}
		<Notes />
	{/await}
{:else if app_id === 'messages'}
	{#await import('./Messages/Messages.svelte') then { default: Messages }}
		<Messages />
	{/await}
{:else if app_id === 'slack'}
	{#await import('./Slack/Slack.svelte') then { default: Slack }}
		<Slack />
	{/await}
{:else if app_id === 'mail'}
	{#await import('./Mail/Mail.svelte') then { default: Mail }}
		<Mail />
	{/await}
{:else if app_id === 'photos'}
	{#await import('./Photos/Photos.svelte') then { default: Photos }}
		<Photos />
	{/await}
{:else if app_id === 'music'}
	{#await import('./Music/Music.svelte') then { default: Music }}
		<Music />
	{/await}
{:else if app_id === 'maps'}
	{#await import('./Maps/Maps.svelte') then { default: Maps }}
		<Maps />
	{/await}
{:else if app_id === 'system-preferences'}
	{#await import('./SystemPreferences/SystemPreferences.svelte') then { default: SystemPreferences }}
		<SystemPreferences />
	{/await}
{:else if app_id === 'facetime'}
	{#await import('./FaceTime/FaceTime.svelte') then { default: FaceTime }}
		<FaceTime />
	{/await}
{:else if app_id === 'reminders'}
	{#await import('./Reminders/Reminders.svelte') then { default: Reminders }}
		<Reminders />
	{/await}
{:else if app_id === 'news'}
	{#await import('./News/News.svelte') then { default: News }}
		<News />
	{/await}
{:else if app_id === 'podcasts'}
	{#await import('./Podcasts/Podcasts.svelte') then { default: Podcasts }}
		<Podcasts />
	{/await}
{:else if app_id === 'tv'}
	{#await import('./TV/TV.svelte') then { default: TV }}
		<TV />
	{/await}
{:else if app_id === 'contacts'}
	{#await import('./Contacts/Contacts.svelte') then { default: Contacts }}
		<Contacts />
	{/await}
{:else if app_id === 'keynote'}
	{#await import('./Keynote/Keynote.svelte') then { default: Keynote }}
		<Keynote />
	{/await}
{:else if app_id === 'numbers'}
	{#await import('./Numbers/Numbers.svelte') then { default: Numbers }}
		<Numbers />
	{/await}
{:else if app_id === 'launchpad'}
	{#await import('./Launchpad/Launchpad.svelte') then { default: Launchpad }}
		<Launchpad />
	{/await}
{:else if app_id === 'devutils'}
	{#await import('./DevUtils/DevUtils.svelte') then { default: DevUtils }}
		<DevUtils />
	{/await}
{:else if app_id === 'preview'}
	{#await import('./Preview/Preview.svelte') then { default: Preview }}
		<Preview />
	{/await}
{:else if app_id === 'calendar'}
	{#await import('./Calendar/Calendar.svelte') then { default: Calendar }}
		<Calendar />
	{/await}
{:else if app_id === 'vscode'}
	{#await import('./VSCode/VSCode.svelte') then { default: VSCode }}
		<VSCode {is_being_dragged} />
	{/await}
{:else if app_id === 'calculator'}
	{#await import('./Calculator/Calculator.svelte') then { default: Calculator }}
		<Calculator />
	{/await}
{:else if app_id === 'wallpapers'}
	{#await import('./WallpaperApp/WallpaperSelectorApp.svelte') then { default: WallpaperSelector }}
		<WallpaperSelector />
	{/await}
{:else if app_id === 'purus-twitter'}
	{#await import('./PurusProfile/PurusProfile.svelte') then { default: PurusProfile }}
		<PurusProfile />
	{/await}
{:else}
	{#await import('./AppStore/AppStore.svelte') then { default: AppStore }}
		<AppStore {app_id} />
	{/await}
{/if}
