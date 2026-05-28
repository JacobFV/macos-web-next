<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { vfs_version, ls, read_file, write_file, rm, exists, mkdir } from '../../../state/vfs.svelte';
	import { consume_pending_file } from '../../../state/file-opener.svelte';
	import { copy_text, paste_text } from '../../../state/clipboard.svelte';
	import { notify } from '../../../state/notifications.svelte';

	const NOTES_DIR = '/Users/user/Library/Notes';

	type Note = {
		id: string;          // filename without extension, e.g. "1706000000000"
		title: string;
		body: string;
		folder: string;
		pinned: boolean;
		created_at: number;
		updated_at: number;
		deleted_at: number | null;
	};

	type Folder = {
		id: string;
		name: string;
		icon: string;
		system: boolean;
	};

	type SortMode = 'edited' | 'created' | 'title';

	const system_folders: Folder[] = [
		{ id: 'all', name: 'All iCloud', icon: 'icloud', system: true },
		{ id: 'notes', name: 'Notes', icon: 'note', system: true },
		{ id: 'recently-deleted', name: 'Recently Deleted', icon: 'trash', system: true },
	];

	const custom_folders: Folder[] = [
		{ id: 'work', name: 'Work', icon: 'folder', system: false },
		{ id: 'personal', name: 'Personal', icon: 'folder', system: false },
		{ id: 'recipes', name: 'Recipes', icon: 'folder', system: false },
	];

	// ---------------------------------------------------------------------------
	// VFS serialization helpers
	// ---------------------------------------------------------------------------

	/** Separator between JSON metadata and HTML body inside a .md file */
	const FRONTMATTER_SEP = '\n---\n';

	function serialize_note(note: Note): string {
		const meta = {
			title: note.title,
			folder: note.folder,
			pinned: note.pinned,
			created_at: note.created_at,
			updated_at: note.updated_at,
			deleted_at: note.deleted_at,
		};
		return JSON.stringify(meta) + FRONTMATTER_SEP + note.body;
	}

	function deserialize_note(id: string, content: string): Note | null {
		const sep_idx = content.indexOf(FRONTMATTER_SEP);
		if (sep_idx === -1) return null;
		try {
			const meta = JSON.parse(content.substring(0, sep_idx));
			const body = content.substring(sep_idx + FRONTMATTER_SEP.length);
			return {
				id,
				title: meta.title ?? '',
				body,
				folder: meta.folder ?? 'notes',
				pinned: meta.pinned ?? false,
				created_at: meta.created_at ?? Date.now(),
				updated_at: meta.updated_at ?? Date.now(),
				deleted_at: meta.deleted_at ?? null,
			};
		} catch {
			return null;
		}
	}

	function note_path(id: string): string {
		return `${NOTES_DIR}/${id}.md`;
	}

	function save_note(note: Note): void {
		write_file(note_path(note.id), serialize_note(note));
	}

	// ---------------------------------------------------------------------------
	// Seed data (written once on first mount if directory is empty)
	// ---------------------------------------------------------------------------

	const now = Date.now();
	const hour = 3600000;
	const day = 86400000;

	const seed_notes: Omit<Note, 'id'>[] = [
		{
			title: 'Weekly Team Standup Notes',
			body: '<b>Sprint 24 - Week 3</b><br><br><b>Updates:</b><br>- Design team finalized the new dashboard mockups<br>- Backend API migration is 70% complete<br>- Mobile app crash rate down by 40%<br><br><b>Blockers:</b><br>- Waiting on third-party API credentials<br>- Need design review for settings page<br><br><b>Action Items:</b><br>- Schedule design review by Thursday<br>- Follow up with vendor on API keys<br>- Update sprint board with new estimates',
			folder: 'work',
			pinned: true,
			created_at: now - 2 * hour,
			updated_at: now - 2 * hour,
			deleted_at: null,
		},
		{
			title: 'Grocery List',
			body: '<div>Trader Joe\'s run this weekend:</div><br><div class="checklist"><label><input type="checkbox" checked> Organic whole milk</label></div><div class="checklist"><label><input type="checkbox" checked> Free-range eggs (dozen)</label></div><div class="checklist"><label><input type="checkbox"> Sourdough bread</label></div><div class="checklist"><label><input type="checkbox"> Avocados (4)</label></div><div class="checklist"><label><input type="checkbox"> Chicken thighs</label></div><div class="checklist"><label><input type="checkbox"> Jasmine rice</label></div><div class="checklist"><label><input type="checkbox"> Broccoli crowns</label></div><div class="checklist"><label><input type="checkbox" checked> Extra virgin olive oil</label></div><div class="checklist"><label><input type="checkbox"> Dark chocolate (85%)</label></div><div class="checklist"><label><input type="checkbox"> Greek yogurt</label></div><div class="checklist"><label><input type="checkbox"> Fresh basil</label></div>',
			folder: 'personal',
			pinned: true,
			created_at: now - 5 * hour,
			updated_at: now - 3 * hour,
			deleted_at: null,
		},
		{
			title: 'Pasta Carbonara Recipe',
			body: '<b>Classic Roman Carbonara</b><br><i>Serves 4 | Prep: 10 min | Cook: 20 min</i><br><br><b>Ingredients:</b><br>- 400g spaghetti or rigatoni<br>- 200g guanciale (or pancetta), cut into lardons<br>- 4 large egg yolks + 2 whole eggs<br>- 100g Pecorino Romano, finely grated<br>- Freshly cracked black pepper<br>- Kosher salt for pasta water<br><br><b>Instructions:</b><br>1. Bring a large pot of well-salted water to boil<br>2. Cook pasta until 1 minute shy of al dente<br>3. Meanwhile, crisp guanciale in a cold pan over medium heat<br>4. Whisk eggs with most of the cheese and generous pepper<br>5. Reserve 1 cup pasta water, then drain<br>6. Toss hot pasta with guanciale (off heat!)<br>7. Pour egg mixture over, toss vigorously<br>8. Add pasta water a splash at a time until silky<br><br><i>Tip: The key is to work off the heat so eggs don\'t scramble. The residual heat creates the creamy sauce.</i>',
			folder: 'recipes',
			pinned: false,
			created_at: now - 2 * day,
			updated_at: now - 1 * day,
			deleted_at: null,
		},
		{
			title: 'Project Ideas for 2024',
			body: '<b>Side Projects & Explorations</b><br><br><u>High Priority:</u><br>1. Personal finance tracker with AI categorization<br>2. Recipe sharing platform with meal planning<br>3. Open source contribution to Svelte ecosystem<br><br><u>Medium Priority:</u><br>4. Automated plant watering system (Raspberry Pi)<br>5. Local community events aggregator<br>6. Language learning flashcard app with spaced repetition<br><br><u>Someday/Maybe:</u><br>7. Indie game with pixel art style<br>8. Podcast about developer tools<br>9. Home lab Kubernetes cluster<br><br><i>Start with #1 - most practical and useful daily</i>',
			folder: 'personal',
			pinned: false,
			created_at: now - 5 * day,
			updated_at: now - 3 * day,
			deleted_at: null,
		},
		{
			title: 'Morning Journal - January 15',
			body: 'Woke up early today, 6:15 AM. The light was beautiful coming through the window. Made pour-over coffee and sat on the porch for a few minutes before starting work.<br><br>Feeling grateful for:<br>- Good health and energy<br>- The team at work is really coming together<br>- Made progress on the side project last night<br><br>Goals for today:<br>- Finish the API migration task<br>- Go for a 30-min run at lunch<br>- Read 20 pages of current book<br>- Call mom after work<br><br><i>Remember: Progress over perfection. Small steps compound over time.</i>',
			folder: 'personal',
			pinned: false,
			created_at: now - 1 * day - 6 * hour,
			updated_at: now - 1 * day - 6 * hour,
			deleted_at: null,
		},
		{
			title: 'Thai Green Curry',
			body: '<b>Quick Weeknight Thai Green Curry</b><br><i>Serves 4 | 30 minutes</i><br><br><b>Ingredients:</b><br>- 2 tbsp green curry paste<br>- 1 can (400ml) coconut milk<br>- 500g chicken breast, sliced thin<br>- 1 red bell pepper, sliced<br>- 1 zucchini, half-moons<br>- Handful of Thai basil<br>- 2 tbsp fish sauce<br>- 1 tbsp brown sugar<br>- Juice of 1 lime<br>- Jasmine rice to serve<br><br><b>Method:</b><br>1. Fry curry paste in a bit of coconut milk (1 min)<br>2. Add chicken, cook until white (3 min)<br>3. Pour in remaining coconut milk, simmer 10 min<br>4. Add vegetables, cook 5 min more<br>5. Season with fish sauce, sugar, lime<br>6. Top with Thai basil, serve over rice',
			folder: 'recipes',
			pinned: false,
			created_at: now - 6 * day,
			updated_at: now - 4 * day,
			deleted_at: null,
		},
		{
			title: 'Q1 OKR Planning',
			body: '<b>Objectives & Key Results - Q1 2024</b><br><br><b>Objective 1: Improve Platform Reliability</b><br>- KR1: Reduce P1 incidents to &lt; 2 per month<br>- KR2: Achieve 99.95% uptime SLA<br>- KR3: Decrease mean time to recovery by 30%<br><br><b>Objective 2: Accelerate User Growth</b><br>- KR1: Increase MAU by 25%<br>- KR2: Improve onboarding completion to 80%<br>- KR3: Launch referral program with 10% adoption<br><br><b>Objective 3: Team Development</b><br>- KR1: Hire 2 senior engineers<br>- KR2: Complete architecture documentation<br>- KR3: Run 3 internal tech talks<br><br><i>Review cadence: Bi-weekly check-ins, monthly deep dive</i>',
			folder: 'work',
			pinned: false,
			created_at: now - 7 * day,
			updated_at: now - 5 * day,
			deleted_at: null,
		},
		{
			title: 'Books to Read',
			body: '<b>2024 Reading List</b><br><br><div class="checklist"><label><input type="checkbox" checked> <s>Thinking, Fast and Slow</s> - Daniel Kahneman</label></div><div class="checklist"><label><input type="checkbox" checked> <s>The Design of Everyday Things</s> - Don Norman</label></div><div class="checklist"><label><input type="checkbox"> Sapiens - Yuval Noah Harari</label></div><div class="checklist"><label><input type="checkbox"> Atomic Habits - James Clear</label></div><div class="checklist"><label><input type="checkbox"> The Pragmatic Programmer - Hunt & Thomas</label></div><div class="checklist"><label><input type="checkbox"> Project Hail Mary - Andy Weir</label></div><div class="checklist"><label><input type="checkbox"> Staff Engineer - Will Larson</label></div><div class="checklist"><label><input type="checkbox"> Four Thousand Weeks - Oliver Burkeman</label></div><br><i>Goal: 2 books per month, alternate fiction/non-fiction</i>',
			folder: 'personal',
			pinned: false,
			created_at: now - 10 * day,
			updated_at: now - 8 * day,
			deleted_at: null,
		},
		{
			title: 'Home Office Setup Upgrades',
			body: '<b>Planned Upgrades</b><br><br><u>Monitor:</u><br>Apple Studio Display or LG 5K2K ultrawide<br>Budget: $1,200 - $1,600<br><br><u>Desk:</u><br>Standing desk converter - Uplift V2 or Jarvis<br>Budget: $500 - $700<br><br><u>Chair:</u><br>Herman Miller Aeron (size B) or Steelcase Leap<br>Budget: $800 - $1,400<br><br><u>Audio:</u><br>- Shure MV7 microphone for calls<br>- AirPods Max for focus work<br><br><u>Lighting:</u><br>- BenQ ScreenBar Plus monitor light<br>- Philips Hue desk lamp<br><br><b>Total estimated: $3,500 - $4,500</b><br><i>Phase in over 3 months to spread cost</i>',
			folder: 'personal',
			pinned: false,
			created_at: now - 12 * day,
			updated_at: now - 9 * day,
			deleted_at: null,
		},
		{
			title: 'Git Workflow Cheat Sheet',
			body: '<b>Common Git Commands</b><br><br><u>Branching:</u><br><code>git checkout -b feature/name</code><br><code>git push -u origin feature/name</code><br><br><u>Rebasing:</u><br><code>git fetch origin</code><br><code>git rebase origin/main</code><br><code>git push --force-with-lease</code><br><br><u>Squash last N commits:</u><br><code>git reset --soft HEAD~N</code><br><code>git commit -m "combined message"</code><br><br><u>Undo last commit (keep changes):</u><br><code>git reset --soft HEAD~1</code><br><br><u>Cherry-pick:</u><br><code>git cherry-pick &lt;commit-hash&gt;</code><br><br><u>Stash:</u><br><code>git stash push -m "description"</code><br><code>git stash list</code><br><code>git stash pop</code>',
			folder: 'work',
			pinned: false,
			created_at: now - 15 * day,
			updated_at: now - 11 * day,
			deleted_at: null,
		},
		{
			title: 'Workout Routine',
			body: '<b>Push / Pull / Legs Split</b><br><br><b>Day A - Push:</b><br>- Bench Press: 4x8<br>- Overhead Press: 3x10<br>- Incline Dumbbell Press: 3x12<br>- Lateral Raises: 3x15<br>- Tricep Pushdowns: 3x12<br><br><b>Day B - Pull:</b><br>- Deadlift: 4x6<br>- Barbell Rows: 4x8<br>- Pull-ups: 3x max<br>- Face Pulls: 3x15<br>- Barbell Curls: 3x12<br><br><b>Day C - Legs:</b><br>- Squat: 4x8<br>- Romanian Deadlift: 3x10<br>- Leg Press: 3x12<br>- Walking Lunges: 3x10 each<br>- Calf Raises: 4x15<br><br><i>Rest 2-3 min between heavy compounds, 60-90s on accessories</i>',
			folder: 'personal',
			pinned: false,
			created_at: now - 20 * day,
			updated_at: now - 14 * day,
			deleted_at: null,
		},
		{
			title: 'Meeting Notes - Client Kickoff',
			body: '<b>Client: Acme Corp</b><br><b>Date: January 8, 2024</b><br><b>Attendees: Sarah, Mike, Lisa (Acme), Jacob, Chen (Us)</b><br><br><b>Project Scope:</b><br>- Redesign of customer portal<br>- Mobile app v2 launch<br>- API integration with their ERP system<br><br><b>Timeline:</b><br>- Phase 1 (Portal): Feb 1 - Mar 15<br>- Phase 2 (Mobile): Mar 15 - May 1<br>- Phase 3 (API): May 1 - Jun 15<br><br><b>Key Decisions:</b><br>- Using React + Next.js for portal<br>- React Native for mobile (shared components)<br>- Weekly syncs on Tuesdays at 2 PM<br><br><b>Next Steps:</b><br>- Send SOW by Friday<br>- Schedule technical deep-dive for next week<br>- Share Figma access with their team',
			folder: 'work',
			pinned: false,
			created_at: now - 22 * day,
			updated_at: now - 18 * day,
			deleted_at: null,
		},
		{
			title: 'Sourdough Bread Recipe',
			body: '<b>No-Knead Sourdough Loaf</b><br><i>Makes 1 loaf | Active time: 30 min | Total: 24 hours</i><br><br><b>Ingredients:</b><br>- 100g active sourdough starter<br>- 375g water (room temp)<br>- 500g bread flour<br>- 10g salt<br><br><b>Schedule:</b><br>9 AM - Mix dough, autolyse 30 min<br>9:30 AM - Add salt, fold<br>10 AM - 2 PM - Stretch & fold every 30 min (8 folds)<br>2 PM - Shape and place in banneton<br>2:30 PM - Refrigerate overnight (12-16 hrs)<br><br><b>Bake Day:</b><br>6 AM - Preheat Dutch oven at 500F<br>6:45 AM - Score & bake covered 20 min<br>7:05 AM - Remove lid, bake 25 min at 450F<br>7:30 AM - Cool on rack for 1 HOUR before cutting<br><br><i>Patience is the secret ingredient!</i>',
			folder: 'recipes',
			pinned: false,
			created_at: now - 25 * day,
			updated_at: now - 20 * day,
			deleted_at: null,
		},
		{
			title: 'Old Draft - Delete Me',
			body: 'This is some old content that is no longer needed. Was originally a draft for something but I forgot what.',
			folder: 'notes',
			pinned: false,
			created_at: now - 40 * day,
			updated_at: now - 35 * day,
			deleted_at: now - 2 * day,
		},
	];

	// ---------------------------------------------------------------------------
	// Ensure Notes directory exists and seed default notes
	// ---------------------------------------------------------------------------

	function ensure_notes_dir(): void {
		if (!exists(NOTES_DIR)) {
			mkdir(NOTES_DIR);
		}
	}

	// Deterministic per-actor seed so a fleet of machines doesn't all show
	// the identical "Weekly Team Standup Notes" set — that cloning is the
	// most obvious tell in multi-worker captures. We derive an integer from
	// the synthux-injected actor id and use it to rotate which note is
	// pinned/first and to vary the standup note's sprint + metrics.
	function actor_hash(): number {
		let actor = '';
		try {
			const cfg: any = (window as any).__synthuxInternetConfig
				|| (window as any).__synthuxVirtualInternet;
			actor = (cfg && cfg.actor) ? String(cfg.actor) : '';
		} catch { actor = ''; }
		let h = 2166136261;
		for (let i = 0; i < actor.length; i++) {
			h ^= actor.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return Math.abs(h) || 0;
	}

	function varied_seed_notes(): Omit<Note, 'id'>[] {
		const h = actor_hash();
		const list = seed_notes.map((n) => ({ ...n }));
		// Vary the standup note so it reads as this team's, not a clone.
		const sprint = 18 + (h % 12);
		const week = 1 + (h % 4);
		const crash = 20 + (h % 45);
		const migration = 40 + (h % 55);
		const standup = list.find((n) => n.title === 'Weekly Team Standup Notes');
		if (standup) {
			standup.title = `Sprint ${sprint} Standup — Week ${week}`;
			standup.body = standup.body
				.replace('Sprint 24 - Week 3', `Sprint ${sprint} - Week ${week}`)
				.replace('70% complete', `${migration}% complete`)
				.replace('down by 40%', `down by ${crash}%`);
		}
		// Rotate so a different note surfaces first per actor.
		const off = h % list.length;
		return list.slice(off).concat(list.slice(0, off));
	}

	function seed_if_empty(): void {
		ensure_notes_dir();
		const entries = ls(NOTES_DIR);
		if (entries.length > 0) return; // already populated

		const seeds = varied_seed_notes();
		for (let i = 0; i < seeds.length; i++) {
			const s = seeds[i];
			// Use created_at as the id base, offset by index to ensure uniqueness
			const id = String(s.created_at + i);
			const note: Note = { id, ...s };
			save_note(note);
		}
	}

	// ---------------------------------------------------------------------------
	// Derive notes list from VFS (reactive via vfs_version)
	// ---------------------------------------------------------------------------

	const notes = $derived.by(() => {
		// Touch vfs_version so this re-runs whenever the VFS changes
		void vfs_version.value;

		const entries = ls(NOTES_DIR);
		const result: Note[] = [];

		for (const entry of entries) {
			if (entry.type !== 'file' || !entry.name.endsWith('.md')) continue;
			const id = entry.name.replace(/\.md$/, '');
			const content = read_file(`${NOTES_DIR}/${entry.name}`);
			if (content === null) continue;
			const note = deserialize_note(id, content);
			if (note) result.push(note);
		}

		return result;
	});

	let selected_folder_id = $state('all');
	let selected_note_id = $state<string | null>(null);
	let search_query = $state('');
	let sort_mode = $state<SortMode>('edited');
	let show_sort_menu = $state(false);
	let pending_new_note_focus = $state(false);

	// Toolbar format active states
	let fmt_bold = $state(false);
	let fmt_italic = $state(false);
	let fmt_underline = $state(false);
	let fmt_strikethrough = $state(false);

	// Reusable element for stripping HTML (avoids creating new DOM nodes every call)
	let _strip_el: HTMLDivElement | null = null;

	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	function format_date(timestamp: number): string {
		const date = new Date(timestamp);
		const today_start = new Date();
		today_start.setHours(0, 0, 0, 0);
		const yesterday_start = new Date(today_start);
		yesterday_start.setDate(yesterday_start.getDate() - 1);
		const week_start = new Date(today_start);
		week_start.setDate(week_start.getDate() - 6);

		if (timestamp >= today_start.getTime()) {
			return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
		} else if (timestamp >= yesterday_start.getTime()) {
			return 'Yesterday';
		} else if (timestamp >= week_start.getTime()) {
			return DAYS[date.getDay()];
		} else {
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		}
	}

	function format_date_full(timestamp: number): string {
		const date = new Date(timestamp);
		const today_start = new Date();
		today_start.setHours(0, 0, 0, 0);
		const yesterday_start = new Date(today_start);
		yesterday_start.setDate(yesterday_start.getDate() - 1);

		const time_str = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
		if (timestamp >= today_start.getTime()) {
			return 'Today at ' + time_str;
		} else if (timestamp >= yesterday_start.getTime()) {
			return 'Yesterday at ' + time_str;
		} else {
			return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' at ' + time_str;
		}
	}

	function strip_html(html: string): string {
		if (!_strip_el) _strip_el = document.createElement('div');
		_strip_el.innerHTML = html;
		return _strip_el.textContent || _strip_el.innerText || '';
	}

	function get_preview(body: string): string {
		const text = strip_html(body);
		return text.substring(0, 80).trim() || 'No additional text';
	}

	const filtered_notes = $derived.by(() => {
		let result = notes.filter(n => {
			if (selected_folder_id === 'recently-deleted') {
				return n.deleted_at !== null;
			}
			if (n.deleted_at !== null) return false;
			if (selected_folder_id === 'all' || selected_folder_id === 'notes') {
				return true;
			}
			return n.folder === selected_folder_id;
		});

		if (search_query.trim()) {
			const q = search_query.toLowerCase();
			result = result.filter(n =>
				n.title.toLowerCase().includes(q) ||
				strip_html(n.body).toLowerCase().includes(q)
			);
		}

		const pinned = result.filter(n => n.pinned);
		const unpinned = result.filter(n => !n.pinned);

		const sorter = (a: Note, b: Note) => {
			if (sort_mode === 'title') return a.title.localeCompare(b.title);
			if (sort_mode === 'created') return b.created_at - a.created_at;
			return b.updated_at - a.updated_at;
		};

		pinned.sort(sorter);
		unpinned.sort(sorter);

		return [...pinned, ...unpinned];
	});

	const selected_note = $derived(notes.find(n => n.id === selected_note_id) ?? null);

	type NoteGroup = {
		label: string;
		notes: Note[];
	};

	function get_date_group_label(timestamp: number): string {
		const date = new Date(timestamp);
		const today_start = new Date();
		today_start.setHours(0, 0, 0, 0);
		const yesterday_start = new Date(today_start);
		yesterday_start.setDate(yesterday_start.getDate() - 1);
		const week_start = new Date(today_start);
		week_start.setDate(week_start.getDate() - 7);
		const month_start = new Date(today_start);
		month_start.setDate(month_start.getDate() - 30);

		if (timestamp >= today_start.getTime()) return 'Today';
		if (timestamp >= yesterday_start.getTime()) return 'Yesterday';
		if (timestamp >= week_start.getTime()) return 'Previous 7 Days';
		if (timestamp >= month_start.getTime()) return 'Previous 30 Days';
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	const grouped_notes = $derived.by(() => {
		const pinned = filtered_notes.filter(n => n.pinned);
		const unpinned = filtered_notes.filter(n => !n.pinned);

		const groups: NoteGroup[] = [];

		if (pinned.length > 0) {
			groups.push({ label: 'Pinned', notes: pinned });
		}

		// Group unpinned notes by date
		const sort_timestamp = (n: Note) => sort_mode === 'created' ? n.created_at : n.updated_at;
		const date_groups = new Map<string, Note[]>();

		for (const note of unpinned) {
			const label = get_date_group_label(sort_timestamp(note));
			if (!date_groups.has(label)) {
				date_groups.set(label, []);
			}
			date_groups.get(label)!.push(note);
		}

		for (const [label, group_notes] of date_groups) {
			groups.push({ label, notes: group_notes });
		}

		return groups;
	});

	const folder_counts = $derived.by(() => {
		const counts: Record<string, number> = {};
		const active_notes = notes.filter(n => n.deleted_at === null);
		const deleted_notes = notes.filter(n => n.deleted_at !== null);

		counts['all'] = active_notes.length;
		counts['notes'] = active_notes.length;
		counts['recently-deleted'] = deleted_notes.length;

		for (const f of custom_folders) {
			counts[f.id] = active_notes.filter(n => n.folder === f.id).length;
		}
		return counts;
	});

	function select_note(note: Note) {
		selected_note_id = note.id;
	}

	function create_note() {
		const folder = (selected_folder_id === 'all' || selected_folder_id === 'notes' || selected_folder_id === 'recently-deleted')
			? 'notes'
			: selected_folder_id;
		const id = String(Date.now());
		const new_note: Note = {
			id,
			title: '',
			body: '',
			folder,
			pinned: false,
			created_at: Date.now(),
			updated_at: Date.now(),
			deleted_at: null,
		};
		save_note(new_note);
		selected_note_id = id;
		pending_new_note_focus = true;
		notify({
			app_name: 'Notes',
			app_icon: './app-icons/notes/256.webp',
			title: 'New Note',
			body: 'New note created',
		});
	}

	// Auto-focus title field when a new note is created
	$effect(() => {
		if (pending_new_note_focus && selected_note_id !== null) {
			pending_new_note_focus = false;
			tick().then(() => {
				const title_el = document.querySelector('.editor-title') as HTMLElement;
				title_el?.focus();
			});
		}
	});

	function delete_note(id: string) {
		const note = notes.find(n => n.id === id);
		if (!note) return;
		const deleted_title = note.title || 'Untitled Note';
		save_note({ ...note, deleted_at: Date.now() });
		notify({
			app_name: 'Notes',
			app_icon: './app-icons/notes/256.webp',
			title: 'Note Moved to Recently Deleted',
			body: deleted_title,
		});
		// Select next note after deletion (computed filtered_notes will update)
		tick().then(() => {
			const remaining = filtered_notes.filter(n => n.id !== id);
			selected_note_id = remaining.length > 0 ? remaining[0].id : null;
		});
	}

	function restore_note(id: string) {
		const note = notes.find(n => n.id === id);
		if (!note) return;
		save_note({ ...note, deleted_at: null });
	}

	function permanently_delete_note(id: string) {
		rm(note_path(id));
		tick().then(() => {
			const remaining = filtered_notes;
			selected_note_id = remaining.length > 0 ? remaining[0].id : null;
		});
	}

	function toggle_pin(id: string) {
		const note = notes.find(n => n.id === id);
		if (!note) return;
		save_note({ ...note, pinned: !note.pinned });
	}

	function update_note_title(id: string, title: string) {
		const note = notes.find(n => n.id === id);
		if (!note) return;
		save_note({ ...note, title, updated_at: Date.now() });
	}

	function update_note_body(id: string, body: string) {
		const note = notes.find(n => n.id === id);
		if (!note) return;
		save_note({ ...note, body, updated_at: Date.now() });
	}

	function exec_command(command: string, value?: string) {
		document.execCommand(command, false, value);
		update_format_state();
	}

	function insert_checklist() {
		exec_command('insertHTML', '<div class="checklist"><label><input type="checkbox"> Item</label></div>');
	}

	function insert_bullet_list() {
		exec_command('insertUnorderedList');
	}

	function insert_numbered_list() {
		exec_command('insertOrderedList');
	}

	function update_format_state() {
		try {
			fmt_bold = document.queryCommandState('bold');
			fmt_italic = document.queryCommandState('italic');
			fmt_underline = document.queryCommandState('underline');
			fmt_strikethrough = document.queryCommandState('strikeThrough');
		} catch {
			// queryCommandState can throw in some edge cases
		}
	}

	function handle_editor_input(e: Event) {
		const target = e.target as HTMLElement;
		if (selected_note_id !== null) {
			update_note_body(selected_note_id, target.innerHTML);
		}
	}

	function handle_title_input(e: Event) {
		const target = e.target as HTMLElement;
		if (selected_note_id !== null) {
			update_note_title(selected_note_id, target.textContent || '');
		}
	}

	function handle_title_keydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const editor = document.querySelector('.editor-body') as HTMLElement;
			editor?.focus();
		}
	}

	function handle_editor_keyup() {
		update_format_state();
	}

	function handle_editor_mouseup() {
		update_format_state();
	}

	// Handle checkbox clicks inside contenteditable
	function handle_editor_click(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
			// Allow the checkbox to toggle, then save
			setTimeout(() => {
				const body_el = document.querySelector('.editor-body') as HTMLElement;
				if (body_el && selected_note_id !== null) {
					update_note_body(selected_note_id, body_el.innerHTML);
				}
			}, 0);
		}
		update_format_state();
	}

	// Close sort menu on outside click
	function handle_global_click(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.sort-container')) {
			show_sort_menu = false;
		}
	}

	// Track format state on selection change
	function handle_selection_change() {
		update_format_state();
	}

	const sort_label = $derived(
		sort_mode === 'edited' ? 'Date Edited' :
		sort_mode === 'created' ? 'Date Created' : 'Title'
	);

	const is_deleted_folder = $derived(selected_folder_id === 'recently-deleted');

	// ---------------------------------------------------------------------------
	// Mount: seed VFS, check for pending file open, select first note
	// ---------------------------------------------------------------------------

	onMount(() => {
		seed_if_empty();

		// Check if a file was opened from Finder
		const pending = consume_pending_file();
		if (pending) {
			const ext = pending.path.split('.').pop()?.toLowerCase();
			if (ext === 'txt' || ext === 'md') {
				// Extract filename as title
				const filename = pending.path.split('/').pop() ?? 'Untitled';
				const title = filename.replace(/\.(txt|md)$/, '');
				const body = pending.content ?? '';

				// Check if this file already lives in our Notes dir
				const in_notes_dir = pending.path.startsWith(NOTES_DIR + '/');
				if (in_notes_dir) {
					// It's already a note file — select it
					const id = filename.replace(/\.md$/, '');
					selected_note_id = id;
				} else {
					// Create a new note from this external file
					const id = String(Date.now());
					const new_note: Note = {
						id,
						title,
						body,
						folder: 'notes',
						pinned: false,
						created_at: Date.now(),
						updated_at: Date.now(),
						deleted_at: null,
					};
					save_note(new_note);
					selected_note_id = id;
				}
				return;
			}
		}

		// Select the first note by default
		if (notes.length > 0 && selected_note_id === null) {
			// Pick the first filtered note
			const first = filtered_notes[0];
			if (first) {
				selected_note_id = first.id;
			}
		}
	});

	// ---------------------------------------------------------------------------
	// Clipboard: Cmd+C / Cmd+V
	// ---------------------------------------------------------------------------

	function handle_clipboard_keydown(e: KeyboardEvent) {
		const meta = e.metaKey || e.ctrlKey;
		if (!meta || !selected_note) return;

		if (e.key === 'c') {
			// Copy selected text if any, otherwise copy full note body as plain text
			const sel = window.getSelection();
			if (sel && sel.toString().trim()) {
				copy_text(sel.toString());
			} else {
				copy_text(strip_html(selected_note.body) || selected_note.title);
			}
			e.preventDefault();
			return;
		}

		if (e.key === 'v') {
			const text = paste_text();
			if (text && !is_deleted_folder) {
				// Insert at cursor via execCommand so it respects contenteditable focus
				document.execCommand('insertText', false, text);
				e.preventDefault();
			}
			return;
		}
	}
