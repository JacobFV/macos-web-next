import { create_app_config } from '🍎/helpers/create-app-config.ts';

const wallpapers = create_app_config({
	title: 'Wallpapers',
	resizable: true,

	height: 600,
	width: 800,

	dock_breaks_before: true,
});

const calculator = create_app_config({
	title: 'Calculator',

	expandable: true,
	resizable: false,

	height: 250 * 1.414,
	width: 250,
});

const calendar = create_app_config({
	title: 'Calendar',
	resizable: true,
});

const vscode = create_app_config({
	title: 'VSCode',
	resizable: true,

	height: 760,
	width: 1200,
});

const finder = create_app_config({
	title: 'Finder',
	resizable: true,

	height: 700,
	width: 1100,
});

const safari = create_app_config({
	title: 'Safari',
	resizable: true,

	height: 750,
	width: 1100,
});

const terminal = create_app_config({
	title: 'Terminal',
	resizable: true,

	height: 600,
	width: 900,
});

const notes = create_app_config({
	title: 'Notes',
	resizable: true,

	height: 720,
	width: 1150,
});

const messages = create_app_config({
	title: 'Messages',
	resizable: true,

	height: 720,
	width: 1100,
});

const mail = create_app_config({
	title: 'Mail',
	resizable: true,

	height: 760,
	width: 1180,
});

const photos = create_app_config({
	title: 'Photos',
	resizable: true,

	height: 600,
	width: 800,
});

const music = create_app_config({
	title: 'Music',
	resizable: true,

	height: 720,
	width: 1150,
});

const maps = create_app_config({
	title: 'Maps',
	resizable: true,

	height: 550,
	width: 800,
});

const systemPreferences = create_app_config({
	title: 'System Settings',
	resizable: true,

	height: 620,
	width: 860,
});

const facetime = create_app_config({
	title: 'FaceTime',
	resizable: true,

	height: 550,
	width: 750,
});

const reminders = create_app_config({
	title: 'Reminders',
	resizable: true,

	height: 500,
	width: 650,
});

const news = create_app_config({
	title: 'News',
	resizable: true,

	height: 600,
	width: 850,
});

const podcasts = create_app_config({
	title: 'Podcasts',
	resizable: true,

	height: 600,
	width: 850,
});

const tv = create_app_config({
	title: 'TV',
	resizable: true,

	height: 600,
	width: 900,
});

const contacts = create_app_config({
	title: 'Contacts',
	resizable: true,

	height: 500,
	width: 700,
});

const keynote = create_app_config({
	title: 'Keynote',
	resizable: true,

	height: 720,
	width: 1180,
});

const launchpad = create_app_config({
	title: 'Launchpad',
	resizable: true,
	expandable: true,

	height: 600,
	width: 800,
});

const devutils = create_app_config({
	title: 'DevUtils',
	resizable: true,

	height: 550,
	width: 800,
});

const preview = create_app_config({
	title: 'Preview',
	resizable: true,

	height: 720,
	width: 1000,
});

const purusTwitter = create_app_config({
	title: `About the Developer`,
	resizable: true,

	dock_breaks_before: true,

	height: 650,
	width: 980,
});

const viewSource = create_app_config({
	title: `View Source`,
	resizable: true,

	should_open_window: false,
	external_action: () => window.open('https://github.com/JacobFV/macos-web-next', '_blank'),
});

const vercel = create_app_config({
	title: `Powered by Vercel`,
	resizable: true,

	should_open_window: false,
	external_action: () =>
		window.open('https://vercel.com/?utm_source=purus-projects&utm_campaign=oss', '_blank'),

	dock_breaks_before: true,
});

const appstore = create_app_config({
	title: 'App Store',
	resizable: true,
});

export const apps_config = {
	finder,
	safari,
	terminal,
	notes,
	messages,
	mail,
	photos,
	music,
	maps,
	'system-preferences': systemPreferences,
	facetime,
	reminders,
	news,
	podcasts,
	tv,
	contacts,
	keynote,
	launchpad,
	devutils,
	preview,

	wallpapers,
	calculator,
	calendar,
	vscode,
	appstore,

	'purus-twitter': purusTwitter,
	'view-source': viewSource,

	vercel,
};