</script>

<svelte:window onclick={handle_global_click} onkeydown={handle_clipboard_keydown} />
<svelte:document onselectionchange={handle_selection_change} />

<section class="container">
	<header class="app-window-drag-handle titlebar">
		<div class="toolbar-left">
			<button class="toolbar-btn" onclick={create_note} title="New Note" aria-label="New Note">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.2"/>
					<path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
				</svg>
			</button>
			{#if selected_note && !is_deleted_folder}
				<button class="toolbar-btn" onclick={() => delete_note(selected_note.id)} title="Delete Note" aria-label="Delete Note">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path d="M4 5h8l-.5 8.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L4 5z" stroke="currentColor" stroke-width="1.2"/>
						<path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					</svg>
				</button>
			{/if}
		</div>
		<div class="toolbar-center">
		</div>
		<div class="toolbar-right">
			<div class="sort-container">
				<button class="toolbar-btn sort-btn" onclick={() => show_sort_menu = !show_sort_menu} title="Sort Notes">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					</svg>
					<span class="sort-label">{sort_label}</span>
				</button>
				{#if show_sort_menu}
					<div class="sort-dropdown">
						<button class="sort-option" class:active={sort_mode === 'edited'} onclick={() => { sort_mode = 'edited'; show_sort_menu = false; }}>
							<span class="check-col">{sort_mode === 'edited' ? '\u2713' : ''}</span>
							Date Edited
						</button>
						<button class="sort-option" class:active={sort_mode === 'created'} onclick={() => { sort_mode = 'created'; show_sort_menu = false; }}>
							<span class="check-col">{sort_mode === 'created' ? '\u2713' : ''}</span>
							Date Created
						</button>
						<button class="sort-option" class:active={sort_mode === 'title'} onclick={() => { sort_mode = 'title'; show_sort_menu = false; }}>
							<span class="check-col">{sort_mode === 'title' ? '\u2713' : ''}</span>
							Title
						</button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<div class="main">
		<!-- Column 1: Folder Sidebar -->
		<aside class="folder-sidebar">
			<div class="folder-section">
				<div class="folder-section-label">iCloud</div>
				{#each system_folders as folder}
					<button
						class="folder-item"
						class:active={selected_folder_id === folder.id}
						onclick={() => { selected_folder_id = folder.id; }}
					>
						<span class="folder-icon" class:trash-icon={folder.icon === 'trash'}>
							{#if folder.icon === 'icloud'}
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path d="M4.5 12C2.567 12 1 10.433 1 8.5c0-1.657 1.153-3.044 2.7-3.4A4.5 4.5 0 018 2c2.067 0 3.813 1.393 4.336 3.293A3.5 3.5 0 0112.5 12h-8z" stroke="currentColor" stroke-width="1.1"/>
								</svg>
							{:else if folder.icon === 'note'}
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" stroke-width="1.1"/>
									<path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
								</svg>
							{:else if folder.icon === 'trash'}
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path d="M4 5h8l-.5 8.5a1 1 0 01-1 .5H5.5a1 1 0 01-1-.5L4 5z" stroke="currentColor" stroke-width="1.1"/>
									<path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
								</svg>
							{/if}
						</span>
						<span class="folder-name">{folder.name}</span>
						{#if (folder_counts[folder.id] ?? 0) > 0}
							<span class="folder-count">{folder_counts[folder.id]}</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="folder-section">
				<div class="folder-section-label">Folders</div>
				{#each custom_folders as folder}
					<button
						class="folder-item"
						class:active={selected_folder_id === folder.id}
						onclick={() => { selected_folder_id = folder.id; }}
					>
						<span class="folder-icon folder-type">
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<path d="M1.5 4.5V12a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H8L6.5 3H3A1.5 1.5 0 001.5 4.5z" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="1.1"/>
							</svg>
						</span>
						<span class="folder-name">{folder.name}</span>
						{#if (folder_counts[folder.id] ?? 0) > 0}
							<span class="folder-count">{folder_counts[folder.id]}</span>
						{/if}
					</button>
				{/each}
			</div>

			<button class="new-folder-btn">
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
					<path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
				New Folder
			</button>
		</aside>

		<!-- Column 2: Note List -->
		<div class="note-list-panel">
			<div class="note-list-header">
				<div class="search-bar">
					<svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
						<circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/>
						<path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
					</svg>
					<input
						type="text"
						placeholder="Search"
						bind:value={search_query}
					/>
					{#if search_query}
						<button class="search-clear" onclick={() => search_query = ''} aria-label="Clear search">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
								<circle cx="6" cy="6" r="5.5" fill="currentColor" opacity="0.3"/>
								<path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
							</svg>
						</button>
					{/if}
				</div>
			</div>

			<div class="note-list">
				{#if filtered_notes.length === 0}
					<div class="empty-state">
						<svg width="36" height="36" viewBox="0 0 36 36" fill="none" opacity="0.25">
							<rect x="6" y="3" width="24" height="30" rx="3" stroke="currentColor" stroke-width="1.5"/>
							<path d="M12 12h12M12 17h12M12 22h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
						</svg>
						<span>No Notes</span>
					</div>
				{/if}
				{#each grouped_notes as group}
					<div class="list-section-header">
						{#if group.label === 'Pinned'}
							<svg width="9" height="9" viewBox="0 0 10 10" fill="none">
								<path d="M5 1L6.5 4L5 7L5 9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
								<circle cx="5" cy="2.5" r="1.5" stroke="currentColor" stroke-width="0.8"/>
							</svg>
						{/if}
						{group.label}
					</div>
					{#each group.notes as note}
						<button
							class="note-card"
							class:active={selected_note_id === note.id}
							onclick={() => select_note(note)}
							oncontextmenu={(e) => { e.preventDefault(); toggle_pin(note.id); }}
						>
							<div class="note-card-title">
								{note.title || 'New Note'}
							</div>
							<div class="note-card-meta">
								<span class="note-card-date">{format_date(note.updated_at)}</span>
								<span class="note-card-preview">{get_preview(note.body)}</span>
							</div>
						</button>
					{/each}
				{/each}
			</div>

			<div class="note-list-footer">
				{filtered_notes.length} {filtered_notes.length === 1 ? 'note' : 'notes'}
			</div>
		</div>

		<!-- Column 3: Editor -->
		<div class="editor-panel">
			{#if selected_note}
				{#if is_deleted_folder}
					<div class="deleted-banner">
						<span>This note is in Recently Deleted.</span>
						<button class="restore-btn" onclick={() => restore_note(selected_note.id)}>Restore</button>
						<button class="perm-delete-btn" onclick={() => permanently_delete_note(selected_note.id)}>Delete Forever</button>
					</div>
				{:else}
					<div class="editor-toolbar">
						<div class="format-group">
							<button class="format-btn" class:fmt-active={fmt_bold} onclick={() => exec_command('bold')} title="Bold">
								<strong>B</strong>
							</button>
							<button class="format-btn" class:fmt-active={fmt_italic} onclick={() => exec_command('italic')} title="Italic">
								<em>I</em>
							</button>
							<button class="format-btn" class:fmt-active={fmt_underline} onclick={() => exec_command('underline')} title="Underline">
								<span style="text-decoration: underline;">U</span>
							</button>
							<button class="format-btn" class:fmt-active={fmt_strikethrough} onclick={() => exec_command('strikeThrough')} title="Strikethrough">
								<span style="text-decoration: line-through;">S</span>
							</button>
						</div>
						<div class="format-divider"></div>
						<div class="format-group">
							<button class="format-btn" onclick={insert_bullet_list} title="Bullet List" aria-label="Bullet List">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<circle cx="3" cy="4" r="1.2" fill="currentColor"/>
									<circle cx="3" cy="8" r="1.2" fill="currentColor"/>
									<circle cx="3" cy="12" r="1.2" fill="currentColor"/>
									<path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
								</svg>
							</button>
							<button class="format-btn" onclick={insert_numbered_list} title="Numbered List">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<text x="1.5" y="5.5" font-size="5" fill="currentColor" font-weight="600">1</text>
									<text x="1.5" y="9.5" font-size="5" fill="currentColor" font-weight="600">2</text>
									<text x="1.5" y="13.5" font-size="5" fill="currentColor" font-weight="600">3</text>
									<path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
								</svg>
							</button>
							<button class="format-btn" onclick={insert_checklist} title="Checklist" aria-label="Checklist">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<rect x="1" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1"/>
									<path d="M2.5 4.5l1 1 2-2" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
									<rect x="1" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1"/>
									<path d="M8 4.5h6M8 11.5h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
								</svg>
							</button>
						</div>
						<div class="format-divider"></div>
						<div class="format-group">
							<button
								class="format-btn pin-btn"
								class:pinned={selected_note.pinned}
								onclick={() => toggle_pin(selected_note.id)}
								title={selected_note.pinned ? 'Unpin Note' : 'Pin Note'}
								aria-label={selected_note.pinned ? 'Unpin Note' : 'Pin Note'}
							>
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
									<path d="M7 1L9 5L7 9.5L7 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
									<circle cx="7" cy="3.5" r="2" stroke="currentColor" stroke-width="1"/>
								</svg>
							</button>
						</div>
					</div>
				{/if}

				<div class="editor-content">
					<div class="editor-date-line">{format_date_full(selected_note.updated_at)}</div>
					{#key selected_note_id}
						<div
							class="editor-title"
							contenteditable={!is_deleted_folder}
							role="textbox"
							tabindex="0"
							oninput={handle_title_input}
							onkeydown={handle_title_keydown}
						>{selected_note.title}</div>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="editor-body"
							contenteditable={!is_deleted_folder}
							role="textbox"
							tabindex="0"
							oninput={handle_editor_input}
							onkeyup={handle_editor_keyup}
							onmouseup={handle_editor_mouseup}
							onclick={handle_editor_click}
						>{@html selected_note.body}</div>
					{/key}
				</div>
			{:else}
				<div class="no-selection">
					<svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.2">
						<rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" stroke-width="2"/>
						<path d="M16 16h16M16 22h16M16 28h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					<span>Select a note</span>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.container {
		height: 100%;
		width: 100%;
		background-color: var(--system-color-light);
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--system-font-family);
		color: var(--system-color-light-contrast);
		font-size: 13px;
		-webkit-font-smoothing: antialiased;
	}

	/* ===== Titlebar / Toolbar ===== */
	.titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		min-height: 38px;
		background: linear-gradient(to bottom, #f6f6f6, #ebebeb);
		border-bottom: 0.5px solid #c8c8c8;

		:global(body.dark) & {
			background: linear-gradient(to bottom, #3a3a3c, #2c2c2e);
			border-bottom-color: #1c1c1e;
		}
	}

	.toolbar-left, .toolbar-center, .toolbar-right {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.toolbar-left { flex: 0 0 auto; padding-left: 64px; }
	.toolbar-center { flex: 1; justify-content: center; }
	.toolbar-right { flex: 0 0 auto; }

	.toolbar-btn {
		background: none;
		border: none;
		color: #636366;
		padding: 4px 6px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		transition: background 0.1s ease;

		&:hover {
			background: rgba(0, 0, 0, 0.06);
		}

		:global(body.dark) & {
			color: #98989d;

			&:hover {
				background: rgba(255, 255, 255, 0.08);
			}
		}
	}

	.sort-container {
		position: relative;
	}

	.sort-label {
		font-size: 11px;
	}

	.sort-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		background: white;
		border: 0.5px solid #d1d1d6;
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.05);
		padding: 4px;
		z-index: 100;
		min-width: 160px;

		:global(body.dark) & {
			background: #2c2c2e;
			border-color: #48484a;
			box-shadow: 0 4px 16px rgba(0,0,0,0.4);
		}
	}

	.sort-option {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 5px 8px;
		border: none;
		background: none;
		font-size: 13px;
		color: var(--system-color-light-contrast);
		cursor: pointer;
		text-align: left;
		border-radius: 4px;

		&:hover {
			background: #007aff;
			color: white;
		}
	}

	.check-col {
		width: 16px;
		text-align: center;
		font-size: 12px;
		color: #007aff;
		flex-shrink: 0;
	}

	.sort-option:hover .check-col {
		color: white;
	}

	/* ===== Main Layout ===== */
	.main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	/* ===== Column 1: Folder Sidebar ===== */
	.folder-sidebar {
		width: 180px;
		min-width: 180px;
		background: #f2f2f7;
		border-right: 0.5px solid #d1d1d6;
		padding: 4px 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;

		:global(body.dark) & {
			background: #1c1c1e;
			border-right-color: #38383a;
		}
	}

	.folder-section {
		padding: 2px 0;
	}

	.folder-section-label {
		font-size: 11px;
		font-weight: 600;
		color: #86868b;
		padding: 8px 14px 4px;
		user-select: none;
	}

	.folder-item {
		display: flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		padding: 4px 14px;
		border: none;
		background: none;
		font-size: 13px;
		color: var(--system-color-light-contrast);
		cursor: pointer;
		text-align: left;
		transition: background 0.12s ease;

		&:hover {
			background: rgba(0, 0, 0, 0.04);
		}

		&.active {
			background: rgba(0, 122, 255, 0.15);
			color: #007aff;
			border-radius: 6px;
			margin: 0 6px;
			padding: 4px 8px;
			width: calc(100% - 12px);
		}

		:global(body.dark) & {
			&:hover {
				background: rgba(255, 255, 255, 0.05);
			}

			&.active {
				background: rgba(10, 132, 255, 0.2);
				color: #0a84ff;
			}
		}
	}

	.folder-icon {
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: #86868b;
	}

	.folder-icon.trash-icon {
		color: #86868b;
	}

	.folder-icon.folder-type {
		color: #f5a623;
	}

	.folder-item.active .folder-icon {
		color: #007aff;
	}

	.folder-item.active .folder-icon.trash-icon {
		color: #007aff;
	}

	.folder-item.active .folder-icon.folder-type {
		color: #007aff;
	}

	:global(body.dark) .folder-item.active .folder-icon {
		color: #0a84ff;
	}

	:global(body.dark) .folder-item.active .folder-icon.trash-icon {
		color: #0a84ff;
	}

	:global(body.dark) .folder-item.active .folder-icon.folder-type {
		color: #0a84ff;
	}

	.folder-name {
		flex: 1;
		font-weight: 400;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.folder-item.active .folder-name {
		font-weight: 500;
	}

	.folder-count {
		font-size: 12px;
		color: #86868b;
		font-variant-numeric: tabular-nums;
	}

	.folder-item.active .folder-count {
		color: #007aff;
		opacity: 0.7;
	}

	:global(body.dark) .folder-item.active .folder-count {
		color: #0a84ff;
	}

	.new-folder-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: auto;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: #007aff;
		font-size: 13px;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.12s ease;

		&:hover {
			background: rgba(0, 122, 255, 0.08);
		}

		:global(body.dark) & {
			color: #0a84ff;

			&:hover {
				background: rgba(10, 132, 255, 0.12);
			}
		}
	}

	/* ===== Column 2: Note List ===== */
	.note-list-panel {
		width: 260px;
		min-width: 260px;
		border-right: 0.5px solid #d1d1d6;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: white;

		:global(body.dark) & {
			border-right-color: #38383a;
			background: #2c2c2e;
		}
	}

	.note-list-header {
		padding: 8px 10px;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.05);

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.08);
		}

		input {
			flex: 1;
			border: none;
			background: none;
			font-size: 13px;
			color: var(--system-color-light-contrast);
			outline: none;
			min-width: 0;
			font-family: inherit;

			&::placeholder {
				color: #86868b;
			}
		}
	}

	.search-icon {
		color: #86868b;
		flex-shrink: 0;
	}

	.search-clear {
		background: none;
		border: none;
		cursor: pointer;
		color: #86868b;
		padding: 0;
		display: flex;
		align-items: center;
	}

	.note-list {
		flex: 1;
		overflow-y: auto;
		padding: 0 4px;
	}

	.list-section-header {
		font-size: 11px;
		font-weight: 600;
		color: #86868b;
		padding: 8px 12px 4px;
		display: flex;
		align-items: center;
		gap: 4px;
		user-select: none;
		min-height: 12px;
	}

	.note-card {
		width: 100%;
		padding: 8px 10px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: var(--system-color-light-contrast);
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.07);
		display: block;
		border-radius: 6px;
		margin: 1px 0;
		transition: background 0.12s ease;

		&:hover {
			background: rgba(0, 0, 0, 0.04);
		}

		&.active {
			background: #ffd60a;
			color: #1c1c1e;
			border-bottom-color: transparent;
		}

		:global(body.dark) & {
			border-bottom-color: rgba(255, 255, 255, 0.04);
			color: #e5e5e7;

			&:hover {
				background: rgba(255, 255, 255, 0.04);
			}

			&.active {
				background: #ffd60a;
				color: #1c1c1e;
			}
		}
	}

	.note-card-title {
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.note-card-meta {
		display: flex;
		gap: 6px;
		font-size: 11.5px;
		color: #86868b;
		line-height: 1.4;
	}

	.note-card.active .note-card-meta {
		color: rgba(28, 28, 30, 0.55);
	}

	.note-card-date {
		white-space: nowrap;
		flex-shrink: 0;
	}

	.note-card-preview {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.note-list-footer {
		padding: 6px 12px;
		font-size: 11px;
		color: #86868b;
		text-align: center;
		border-top: 0.5px solid rgba(0, 0, 0, 0.07);
		font-variant-numeric: tabular-nums;

		:global(body.dark) & {
			border-top-color: rgba(255, 255, 255, 0.04);
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;
		color: #86868b;
		font-size: 14px;
		padding: 40px 0;
		gap: 10px;
	}

	/* ===== Column 3: Editor ===== */
	.editor-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #fefefe;
		min-width: 0;

		:global(body.dark) & {
			background: #1e1e1e;
		}
	}

	.deleted-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: #fff3cd;
		border-bottom: 0.5px solid #e6d9a0;
		font-size: 12px;
		color: #664d03;

		:global(body.dark) & {
			background: #3a3523;
			border-bottom-color: #4a4530;
			color: #ffd60a;
		}

		span {
			flex: 1;
		}
	}

	.restore-btn {
		padding: 4px 12px;
		border: none;
		border-radius: 4px;
		background: #007aff;
		color: white;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;

		&:hover { background: #0066d6; }
	}

	.perm-delete-btn {
		padding: 4px 12px;
		border: none;
		border-radius: 4px;
		background: #ff3b30;
		color: white;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;

		&:hover { background: #d63029; }
	}

	.editor-toolbar {
		display: flex;
		align-items: center;
		padding: 4px 16px;
		gap: 2px;
		border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
		background: #fafafa;
		min-height: 34px;

		:global(body.dark) & {
			border-bottom-color: rgba(255, 255, 255, 0.06);
			background: #252525;
		}
	}

	.format-group {
		display: flex;
		gap: 1px;
	}

	.format-btn {
		background: none;
		border: none;
		color: #636366;
		padding: 4px 7px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		transition: background 0.1s ease, color 0.1s ease;

		&:hover {
			background: rgba(0, 0, 0, 0.07);
		}

		&:active {
			background: rgba(0, 0, 0, 0.12);
		}

		:global(body.dark) & {
			color: #98989d;

			&:hover {
				background: rgba(255, 255, 255, 0.08);
			}

			&:active {
				background: rgba(255, 255, 255, 0.14);
			}
		}
	}

	.format-btn.fmt-active {
		background: rgba(0, 0, 0, 0.1);
		color: #1c1c1e;
	}

	:global(body.dark) .format-btn.fmt-active {
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.pin-btn.pinned {
		color: #f5a623;
	}

	:global(body.dark) .pin-btn.pinned {
		color: #f5a623;
	}

	.format-divider {
		width: 1px;
		height: 18px;
		background: rgba(0, 0, 0, 0.1);
		margin: 0 5px;

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.editor-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px 24px 48px;
	}

	.editor-date-line {
		font-size: 12px;
		color: #86868b;
		text-align: center;
		margin-bottom: 4px;
	}

	.editor-title {
		font-size: 24px;
		font-weight: 700;
		line-height: 1.25;
		margin-bottom: 8px;
		outline: none;
		color: var(--system-color-light-contrast);
		border: none;
		min-height: 32px;
		word-break: break-word;
		letter-spacing: -0.2px;
	}

	.editor-title:empty::before {
		content: 'Title';
		color: #c7c7cc;
		font-weight: 700;
	}

	.editor-body {
		font-size: 15px;
		line-height: 1.7;
		outline: none;
		color: var(--system-color-light-contrast);
		min-height: 120px;
		word-break: break-word;
	}

	.editor-body:empty::before {
		content: 'Start writing...';
		color: #c7c7cc;
	}

	.editor-body :global(b), .editor-body :global(strong) {
		font-weight: 600;
	}

	.editor-body :global(.checklist) {
		padding: 2px 0;
	}

	.editor-body :global(.checklist label) {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.editor-body :global(.checklist input[type="checkbox"]) {
		width: 16px;
		height: 16px;
		accent-color: #f5a623;
		cursor: pointer;
		flex-shrink: 0;
		border-radius: 3px;
	}

	.editor-body :global(ul), .editor-body :global(ol) {
		padding-left: 22px;
		margin: 4px 0;
	}

	.editor-body :global(li) {
		padding: 1px 0;
	}

	.editor-body :global(code) {
		background: rgba(0, 0, 0, 0.06);
		padding: 2px 6px;
		border-radius: 4px;
		font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
		font-size: 13px;

		:global(body.dark) & {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.editor-body :global(i), .editor-body :global(em) {
		font-style: italic;
	}

	.no-selection {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;
		gap: 12px;
		color: #aeaeb2;
		font-size: 15px;
		user-select: none;
	}
</style>
