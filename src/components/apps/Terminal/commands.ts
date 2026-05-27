// Command implementations for the Terminal app
// Uses the shared VFS module instead of the local virtual-fs.

import type { FSNode } from '../../../state/vfs.svelte';
import {
	vfs_root,
	format_size,
	format_date_short,
} from '../../../state/vfs.svelte';
import { resolve_path, get_parent_dir } from './virtual-fs';

// ANSI-style color tags that get rendered as HTML spans
// We use a simple tag system: <c:color>text</c>
// Colors: red, green, blue, cyan, magenta, yellow, white, gray, bold, dim
export function colorize(text: string, color: string): string {
	return `<c:${color}>${text}</c>`;
}

export interface TerminalState {
	cwd: string;
	history: string[];
	env: Record<string, string>;
}

export interface CommandResult {
	lines: string[];
	new_cwd?: string;
	clear?: boolean;
}

type CommandFn = (args: string[], state: TerminalState) => CommandResult;

function cmd_ls(args: string[], state: TerminalState): CommandResult {
	const show_all = args.includes('-a') || args.includes('-la') || args.includes('-al');
	const show_long = args.includes('-l') || args.includes('-la') || args.includes('-al');

	// Find path argument (non-flag)
	const path_arg = args.find(a => !a.startsWith('-')) || '.';
	const target = path_arg === '.' ? state.cwd : path_arg;
	const { node } = resolve_path(vfs_root, state.cwd, target);

	if (!node) {
		return { lines: [`ls: ${path_arg}: No such file or directory`] };
	}

	if (node.type === 'file') {
		if (show_long) {
			return { lines: [format_long_entry(node)] };
		}
		return { lines: [node.name] };
	}

	if (node.type !== 'dir' || !node.children) {
		return { lines: [] };
	}

	let entries = Array.from(node.children.values());

	if (!show_all) {
		entries = entries.filter(e => !e.name.startsWith('.'));
	}

	entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

	if (show_long) {
		const total = entries.reduce((sum, e) => sum + Math.ceil(e.size / 512), 0);
		const lines = [`total ${total}`];

		if (show_all) {
			// Add . and ..
			lines.push(format_long_entry({
				type: 'dir', name: '.', permissions: 'drwxr-xr-x',
				owner: 'user', group: 'staff', size: 64,
				modified: node.modified,
			}));
			lines.push(format_long_entry({
				type: 'dir', name: '..', permissions: 'drwxr-xr-x',
				owner: 'user', group: 'staff', size: 64,
				modified: node.modified,
			}));
		}

		for (const entry of entries) {
			lines.push(format_long_entry(entry));
		}
		return { lines };
	}

	// Short format: colorized columns
	const items = entries.map(e => colorize_entry_name(e));
	if (items.length === 0) return { lines: [] };

	// Lay out in columns
	const lines = layout_columns(items, entries);
	return { lines };
}

function format_long_entry(entry: FSNode): string {
	const links = entry.type === 'dir' ? ' 3' : ' 1';
	const owner = entry.owner.padEnd(6);
	const group = entry.group.padEnd(6);
	const size = String(entry.size).padStart(8);
	const date = format_date_short(entry.modified);
	const name = colorize_entry_name(entry);
	return `${entry.permissions}${links} ${owner} ${group} ${size} ${date} ${name}`;
}

function colorize_entry_name(entry: FSNode): string {
	if (entry.type === 'dir') {
		return colorize(entry.name, 'blue');
	}
	if (entry.type === 'symlink') {
		return colorize(entry.name, 'magenta') + ' -> ' + (entry.target || '');
	}
	// Only check executable bit on files, not directories
	if (entry.type === 'file' && entry.permissions && entry.permissions[3] === 'x') {
		return colorize(entry.name, 'red');
	}
	// Colorize by extension
	const ext = entry.name.split('.').pop()?.toLowerCase();
	if (ext && ['jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
		return colorize(entry.name, 'magenta');
	}
	if (ext && ['zip', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso'].includes(ext)) {
		return colorize(entry.name, 'red');
	}
	if (ext && ['pdf', 'doc', 'docx', 'xlsx'].includes(ext)) {
		return colorize(entry.name, 'green');
	}
	return entry.name;
}

function layout_columns(colored_items: string[], entries: FSNode[]): string[] {
	// For simplicity, use a 2-4 column layout based on count
	if (entries.length <= 4) {
		return [colored_items.join('    ')];
	}

	// Calculate raw name lengths (without color tags)
	const raw_lengths = entries.map(e => e.name.length);
	const max_len = Math.max(...raw_lengths) + 4;
	const cols = Math.max(1, Math.floor(80 / max_len));

	const lines: string[] = [];
	for (let i = 0; i < colored_items.length; i += cols) {
		const row_items: string[] = [];
		for (let j = 0; j < cols && i + j < colored_items.length; j++) {
			const idx = i + j;
			const padding = max_len - raw_lengths[idx];
			row_items.push(colored_items[idx] + ' '.repeat(Math.max(1, padding)));
		}
		lines.push(row_items.join(''));
	}
	return lines;
}

function cmd_cd(args: string[], state: TerminalState): CommandResult {
	const target = args[0] || '~';

	if (target === '-') {
		const old = state.env['OLDPWD'] || state.cwd;
		// Real zsh prints the directory when using cd -
		return { lines: [old], new_cwd: old };
	}

	const { node, absolute_path } = resolve_path(vfs_root, state.cwd, target);

	if (!node) {
		return { lines: [`cd: no such file or directory: ${target}`] };
	}

	if (node.type !== 'dir') {
		return { lines: [`cd: not a directory: ${target}`] };
	}

	return { lines: [], new_cwd: absolute_path };
}

function cmd_pwd(_args: string[], state: TerminalState): CommandResult {
	return { lines: [state.cwd] };
}

function cmd_cat(args: string[], state: TerminalState): CommandResult {
	if (args.length === 0) {
		return { lines: ['usage: cat [-benstuv] [file ...]'] };
	}

	const show_numbers = args.includes('-n');
	const file_args = args.filter(a => !a.startsWith('-'));

	if (file_args.length === 0) {
		return { lines: ['usage: cat [-benstuv] [file ...]'] };
	}

	const all_lines: string[] = [];

	for (const file_path of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, file_path);

		if (!node) {
			all_lines.push(`cat: ${file_path}: No such file or directory`);
			continue;
		}

		if (node.type === 'dir') {
			all_lines.push(`cat: ${file_path}: Is a directory`);
			continue;
		}

		if (node.content !== undefined) {
			const lines = node.content.split('\n');
			// Remove trailing empty line from split
			if (lines[lines.length - 1] === '') lines.pop();
			if (show_numbers) {
				lines.forEach((line, i) => {
					all_lines.push(`     ${i + 1}\t${line}`);
				});
			} else {
				all_lines.push(...lines);
			}
		} else {
			all_lines.push(`cat: ${file_path}: Binary file`);
		}
	}

	return { lines: all_lines };
}

function cmd_echo(args: string[], _state: TerminalState): CommandResult {
	const text = args.join(' ')
		.replace(/^["']|["']$/g, '')
		.replace(/\\n/g, '\n')
		.replace(/\\t/g, '\t');
	return { lines: text.split('\n') };
}

function cmd_printf(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0) return { lines: ['printf: usage: printf format [arguments]'] };
	const fmt = args[0].replace(/^["']|["']$/g, '');
	const text = fmt.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
	const result_args = args.slice(1).join(' ');
	return { lines: (text + result_args).split('\n') };
}

function cmd_mkdir(args: string[], state: TerminalState): CommandResult {
	const make_parents = args.includes('-p');
	const dir_args = args.filter(a => !a.startsWith('-'));

	if (dir_args.length === 0) {
		return { lines: ['usage: mkdir [-pv] directory ...'] };
	}

	for (const dir_path of dir_args) {
		const { node } = resolve_path(vfs_root, state.cwd, dir_path);
		if (node) {
			return { lines: [`mkdir: ${dir_path}: File exists`] };
		}

		const abs = resolve_path(vfs_root, state.cwd, dir_path).absolute_path;
		const { parent } = get_parent_dir(vfs_root, abs);

		if (!parent || parent.type !== 'dir' || !parent.children) {
			if (!make_parents) {
				return { lines: [`mkdir: ${dir_path}: No such file or directory`] };
			}
		}

		const name = dir_path.split('/').filter(Boolean).pop()!;
		if (parent && parent.children) {
			parent.children.set(name, {
				type: 'dir',
				name,
				permissions: 'drwxr-xr-x',
				owner: 'user',
				group: 'staff',
				size: 64,
				modified: new Date(),
				children: new Map(),
			});
		}
	}

	return { lines: [] };
}

function cmd_touch(args: string[], state: TerminalState): CommandResult {
	const file_args = args.filter(a => !a.startsWith('-'));

	if (file_args.length === 0) {
		return { lines: ['usage: touch [-A [-][[hh]mm]SS] [-achm] [-r file] [-t [[CC]YY]MMDDhhmm[.SS]] file ...'] };
	}

	for (const file_path of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, file_path);
		if (node) {
			node.modified = new Date();
			continue;
		}

		const abs_path = resolve_path(vfs_root, state.cwd, file_path).absolute_path;
		const { parent } = get_parent_dir(vfs_root, abs_path);

		if (!parent || parent.type !== 'dir' || !parent.children) {
			return { lines: [`touch: ${file_path}: No such file or directory`] };
		}

		const name = abs_path.split('/').filter(Boolean).pop()!;
		parent.children.set(name, {
			type: 'file',
			name,
			permissions: '-rw-r--r--',
			owner: 'user',
			group: 'staff',
			size: 0,
			modified: new Date(),
			content: '',
		});
	}

	return { lines: [] };
}

function cmd_rm(args: string[], state: TerminalState): CommandResult {
	const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-R');
	const force = args.includes('-f') || args.includes('-rf');
	const file_args = args.filter(a => !a.startsWith('-'));

	if (file_args.length === 0) {
		return { lines: ['usage: rm [-f | -i] [-dIPRrvWx] file ...'] };
	}

	for (const file_path of file_args) {
		const abs_path = resolve_path(vfs_root, state.cwd, file_path).absolute_path;
		const { node } = resolve_path(vfs_root, state.cwd, file_path);

		if (!node) {
			if (!force) {
				return { lines: [`rm: ${file_path}: No such file or directory`] };
			}
			continue;
		}

		if (node.type === 'dir' && !recursive) {
			return { lines: [`rm: ${file_path}: is a directory`] };
		}

		const { parent } = get_parent_dir(vfs_root, abs_path);
		if (parent && parent.children) {
			parent.children.delete(node.name);
		}
	}

	return { lines: [] };
}

function cmd_grep(args: string[], state: TerminalState): CommandResult {
	const case_insensitive = args.includes('-i');
	const show_numbers = args.includes('-n');
	const recursive = args.includes('-r') || args.includes('-R');
	const non_flag_args = args.filter(a => !a.startsWith('-'));

	if (non_flag_args.length < 1) {
		return { lines: ['usage: grep [-abcDEFGHhIiJLlMmnOopqRSsUVvwXxZz] [-A num] [-B num] [-C[num]]', '       [-e pattern] [-f file] [--binary-files=value] [--color=when]', '       [pattern] [file ...]'] };
	}

	if (non_flag_args.length < 2 && !recursive) {
		return { lines: ['usage: grep [-abcDEFGHhIiJLlMmnOopqRSsUVvwXxZz] [-A num] [-B num] [-C[num]]', '       [-e pattern] [-f file] [--binary-files=value] [--color=when]', '       [pattern] [file ...]'] };
	}

	const pattern = non_flag_args[0];
	const file_paths = non_flag_args.slice(1);
	const all_lines: string[] = [];

	let regex: RegExp;
	try {
		regex = new RegExp(pattern, case_insensitive ? 'gi' : 'g');
	} catch {
		return { lines: [`grep: Invalid regular expression: ${pattern}`] };
	}

	const multi_file = file_paths.length > 1 || recursive;

	function grep_file(file_path: string, node: FSNode) {
		if (node.type === 'dir') {
			if (recursive && node.children) {
				for (const [child_name, child] of node.children) {
					grep_file(file_path + '/' + child_name, child);
				}
			} else if (!recursive) {
				all_lines.push(`grep: ${file_path}: Is a directory`);
			}
			return;
		}

		if (node.content) {
			const lines = node.content.split('\n');
			lines.forEach((line, i) => {
				if (regex.test(line)) {
					regex.lastIndex = 0; // reset
					const highlighted = line.replace(regex, (match) => colorize(match, 'red'));
					const prefix_parts: string[] = [];
					if (multi_file) prefix_parts.push(colorize(file_path, 'magenta') + ':');
					if (show_numbers) prefix_parts.push(colorize(String(i + 1), 'green') + ':');
					all_lines.push(prefix_parts.join('') + highlighted);
				}
				regex.lastIndex = 0;
			});
		}
	}

	if (file_paths.length === 0 && recursive) {
		// grep -r pattern . (search current directory)
		const { node } = resolve_path(vfs_root, state.cwd, '.');
		if (node && node.type === 'dir' && node.children) {
			for (const [child_name, child] of node.children) {
				grep_file(child_name, child);
			}
		}
	} else {
		for (const file_path of file_paths) {
			const { node } = resolve_path(vfs_root, state.cwd, file_path);
			if (!node) {
				all_lines.push(`grep: ${file_path}: No such file or directory`);
				continue;
			}
			grep_file(file_path, node);
		}
	}

	return { lines: all_lines };
}

function cmd_find(args: string[], state: TerminalState): CommandResult {
	const path_arg = args.find(a => !a.startsWith('-')) || '.';
	const name_idx = args.indexOf('-name');
	const type_idx = args.indexOf('-type');

	const name_pattern = name_idx >= 0 && args[name_idx + 1] ? args[name_idx + 1].replace(/^["']|["']$/g, '') : null;
	const type_filter = type_idx >= 0 && args[type_idx + 1] ? args[type_idx + 1] : null;

	const target = path_arg === '.' ? state.cwd : path_arg;
	const { node } = resolve_path(vfs_root, state.cwd, target);

	if (!node || node.type !== 'dir' || !node.children) {
		return { lines: [`find: ${path_arg}: No such file or directory`] };
	}

	const results: string[] = [];

	function walk(dir_node: FSNode, prefix: string) {
		if (dir_node.type !== 'dir' || !dir_node.children) return;

		for (const [name, child] of dir_node.children) {
			const full_path = prefix + '/' + name;

			let matches = true;
			if (name_pattern) {
				// Simple glob: convert * to regex
				const re = new RegExp('^' + name_pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
				matches = re.test(name);
			}
			if (type_filter) {
				if (type_filter === 'f' && child.type !== 'file') matches = false;
				if (type_filter === 'd' && child.type !== 'dir') matches = false;
			}

			if (matches) {
				results.push(full_path);
			}

			if (child.type === 'dir') {
				walk(child, full_path);
			}
		}
	}

	results.push(path_arg);
	walk(node, path_arg);

	return { lines: results };
}

function cmd_clear(_args: string[], _state: TerminalState): CommandResult {
	return { lines: [], clear: true };
}

function cmd_history(_args: string[], state: TerminalState): CommandResult {
	return {
		lines: state.history.map((cmd, i) =>
			`  ${String(i + 1).padStart(4)}  ${cmd}`
		),
	};
}

function cmd_whoami(_args: string[], _state: TerminalState): CommandResult {
	return { lines: ['user'] };
}

function cmd_hostname(_args: string[], _state: TerminalState): CommandResult {
	return { lines: ['macbook.local'] };
}

function cmd_uname(args: string[], _state: TerminalState): CommandResult {
	if (args.includes('-a')) {
		return { lines: ['Darwin macbook.local 23.2.0 Darwin Kernel Version 23.2.0: Wed Nov 15 21:54:10 PST 2023; root:xnu-10002.61.3~2/RELEASE_ARM64_T6000 arm64'] };
	}
	if (args.includes('-r')) {
		return { lines: ['23.2.0'] };
	}
	if (args.includes('-m')) {
		return { lines: ['arm64'] };
	}
	return { lines: ['Darwin'] };
}

function cmd_date(_args: string[], _state: TerminalState): CommandResult {
	const d = new Date();
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const tz = d.toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ').pop();
	return {
		lines: [`${days[d.getDay()]} ${months[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${d.toTimeString().split(' ')[0]} ${tz} ${d.getFullYear()}`],
	};
}

function cmd_uptime(_args: string[], _state: TerminalState): CommandResult {
	const d = new Date();
	const time = d.toTimeString().split(' ')[0].slice(0, 5);
	const days = Math.floor(Math.random() * 14) + 1;
	const users = 2;
	const load = [
		(Math.random() * 3 + 0.5).toFixed(2),
		(Math.random() * 2 + 0.3).toFixed(2),
		(Math.random() * 1.5 + 0.2).toFixed(2),
	];
	return {
		lines: [`${time}  up ${days} days,  3:42, ${users} users, load averages: ${load.join(' ')}`],
	};
}

function cmd_which(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0) return { lines: [] };

	const known_paths: Record<string, string> = {
		'ls': '/bin/ls', 'cd': '/usr/bin/cd', 'cat': '/bin/cat', 'grep': '/usr/bin/grep',
		'mkdir': '/bin/mkdir', 'rm': '/bin/rm', 'touch': '/usr/bin/touch',
		'echo': '/bin/echo', 'python3': '/usr/bin/python3', 'node': '/usr/local/bin/node',
		'npm': '/usr/local/bin/npm', 'git': '/usr/bin/git', 'vim': '/usr/bin/vim',
		'curl': '/usr/bin/curl', 'zsh': '/bin/zsh', 'bash': '/bin/bash',
		'ssh': '/usr/bin/ssh', 'man': '/usr/bin/man', 'brew': '/usr/local/bin/brew',
		'find': '/usr/bin/find', 'sort': '/usr/bin/sort', 'awk': '/usr/bin/awk',
		'sed': '/usr/bin/sed', 'wc': '/usr/bin/wc', 'head': '/usr/bin/head',
		'tail': '/usr/bin/tail',
	};

	const lines: string[] = [];
	for (const cmd of args) {
		if (known_paths[cmd]) {
			lines.push(known_paths[cmd]);
		} else {
			lines.push(`${cmd} not found`);
		}
	}
	return { lines };
}

function cmd_head(args: string[], state: TerminalState): CommandResult {
	let num_lines = 10;
	const file_args: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '-n' && args[i + 1]) {
			num_lines = parseInt(args[i + 1], 10) || 10;
			i++;
		} else if (!args[i].startsWith('-')) {
			file_args.push(args[i]);
		}
	}

	if (file_args.length === 0) return { lines: ['usage: head [-n count] [file ...]'] };

	const all: string[] = [];
	for (const fp of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, fp);
		if (!node) { all.push(`head: ${fp}: No such file or directory`); continue; }
		if (node.type === 'dir') { all.push(`head: ${fp}: Is a directory`); continue; }
		if (file_args.length > 1) {
			all.push(`==> ${fp} <==`);
		}
		if (node.content) {
			const lines = node.content.split('\n');
			all.push(...lines.slice(0, num_lines));
		}
	}
	return { lines: all };
}

function cmd_tail(args: string[], state: TerminalState): CommandResult {
	let num_lines = 10;
	const file_args: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '-n' && args[i + 1]) {
			num_lines = parseInt(args[i + 1], 10) || 10;
			i++;
		} else if (!args[i].startsWith('-')) {
			file_args.push(args[i]);
		}
	}

	if (file_args.length === 0) return { lines: ['usage: tail [-n count] [file ...]'] };

	const all: string[] = [];
	for (const fp of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, fp);
		if (!node) { all.push(`tail: ${fp}: No such file or directory`); continue; }
		if (node.type === 'dir') { all.push(`tail: ${fp}: Is a directory`); continue; }
		if (file_args.length > 1) {
			all.push(`==> ${fp} <==`);
		}
		if (node.content) {
			const lines = node.content.split('\n').filter(l => l !== '');
			all.push(...lines.slice(-num_lines));
		}
	}
	return { lines: all };
}

function cmd_wc(args: string[], state: TerminalState): CommandResult {
	const file_args = args.filter(a => !a.startsWith('-'));
	if (file_args.length === 0) return { lines: ['usage: wc [-clmw] [file ...]'] };

	const all: string[] = [];
	let total_lines = 0, total_words = 0, total_bytes = 0;

	for (const fp of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, fp);
		if (!node) { all.push(`wc: ${fp}: No such file or directory`); continue; }
		if (node.type === 'dir') { all.push(`wc: ${fp}: read: Is a directory`); continue; }
		const content = node.content || '';
		const l = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
		const w = content.split(/\s+/).filter(Boolean).length;
		const b = node.size || content.length;
		total_lines += l; total_words += w; total_bytes += b;
		all.push(`${String(l).padStart(8)}${String(w).padStart(8)}${String(b).padStart(8)} ${fp}`);
	}

	if (file_args.length > 1) {
		all.push(`${String(total_lines).padStart(8)}${String(total_words).padStart(8)}${String(total_bytes).padStart(8)} total`);
	}
	return { lines: all };
}

function cmd_sort(args: string[], state: TerminalState): CommandResult {
	const reverse = args.includes('-r');
	const numeric = args.includes('-n');
	const unique = args.includes('-u');
	const file_args = args.filter(a => !a.startsWith('-'));

	if (file_args.length === 0) return { lines: ['usage: sort [-bcCdfghiRMmnrsuVz] [-t char] [file ...]'] };

	const all_content: string[] = [];
	for (const fp of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, fp);
		if (!node) return { lines: [`sort: ${fp}: No such file or directory`] };
		if (node.type === 'dir') return { lines: [`sort: ${fp}: Is a directory`] };
		if (node.content) {
			all_content.push(...node.content.split('\n').filter(l => l !== ''));
		}
	}

	let sorted: string[];
	if (numeric) {
		sorted = all_content.sort((a, b) => parseFloat(a) - parseFloat(b));
	} else {
		sorted = all_content.sort();
	}
	if (reverse) sorted.reverse();
	if (unique) sorted = [...new Set(sorted)];

	return { lines: sorted };
}

function cmd_uniq(args: string[], state: TerminalState): CommandResult {
	const count = args.includes('-c');
	const file_args = args.filter(a => !a.startsWith('-'));

	if (file_args.length === 0) return { lines: ['usage: uniq [-c | -d | -D | -u] [-i] [-f fields] [-s chars] [input [output]]'] };

	const { node } = resolve_path(vfs_root, state.cwd, file_args[0]);
	if (!node) return { lines: [`uniq: ${file_args[0]}: No such file or directory`] };
	if (!node.content) return { lines: [] };

	const lines = node.content.split('\n').filter(l => l !== '');
	const result: string[] = [];
	let prev = '';
	let cnt = 0;

	for (const line of lines) {
		if (line === prev) {
			cnt++;
		} else {
			if (prev !== '' || cnt > 0) {
				if (count) {
					result.push(`${String(cnt).padStart(7)} ${prev}`);
				} else {
					result.push(prev);
				}
			}
			prev = line;
			cnt = 1;
		}
	}
	if (prev !== '' || cnt > 0) {
		if (count) {
			result.push(`${String(cnt).padStart(7)} ${prev}`);
		} else {
			result.push(prev);
		}
	}

	return { lines: result };
}

function cmd_man(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0) {
		return { lines: ['What manual page do you want?', 'For example, try \'man man\'.'] };
	}

	const manpages: Record<string, string[]> = {
		ls: [
			colorize('LS(1)', 'bold') + '                     General Commands Manual                    ' + colorize('LS(1)', 'bold'),
			'',
			colorize('NAME', 'bold'),
			'     ls -- list directory contents',
			'',
			colorize('SYNOPSIS', 'bold'),
			'     ls [-@ABCFGHILOPRSTUWabcdefghiklmnopqrstuvwxy1%,] [--color=when]',
			'        [-D format] [file ...]',
			'',
			colorize('DESCRIPTION', 'bold'),
			'     For each operand that names a file of a type other than directory, ls',
			'     displays its name as well as any requested, associated information.',
			'',
			'     -a    Include directory entries whose names begin with a dot (.).',
			'     -l    List files in the long format.',
			'     -la   Combination of -l and -a flags.',
			'',
			'     (END)',
		],
		cd: [
			colorize('CD(1)', 'bold') + '                     General Commands Manual                    ' + colorize('CD(1)', 'bold'),
			'',
			colorize('NAME', 'bold'),
			'     cd -- change the working directory',
			'',
			colorize('SYNOPSIS', 'bold'),
			'     cd [directory]',
			'',
			colorize('DESCRIPTION', 'bold'),
			'     Change the current directory to directory. The variable HOME is the',
			'     default directory.',
			'',
			'     cd -   Return to previous directory.',
			'',
			'     (END)',
		],
		grep: [
			colorize('GREP(1)', 'bold') + '                   General Commands Manual                  ' + colorize('GREP(1)', 'bold'),
			'',
			colorize('NAME', 'bold'),
			'     grep -- file pattern searcher',
			'',
			colorize('SYNOPSIS', 'bold'),
			'     grep [-i] [-n] [-r] pattern file ...',
			'',
			colorize('DESCRIPTION', 'bold'),
			'     grep searches for pattern in each file. When a match is found, the',
			'     matching line is printed.',
			'',
			'     -i    Case-insensitive search.',
			'     -n    Show line numbers.',
			'     -r    Recursively search directories.',
			'',
			'     (END)',
		],
		man: [
			colorize('MAN(1)', 'bold') + '                    General Commands Manual                   ' + colorize('MAN(1)', 'bold'),
			'',
			colorize('NAME', 'bold'),
			'     man -- format and display the on-line manual pages',
			'',
			colorize('SYNOPSIS', 'bold'),
			'     man [command]',
			'',
			colorize('DESCRIPTION', 'bold'),
			'     man formats and displays the on-line manual pages.',
			'',
			'     (END)',
		],
	};

	const page = manpages[args[0]];
	if (page) return { lines: page };

	return { lines: [`No manual entry for ${args[0]}`] };
}

function cmd_top(_args: string[], _state: TerminalState): CommandResult {
	const procs = [
		{ pid: 1, name: 'kernel_task', cpu: (Math.random() * 5).toFixed(1), mem: '1024M', user: 'root', state: 'sleeping', threads: 148 },
		{ pid: 127, name: 'WindowServer', cpu: (Math.random() * 15 + 5).toFixed(1), mem: '512M', user: '_windowserver', state: 'running', threads: 21 },
		{ pid: 248, name: 'Safari', cpu: (Math.random() * 20 + 3).toFixed(1), mem: '896M', user: 'user', state: 'running', threads: 34 },
		{ pid: 302, name: 'Terminal', cpu: (Math.random() * 3).toFixed(1), mem: '64M', user: 'user', state: 'running', threads: 8 },
		{ pid: 355, name: 'Finder', cpu: (Math.random() * 5).toFixed(1), mem: '128M', user: 'user', state: 'running', threads: 12 },
		{ pid: 412, name: 'Dock', cpu: (Math.random() * 2).toFixed(1), mem: '48M', user: 'user', state: 'sleeping', threads: 6 },
		{ pid: 489, name: 'Spotlight', cpu: (Math.random() * 8).toFixed(1), mem: '256M', user: 'user', state: 'sleeping', threads: 15 },
		{ pid: 523, name: 'loginwindow', cpu: '0.0', mem: '32M', user: 'root', state: 'sleeping', threads: 4 },
		{ pid: 601, name: 'mds_stores', cpu: (Math.random() * 4).toFixed(1), mem: '96M', user: 'root', state: 'sleeping', threads: 9 },
		{ pid: 678, name: 'coreaudiod', cpu: (Math.random() * 2).toFixed(1), mem: '24M', user: '_coreaudiod', state: 'sleeping', threads: 7 },
		{ pid: 712, name: 'SystemUIServer', cpu: (Math.random() * 1.5).toFixed(1), mem: '36M', user: 'user', state: 'sleeping', threads: 5 },
		{ pid: 845, name: 'Activity Monitor', cpu: (Math.random() * 6 + 1).toFixed(1), mem: '78M', user: 'user', state: 'running', threads: 11 },
	];

	const running_count = procs.filter(p => p.state === 'running').length;
	const sleeping_count = procs.length - running_count;
	const total_cpu = procs.reduce((s, p) => s + parseFloat(p.cpu), 0);
	const total_threads = procs.reduce((s, p) => s + p.threads, 0);
	const d = new Date();
	const time = d.toTimeString().split(' ')[0].slice(0, 5);

	const lines = [
		colorize(`Processes: ${procs.length} total, ${running_count} running, ${sleeping_count} sleeping, ${total_threads} threads`, 'bold'),
		`${time}  Load Avg: ${(Math.random() * 3 + 1).toFixed(2)}, ${(Math.random() * 2 + 0.5).toFixed(2)}, ${(Math.random() * 1.5 + 0.3).toFixed(2)}`,
		`CPU usage: ${total_cpu.toFixed(1)}% user, ${(Math.random() * 5).toFixed(1)}% sys, ${Math.max(0, 100 - total_cpu - 5).toFixed(1)}% idle`,
		`SharedLibs: 284M resident, 62M data, 24M linkedit.`,
		`MemRegions: 98124 total, 6144M resident, 142M private, 2048M shared.`,
		`PhysMem: 12G used (4096M wired), 4096M unused.`,
		`VM: 248G vsize, 3584M framework vsize, 0(0) swapins, 0(0) swapouts.`,
		`Networks: packets: 1284567/1024M in, 987654/512M out.`,
		`Disks: 2456789/48G read, 1234567/24G written.`,
		'',
		colorize('PID    COMMAND          %CPU  MEM     USER            STATE       #TH', 'bold'),
		...procs
			.sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu))
			.map(p =>
				`${String(p.pid).padStart(5)}  ${p.name.padEnd(17)}${p.cpu.padStart(5)}  ${p.mem.padStart(6)}  ${p.user.padEnd(16)}${p.state.padEnd(12)}${String(p.threads).padStart(3)}`
			),
		'',
		colorize('(simulated output - press q to exit)', 'dim'),
	];
	return { lines };
}

function cmd_curl(args: string[], _state: TerminalState): CommandResult {
	const url = args.find(a => !a.startsWith('-')) || '';
	if (!url) {
		return { lines: ['curl: try \'curl --help\' for more information'] };
	}

	const verbose = args.includes('-v') || args.includes('--verbose');
	const head_only = args.includes('-I') || args.includes('--head');
	const lines: string[] = [];
	const hostname = url.replace(/https?:\/\//, '').split('/')[0];

	if (verbose || head_only) {
		if (verbose) {
			lines.push(colorize(`*   Trying 93.184.216.34:443...`, 'dim'));
			lines.push(colorize(`* Connected to ${hostname} (93.184.216.34) port 443 (#0)`, 'dim'));
			lines.push(colorize(`* ALPN: offers h2,http/1.1`, 'dim'));
			lines.push(colorize(`* TLSv1.3 (OUT), TLS handshake`, 'dim'));
			lines.push(colorize(`> GET / HTTP/2`, 'dim'));
			lines.push(colorize(`> Host: ${hostname}`, 'dim'));
			lines.push(colorize(`> User-Agent: curl/8.4.0`, 'dim'));
			lines.push(colorize(`> Accept: */*`, 'dim'));
			lines.push(colorize(`>`, 'dim'));
		}
		lines.push(`HTTP/2 200`);
		lines.push(`content-type: text/html; charset=UTF-8`);
		lines.push(`date: ${new Date().toUTCString()}`);
		lines.push(`server: nginx/1.24.0`);
		lines.push(`content-length: 1256`);
		lines.push('');
		if (head_only) return { lines };
	}

	lines.push('<!DOCTYPE html>');
	lines.push('<html>');
	lines.push('<head><title>Example</title></head>');
	lines.push('<body>');
	lines.push('<h1>Hello from the simulated internet!</h1>');
	lines.push('<p>This is a simulated curl response.</p>');
	lines.push('</body>');
	lines.push('</html>');

	return { lines };
}

function cmd_python3(args: string[], _state: TerminalState): CommandResult {
	if (args.includes('--version') || args.includes('-V')) {
		return { lines: ['Python 3.12.1'] };
	}
	if (args.includes('-c') && args.length > 1) {
		const code = args.slice(args.indexOf('-c') + 1).join(' ').replace(/^["']|["']$/g, '');
		if (code.includes('print')) {
			const match = code.match(/print\(["'](.*)["']\)/);
			if (match) return { lines: [match[1]] };
			const math_match = code.match(/print\((.+)\)/);
			if (math_match) {
				try {
					const result = Function('"use strict"; return (' + math_match[1] + ')')();
					return { lines: [String(result)] };
				} catch {
					return { lines: [`NameError: name '${math_match[1]}' is not defined`] };
				}
			}
		}
		return { lines: [] };
	}
	return { lines: [
		`Python 3.12.1 (main, Dec  7 2023, 20:45:44) [Clang 15.0.0 (clang-1500.1.0.2.5)] on darwin`,
		`Type "help", "copyright", "credits" or "license" for more information.`,
		colorize('(simulated - interactive mode not available)', 'dim'),
	] };
}

function cmd_node(args: string[], _state: TerminalState): CommandResult {
	if (args.includes('--version') || args.includes('-v')) {
		return { lines: ['v21.5.0'] };
	}
	if (args.includes('-e') && args.length > 1) {
		const code = args.slice(args.indexOf('-e') + 1).join(' ').replace(/^["']|["']$/g, '');
		if (code.includes('console.log')) {
			const match = code.match(/console\.log\(["'](.*)["']\)/);
			if (match) return { lines: [match[1]] };
			const expr_match = code.match(/console\.log\((.+)\)/);
			if (expr_match) {
				try {
					const result = Function('"use strict"; return (' + expr_match[1] + ')')();
					return { lines: [String(result)] };
				} catch {
					return { lines: [`ReferenceError: ${expr_match[1]} is not defined`] };
				}
			}
		}
		return { lines: [] };
	}
	return { lines: [
		'Welcome to Node.js v21.5.0.',
		'Type ".help" for more information.',
		colorize('(simulated - interactive mode not available)', 'dim'),
	] };
}

function cmd_brew(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0 || args[0] === '--version') {
		return { lines: ['Homebrew 4.2.4'] };
	}
	if (args[0] === 'install') {
		if (args.length < 2) return { lines: ['Error: This command requires a formula argument.'] };
		const pkg = args[1];
		return { lines: [
			colorize(`==>`, 'blue') + colorize(` Downloading ${pkg}...`, 'bold'),
			colorize(`==>`, 'blue') + colorize(` Installing ${pkg}`, 'bold'),
			colorize(`==>`, 'blue') + ` Pouring ${pkg}--1.0.0.arm64_sonoma.bottle.tar.gz`,
			`/usr/local/Cellar/${pkg}/1.0.0: 42 files, 2.1MB`,
		] };
	}
	if (args[0] === 'list') {
		return { lines: ['git', 'node', 'python@3.12', 'wget', 'tree', 'jq', 'ripgrep'] };
	}
	if (args[0] === 'update') {
		return { lines: [
			colorize('==> Updating Homebrew...', 'blue'),
			'Already up-to-date.',
		] };
	}
	if (args[0] === 'info') {
		const pkg = args[1] || 'homebrew';
		return { lines: [
			colorize(`${pkg}: stable 1.0.0`, 'bold'),
			'https://formulae.brew.sh/',
			'Not installed',
			'From: https://github.com/Homebrew/homebrew-core/blob/HEAD/Formula/' + pkg + '.rb',
		] };
	}
	return { lines: [`Error: Unknown command: ${args[0]}`] };
}

function cmd_git(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0 || args[0] === '--version') {
		return { lines: ['git version 2.43.0'] };
	}
	if (args[0] === 'add') {
		return { lines: [] };
	}
	if (args[0] === 'commit') {
		const m_idx = args.indexOf('-m');
		const am_idx = args.indexOf('-am');
		const msg = (m_idx >= 0 ? args.slice(m_idx + 1) : am_idx >= 0 ? args.slice(am_idx + 1) : []).join(' ').replace(/^['"]|['"]$/g, '') || 'commit';
		const sha = Math.random().toString(16).slice(2, 9);
		return { lines: [
			`[main ${sha}] ${msg}`,
			` 1 file changed, 1 insertion(+)`,
		] };
	}
	if (args[0] === 'push') {
		const remote = args[1] || 'origin';
		const branch = args[2] || 'main';
		return { lines: [
			`Enumerating objects: 5, done.`,
			`Counting objects: 100% (5/5), done.`,
			`Delta compression using up to 8 threads`,
			`Compressing objects: 100% (3/3), done.`,
			`Writing objects: 100% (3/3), 412 bytes | 412.00 KiB/s, done.`,
			`Total 3 (delta 2), reused 0 (delta 0), pack-reused 0`,
			`To github.com:acme/api.git`,
			`   a1b2c3d..e4f5g6h  ${branch} -> ${branch}`,
		] };
	}
	if (args[0] === 'pull') {
		return { lines: [
			'Already up to date.',
		] };
	}
	if (args[0] === 'fetch') {
		return { lines: [
			'From github.com:acme/api',
			' * [new branch]      main       -> origin/main',
		] };
	}
	if (args[0] === 'checkout') {
		const target = args.slice(1).filter(a => !a.startsWith('-')).join(' ') || 'main';
		return { lines: [
			`Switched to branch '${target}'`,
		] };
	}
	if (args[0] === 'clone') {
		const repo = args[1] || 'repo';
		const name = repo.split('/').pop()?.replace(/\.git$/, '') || 'repo';
		return { lines: [
			`Cloning into '${name}'...`,
			`remote: Enumerating objects: 142, done.`,
			`remote: Counting objects: 100% (142/142), done.`,
			`Receiving objects: 100% (142/142), 28.41 KiB | 5.68 MiB/s, done.`,
			`Resolving deltas: 100% (75/75), done.`,
		] };
	}
	if (args[0] === 'status') {
		return { lines: [
			'On branch main',
			'Your branch is up to date with \'origin/main\'.',
			'',
			'nothing to commit, working tree clean',
		] };
	}
	if (args[0] === 'log') {
		const oneline = args.includes('--oneline');
		if (oneline) {
			return { lines: [
				colorize('a1b2c3d', 'yellow') + ' (HEAD -> main, origin/main) Initial commit',
				colorize('e4f5g6h', 'yellow') + ' Add project structure',
				colorize('i7j8k9l', 'yellow') + ' Update README',
			] };
		}
		return { lines: [
			colorize('commit a1b2c3d4e5f6g7h8i9j0 (HEAD -> main, origin/main)', 'yellow'),
			'Author: User <user@example.com>',
			'Date:   Mon Dec 15 10:30:00 2024 -0800',
			'',
			'    Initial commit',
			'',
			colorize('commit e4f5g6h7i8j9k0l1m2n3', 'yellow'),
			'Author: User <user@example.com>',
			'Date:   Sun Dec 14 15:22:00 2024 -0800',
			'',
			'    Add project structure',
			'',
		] };
	}
	if (args[0] === 'branch') {
		if (args.includes('-a')) {
			return { lines: [
				'* ' + colorize('main', 'green'),
				'  develop',
				'  feature/new-ui',
				'  ' + colorize('remotes/origin/main', 'red'),
				'  ' + colorize('remotes/origin/develop', 'red'),
			] };
		}
		return { lines: [
			'* ' + colorize('main', 'green'),
			'  develop',
			'  feature/new-ui',
		] };
	}
	if (args[0] === 'remote') {
		if (args.includes('-v')) {
			return { lines: [
				'origin\thttps://github.com/user/repo.git (fetch)',
				'origin\thttps://github.com/user/repo.git (push)',
			] };
		}
		return { lines: ['origin'] };
	}
	if (args[0] === 'diff') {
		return { lines: [] };
	}
	if (args[0] === 'init') {
		return { lines: ['Initialized empty Git repository in /Users/user/.git/'] };
	}
	return { lines: [`git: '${args[0]}' is not a git command. See 'git --help'.`] };
}

function cmd_ssh(_args: string[], _state: TerminalState): CommandResult {
	return { lines: [
		'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface]',
		'           [-b bind_address] [-c cipher_spec] [-D [bind_address:]port]',
		'           [-E log_file] [-e escape_char] [-F configfile] [-I pkcs11]',
		'           [-i identity_file] [-J [user@]host[:port]] [-L address]',
		'           [-l login_name] [-m mac_spec] [-O ctl_cmd] [-o option] [-p port]',
		'           [-Q query_option] [-R address] [-S ctl_path] [-W host:port]',
		'           [-w local_tun[:remote_tun]] destination [command [argument ...]]',
	] };
}

function cmd_neofetch(_args: string[], _state: TerminalState): CommandResult {
	return { lines: [
		'                    \'c.          ' + colorize('user', 'green') + '@' + colorize('macbook', 'green'),
		'                 ,xNMM.          -----------',
		'               .OMMMMo           ' + colorize('OS:', 'bold') + ' macOS Sonoma 14.2.1 arm64',
		'               OMMM0,            ' + colorize('Host:', 'bold') + ' MacBook Pro (Apple M1 Pro)',
		'     .;loddo:\' loolloddol;.     ' + colorize('Kernel:', 'bold') + ' 23.2.0',
		'   cKMMMMMMMMMMNWMMMMMMMMMM0:    ' + colorize('Uptime:', 'bold') + ' 3 days, 14 hours',
		'  .KMMMMMMMMMMMMMMMMMMMMMMMWd.   ' + colorize('Packages:', 'bold') + ' 127 (brew)',
		'  XMMMMMMMMMMMMMMMMMMMMMMMX.     ' + colorize('Shell:', 'bold') + ' zsh 5.9',
		' ;MMMMMMMMMMMMMMMMMMMMMMMM:      ' + colorize('Resolution:', 'bold') + ' 3456x2234',
		' :MMMMMMMMMMMMMMMMMMMMMMMM:      ' + colorize('DE:', 'bold') + ' Aqua',
		' .MMMMMMMMMMMMMMMMMMMMMMMMX.     ' + colorize('WM:', 'bold') + ' Quartz Compositor',
		'  kMMMMMMMMMMMMMMMMMMMMMMMMWd.    ' + colorize('Terminal:', 'bold') + ' macOS-web',
		'  .XMMMMMMMMMMMMMMMMMMMMMMMMk    ' + colorize('CPU:', 'bold') + ' Apple M1 Pro (10) @ 3.22GHz',
		'   .XMMMMMMMMMMMMMMMMMMMMK.      ' + colorize('GPU:', 'bold') + ' Apple M1 Pro',
		'     kMMMMMMMMMMMMMMMMMMd         ' + colorize('Memory:', 'bold') + ' 8192MiB / 16384MiB',
		'      ;KMMMMMMMWXXWMMMKl.        ',
		'        .cooc,.    .,coo:.        ',
		'',
	] };
}

function cmd_tree(args: string[], state: TerminalState): CommandResult {
	const show_all = args.includes('-a');
	const dirs_only = args.includes('-d');
	const target = args.find(a => !a.startsWith('-')) || '.';
	const path = target === '.' ? state.cwd : target;
	const { node } = resolve_path(vfs_root, state.cwd, path);

	if (!node || node.type !== 'dir' || !node.children) {
		return { lines: [`${path} [error opening dir]`] };
	}

	const lines: string[] = [colorize(target === '.' ? '.' : node.name, 'blue')];
	let dir_count = 0;
	let file_count = 0;

	function walk(dir_node: FSNode, prefix: string) {
		if (!dir_node.children) return;

		let entries = Array.from(dir_node.children.values());
		if (!show_all) {
			entries = entries.filter(e => !e.name.startsWith('.'));
		}
		if (dirs_only) {
			entries = entries.filter(e => e.type === 'dir');
		}
		entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

		entries.forEach((entry, i) => {
			const is_last = i === entries.length - 1;
			const connector = is_last ? '\u2514\u2500\u2500 ' : '\u251c\u2500\u2500 ';
			const child_prefix = prefix + (is_last ? '    ' : '\u2502   ');

			if (entry.type === 'dir') {
				dir_count++;
				lines.push(prefix + connector + colorize(entry.name, 'blue'));
				walk(entry, child_prefix);
			} else {
				file_count++;
				lines.push(prefix + connector + entry.name);
			}
		});
	}

	walk(node, '');

	lines.push('');
	lines.push(`${dir_count} director${dir_count === 1 ? 'y' : 'ies'}, ${file_count} file${file_count === 1 ? '' : 's'}`);
	return { lines };
}

function cmd_env(_args: string[], state: TerminalState): CommandResult {
	const env_vars: Record<string, string> = {
		HOME: '/Users/user',
		USER: 'user',
		SHELL: '/bin/zsh',
		PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
		TERM: 'xterm-256color',
		LANG: 'en_US.UTF-8',
		EDITOR: 'vim',
		PWD: state.cwd,
		LOGNAME: 'user',
		TMPDIR: '/var/folders/xx/tmp/',
		...state.env,
	};

	return { lines: Object.entries(env_vars).map(([k, v]) => `${k}=${v}`) };
}

function cmd_export(args: string[], state: TerminalState): CommandResult {
	if (args.length === 0) return cmd_env([], state);

	for (const arg of args) {
		const eq = arg.indexOf('=');
		if (eq > 0) {
			const key = arg.slice(0, eq);
			const value = arg.slice(eq + 1).replace(/^["']|["']$/g, '');
			state.env[key] = value;
		}
	}
	return { lines: [] };
}

function cmd_alias(_args: string[], _state: TerminalState): CommandResult {
	return { lines: [
		'alias ll=\'ls -la\'',
		'alias gs=\'git status\'',
		'alias gp=\'git push\'',
		'alias ..=\'cd ..\'',
		'alias ...=\'cd ../..\'',
	] };
}

function cmd_du(args: string[], state: TerminalState): CommandResult {
	const human = args.includes('-h') || args.includes('-sh');
	const target = args.find(a => !a.startsWith('-')) || '.';
	const { node } = resolve_path(vfs_root, state.cwd, target);

	if (!node) return { lines: [`du: ${target}: No such file or directory`] };

	const size = node.size || 4096;
	const display = human ? format_size(size) : String(Math.ceil(size / 512));
	return { lines: [`${display.padStart(6)}\t${target === '.' ? '.' : node.name}`] };
}

function cmd_df(_args: string[], _state: TerminalState): CommandResult {
	return { lines: [
		'Filesystem     512-blocks      Used Available Capacity iused ifree %iused  Mounted on',
		'/dev/disk3s1   965595304 186453280 762735192    20%  632145 4293335134    0%   /',
		'devfs                399       399         0   100%     692        0  100%   /dev',
		'/dev/disk3s6   965595304    131128 762735192     1%       3 4293967293    0%   /System/Volumes/VM',
		'/dev/disk3s4   965595304  12845032 762735192     2%     412 4293966884    0%   /System/Volumes/Preboot',
		'map auto_home          0         0         0   100%       0        0  100%   /System/Volumes/Data/home',
	] };
}

function cmd_ping(args: string[], _state: TerminalState): CommandResult {
	const host = args.find(a => !a.startsWith('-')) || '';
	if (!host) return { lines: ['usage: ping [-AaDdfnoQqRrv] [-c count] [-G sweepmaxsize] host'] };

	const lines: string[] = [];
	lines.push(`PING ${host} (93.184.216.34): 56 data bytes`);
	for (let i = 0; i < 4; i++) {
		const time = (Math.random() * 30 + 10).toFixed(3);
		lines.push(`64 bytes from 93.184.216.34: icmp_seq=${i} ttl=56 time=${time} ms`);
	}
	lines.push('');
	lines.push(`--- ${host} ping statistics ---`);
	lines.push('4 packets transmitted, 4 packets received, 0.0% packet loss');
	lines.push('round-trip min/avg/max/stddev = 10.123/20.456/30.789/5.432 ms');
	return { lines };
}

function cmd_ifconfig(_args: string[], _state: TerminalState): CommandResult {
	return { lines: [
		colorize('en0:', 'bold') + ' flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500',
		'\toptions=6463<RXCSUM,TXCSUM,TSO4,TSO6,CHANNEL_IO,PARTIAL_CSUM,ZEROINVERT_CSUM>',
		'\tether a4:83:e7:12:34:56',
		'\tinet6 fe80::1c8f:8e2b:42a1:f3e7%en0 prefixlen 64 secured scopeid 0x6',
		'\tinet 192.168.1.42 netmask 0xffffff00 broadcast 192.168.1.255',
		'\tnd6 options=201<PERFORMNUD,DAD>',
		'\tmedia: autoselect',
		'\tstatus: active',
		'',
		colorize('lo0:', 'bold') + ' flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384',
		'\toptions=1203<RXCSUM,TXCSUM,TXSTATUS,SW_TIMESTAMP>',
		'\tinet 127.0.0.1 netmask 0xff000000',
		'\tinet6 ::1 prefixlen 128',
		'\tinet6 fe80::1%lo0 prefixlen 64 scopeid 0x1',
		'\tnd6 options=201<PERFORMNUD,DAD>',
	] };
}

function cmd_cp(args: string[], state: TerminalState): CommandResult {
	const non_flag = args.filter(a => !a.startsWith('-'));
	if (non_flag.length < 2) return { lines: ['usage: cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file target_file'] };

	const src_path = non_flag[0];
	const dst_path = non_flag[1];
	const { node: src } = resolve_path(vfs_root, state.cwd, src_path);
	if (!src) return { lines: [`cp: ${src_path}: No such file or directory`] };
	if (src.type === 'dir') return { lines: [`cp: ${src_path}: is a directory (not copied)`] };

	const dst_abs = resolve_path(vfs_root, state.cwd, dst_path).absolute_path;
	const { parent } = get_parent_dir(vfs_root, dst_abs);
	if (!parent || !parent.children) return { lines: [`cp: ${dst_path}: No such file or directory`] };

	const name = dst_abs.split('/').filter(Boolean).pop()!;
	parent.children.set(name, { ...src, name });
	return { lines: [] };
}

function cmd_mv(args: string[], state: TerminalState): CommandResult {
	const non_flag = args.filter(a => !a.startsWith('-'));
	if (non_flag.length < 2) return { lines: ['usage: mv [-f | -i | -n] [-hv] source target'] };

	const src_path = non_flag[0];
	const dst_path = non_flag[1];
	const src_abs = resolve_path(vfs_root, state.cwd, src_path).absolute_path;
	const { node: src } = resolve_path(vfs_root, state.cwd, src_path);
	if (!src) return { lines: [`mv: rename ${src_path} to ${dst_path}: No such file or directory`] };

	const dst_abs = resolve_path(vfs_root, state.cwd, dst_path).absolute_path;
	const { parent: dst_parent } = get_parent_dir(vfs_root, dst_abs);
	if (!dst_parent || !dst_parent.children) return { lines: [`mv: rename ${src_path} to ${dst_path}: No such file or directory`] };

	const { parent: src_parent } = get_parent_dir(vfs_root, src_abs);
	if (src_parent && src_parent.children) {
		src_parent.children.delete(src.name);
	}

	const name = dst_abs.split('/').filter(Boolean).pop()!;
	dst_parent.children.set(name, { ...src, name });
	return { lines: [] };
}

function cmd_chmod(args: string[], state: TerminalState): CommandResult {
	if (args.length < 2) return { lines: ['usage: chmod [-fhv] [-R [-H | -L | -P]] mode file ...'] };
	const mode = args[0];
	const file_args = args.slice(1);
	for (const fp of file_args) {
		const { node } = resolve_path(vfs_root, state.cwd, fp);
		if (!node) return { lines: [`chmod: ${fp}: No such file or directory`] };
		// Parse octal mode and apply
		const octal = parseInt(mode, 8);
		if (!isNaN(octal)) {
			const perms = [
				node.type === 'dir' ? 'd' : '-',
				(octal & 0o400) ? 'r' : '-',
				(octal & 0o200) ? 'w' : '-',
				(octal & 0o100) ? 'x' : '-',
				(octal & 0o040) ? 'r' : '-',
				(octal & 0o020) ? 'w' : '-',
				(octal & 0o010) ? 'x' : '-',
				(octal & 0o004) ? 'r' : '-',
				(octal & 0o002) ? 'w' : '-',
				(octal & 0o001) ? 'x' : '-',
			].join('');
			node.permissions = perms;
		}
	}
	return { lines: [] };
}

function cmd_ln(args: string[], state: TerminalState): CommandResult {
	const symbolic = args.includes('-s');
	const non_flag = args.filter(a => !a.startsWith('-'));
	if (non_flag.length < 2) return { lines: ['usage: ln [-Ffhinsv] source_file [target_file]'] };

	const target_name = non_flag[0];
	const link_path = non_flag[1];
	const link_abs = resolve_path(vfs_root, state.cwd, link_path).absolute_path;
	const { parent } = get_parent_dir(vfs_root, link_abs);

	if (!parent || !parent.children) return { lines: [`ln: ${link_path}: No such file or directory`] };

	const name = link_abs.split('/').filter(Boolean).pop()!;
	if (symbolic) {
		parent.children.set(name, {
			type: 'symlink',
			name,
			permissions: 'lrwxr-xr-x',
			owner: 'user',
			group: 'staff',
			size: target_name.length,
			modified: new Date(),
			target: target_name,
		});
	} else {
		const { node: target } = resolve_path(vfs_root, state.cwd, target_name);
		if (!target) return { lines: [`ln: ${target_name}: No such file or directory`] };
		parent.children.set(name, { ...target, name });
	}
	return { lines: [] };
}

function cmd_diff(args: string[], state: TerminalState): CommandResult {
	const file_args = args.filter(a => !a.startsWith('-'));
	if (file_args.length < 2) return { lines: ['usage: diff [-aBbdipTtw] [-c | -e | -f | -n | -q | -u] file1 file2'] };

	const { node: n1 } = resolve_path(vfs_root, state.cwd, file_args[0]);
	const { node: n2 } = resolve_path(vfs_root, state.cwd, file_args[1]);

	if (!n1) return { lines: [`diff: ${file_args[0]}: No such file or directory`] };
	if (!n2) return { lines: [`diff: ${file_args[1]}: No such file or directory`] };
	if (n1.type === 'dir') return { lines: [`diff: ${file_args[0]}: Is a directory`] };
	if (n2.type === 'dir') return { lines: [`diff: ${file_args[1]}: Is a directory`] };

	const c1 = n1.content || '';
	const c2 = n2.content || '';

	if (c1 === c2) return { lines: [] };

	// Simple unified diff
	const lines1 = c1.split('\n');
	const lines2 = c2.split('\n');
	const result: string[] = [
		`--- ${file_args[0]}`,
		`+++ ${file_args[1]}`,
		`@@ -1,${lines1.length} +1,${lines2.length} @@`,
	];

	for (const l of lines1) {
		result.push(colorize(`-${l}`, 'red'));
	}
	for (const l of lines2) {
		result.push(colorize(`+${l}`, 'green'));
	}

	return { lines: result };
}

function cmd_xargs(args: string[], _state: TerminalState): CommandResult {
	// Basic xargs: just show what it would do
	if (args.length === 0) return { lines: ['usage: xargs [-0opt] [-E eofstr] [-I replstr [-R replacements]]'] };
	return { lines: [colorize('(simulated - xargs requires piped input)', 'dim')] };
}

function cmd_tee(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0) return { lines: ['usage: tee [-ai] [file ...]'] };
	return { lines: [colorize('(simulated - tee requires piped input)', 'dim')] };
}

function cmd_basename(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0) return { lines: ['usage: basename string [suffix]'] };
	const path = args[0];
	let result = path.split('/').filter(Boolean).pop() || path;
	if (args[1] && result.endsWith(args[1])) {
		result = result.slice(0, -args[1].length);
	}
	return { lines: [result] };
}

function cmd_dirname(args: string[], _state: TerminalState): CommandResult {
	if (args.length === 0) return { lines: ['usage: dirname path'] };
	const path = args[0];
	const parts = path.split('/');
	parts.pop();
	return { lines: [parts.join('/') || '.'] };
}

function cmd_readlink(args: string[], state: TerminalState): CommandResult {
	const file_args = args.filter(a => !a.startsWith('-'));
	if (file_args.length === 0) return { lines: ['usage: readlink [-fn] [file ...]'] };
	const { node } = resolve_path(vfs_root, state.cwd, file_args[0]);
	if (!node) return { lines: [`readlink: ${file_args[0]}: No such file or directory`] };
	if (node.type === 'symlink' && node.target) return { lines: [node.target] };
	return { lines: [] };
}

function cmd_file(args: string[], state: TerminalState): CommandResult {
	if (args.length === 0) return { lines: ['usage: file [-bcdEhikLNnprsSvzZ0] [--apple] [--mime-encoding]', '            [--mime-type] [-e testname] [-F separator] [-f namefile]', '            [-m magicfiles] file ...'] };

	const results: string[] = [];
	for (const fp of args) {
		const { node } = resolve_path(vfs_root, state.cwd, fp);
		if (!node) { results.push(`${fp}: cannot open (No such file or directory)`); continue; }
		if (node.type === 'dir') { results.push(`${fp}: directory`); continue; }
		if (node.type === 'symlink') { results.push(`${fp}: symbolic link to ${node.target}`); continue; }
		const ext = node.name.split('.').pop()?.toLowerCase();
		if (ext === 'txt' || ext === 'md' || ext === 'log') {
			results.push(`${fp}: ASCII text`);
		} else if (ext === 'pdf') {
			results.push(`${fp}: PDF document, version 1.7`);
		} else if (ext === 'jpg' || ext === 'jpeg') {
			results.push(`${fp}: JPEG image data`);
		} else if (ext === 'png') {
			results.push(`${fp}: PNG image data`);
		} else if (ext === 'zip') {
			results.push(`${fp}: Zip archive data`);
		} else if (ext === 'dmg') {
			results.push(`${fp}: zlib compressed data`);
		} else if (ext === 'xlsx') {
			results.push(`${fp}: Microsoft Excel 2007+`);
		} else if (ext === 'gz' || ext === 'tar') {
			results.push(`${fp}: gzip compressed data`);
		} else if (node.content) {
			results.push(`${fp}: ASCII text`);
		} else {
			results.push(`${fp}: data`);
		}
	}
	return { lines: results };
}

function cmd_cal(_args: string[], _state: TerminalState): CommandResult {
	const d = new Date();
	const month = d.getMonth();
	const year = d.getFullYear();
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	const header = `    ${months[month]} ${year}`;
	const days_header = 'Su Mo Tu We Th Fr Sa';

	const first_day = new Date(year, month, 1).getDay();
	const days_in_month = new Date(year, month + 1, 0).getDate();
	const today = d.getDate();

	const weeks: string[] = [];
	let week = '   '.repeat(first_day);

	for (let day = 1; day <= days_in_month; day++) {
		const day_str = String(day).padStart(2, ' ');
		if (day === today) {
			week += colorize(day_str, 'bold') + ' ';
		} else {
			week += day_str + ' ';
		}
		if ((first_day + day) % 7 === 0 || day === days_in_month) {
			weeks.push(week.trimEnd());
			week = '';
		}
	}

	return { lines: [header, days_header, ...weeks] };
}

function cmd_pytest(args: string[], _state: TerminalState): CommandResult {
	const quiet = args.includes('-q') || args.includes('--quiet');
	const verbose = args.includes('-v') || args.includes('--verbose');
	const k_idx = args.indexOf('-k');
	const filter = k_idx >= 0 ? args[k_idx + 1] : '';
	const lines: string[] = [];
	const ran = Math.floor(Math.random() * 8) + 4;
	const passed = ran - Math.floor(Math.random() * 2);
	const failed = ran - passed;
	const elapsed = (Math.random() * 2 + 0.4).toFixed(2);

	if (!quiet) {
		lines.push('============================= test session starts ==============================');
		lines.push('platform darwin -- Python 3.12.1, pytest-7.4.4, pluggy-1.3.0');
		lines.push(`rootdir: ${'/Users/user/repo'}`);
		if (filter) lines.push(`pytest -k ${filter}`);
		lines.push(`collected ${ran} items`);
		lines.push('');
	}
	for (let i = 0; i < ran; i++) {
		const ok = i < passed;
		if (verbose) {
			lines.push(`tests/test_unit.py::test_case_${i} ${ok ? colorize('PASSED', 'green') : colorize('FAILED', 'red')}`);
		} else {
			lines.push(`tests/test_unit.py ${ok ? colorize('.', 'green') : colorize('F', 'red')}`);
		}
	}
	lines.push('');
	if (failed === 0) {
		lines.push(colorize(`============================== ${ran} passed in ${elapsed}s ==============================`, 'green'));
	} else {
		lines.push(colorize(`========================= ${failed} failed, ${passed} passed in ${elapsed}s =========================`, 'red'));
	}
	return { lines };
}

function cmd_npm(args: string[], _state: TerminalState): CommandResult {
	if (args[0] === '--version' || args[0] === '-v') return { lines: ['10.2.5'] };
	if (args[0] === 'install' || args[0] === 'i') {
		const pkg = args[1] || '<all>';
		return { lines: [
			`added 142 packages, and audited 143 packages in 1s`,
			``,
			`28 packages are looking for funding`,
			`  run \`npm fund\` for details`,
			`found 0 vulnerabilities`,
		] };
	}
	if (args[0] === 'run') {
		const script = args[1] || 'start';
		return { lines: [
			`> ${script}`,
			`> echo "running ${script}"`,
			``,
			`running ${script}`,
		] };
	}
	if (args[0] === 'test') {
		return cmd_pytest(['-q'], _state); // close enough
	}
	if (args[0] === 'build') {
		return { lines: [
			`> build`,
			`> vite build`,
			``,
			colorize(`vite v5.4.10 building for production...`, 'cyan'),
			`✓ 42 modules transformed.`,
			`dist/index.html                  0.62 kB`,
			`dist/assets/index-abc123.css     8.10 kB`,
			`dist/assets/index-abc123.js     142.78 kB`,
			`✓ built in 1.42s`,
		] };
	}
	return { lines: ['Usage: npm <command>', '', 'npm install', 'npm run <script>', 'npm test', 'npm build'] };
}

function cmd_pnpm(args: string[], state: TerminalState): CommandResult {
	if (args[0] === '--version' || args[0] === '-v') return { lines: ['8.15.1'] };
	return cmd_npm(args, state);
}

function cmd_make(args: string[], _state: TerminalState): CommandResult {
	const target = args[0] || 'all';
	return { lines: [
		`make[1]: Entering directory '/Users/user/repo'`,
		`gcc -Wall -O2 -c main.c -o main.o`,
		`gcc -Wall -O2 main.o -o ${target}`,
		`make[1]: Leaving directory '/Users/user/repo'`,
	] };
}

function cmd_help(_args: string[], _state: TerminalState): CommandResult {
	const cmds = [
		['ls', 'List directory contents'],
		['cd', 'Change directory'],
		['pwd', 'Print working directory'],
		['cat', 'Display file contents'],
		['echo', 'Display a line of text'],
		['grep', 'Search file contents'],
		['find', 'Find files by name or type'],
		['sort', 'Sort lines of text'],
		['uniq', 'Remove duplicate lines'],
		['mkdir', 'Create directories'],
		['touch', 'Create files / update timestamps'],
		['rm', 'Remove files or directories'],
		['cp', 'Copy files'],
		['mv', 'Move/rename files'],
		['ln', 'Create links'],
		['head', 'Display first lines of a file'],
		['tail', 'Display last lines of a file'],
		['wc', 'Word, line, character count'],
		['diff', 'Compare files'],
		['file', 'Determine file type'],
		['tree', 'Display directory tree'],
		['clear', 'Clear terminal screen'],
		['history', 'Show command history'],
		['man', 'Display manual pages'],
		['top', 'Display running processes'],
		['cal', 'Display a calendar'],
		['date', 'Show current date/time'],
		['uptime', 'Show system uptime'],
		['whoami', 'Print current user'],
		['hostname', 'Print hostname'],
		['uname', 'Print system information'],
		['which', 'Locate a command'],
		['env', 'Print environment variables'],
		['export', 'Set environment variables'],
		['alias', 'Show command aliases'],
		['curl', 'Transfer data from URL'],
		['ping', 'Test network connectivity'],
		['ifconfig', 'Network interface info'],
		['git', 'Version control system'],
		['python3', 'Python interpreter'],
		['node', 'Node.js runtime'],
		['brew', 'Homebrew package manager'],
		['neofetch', 'System information'],
		['df', 'Disk space usage'],
		['du', 'Directory space usage'],
		['ssh', 'Secure shell client'],
		['chmod', 'Change file permissions'],
		['basename', 'Return filename portion'],
		['dirname', 'Return directory portion'],
	];

	const lines = [
		colorize('Available Commands:', 'bold'),
		'',
	];

	for (const [cmd, desc] of cmds) {
		lines.push(`  ${colorize(cmd.padEnd(12), 'cyan')} ${desc}`);
	}

	lines.push('');
	lines.push(colorize('Use "man <command>" for more details on a specific command.', 'dim'));
	return { lines };
}

export const COMMANDS: Record<string, CommandFn> = {
	ls: cmd_ls,
	cd: cmd_cd,
	pwd: cmd_pwd,
	cat: cmd_cat,
	echo: cmd_echo,
	printf: cmd_printf,
	mkdir: cmd_mkdir,
	touch: cmd_touch,
	rm: cmd_rm,
	grep: cmd_grep,
	find: cmd_find,
	sort: cmd_sort,
	uniq: cmd_uniq,
	clear: cmd_clear,
	history: cmd_history,
	whoami: cmd_whoami,
	hostname: cmd_hostname,
	uname: cmd_uname,
	date: cmd_date,
	uptime: cmd_uptime,
	which: cmd_which,
	head: cmd_head,
	tail: cmd_tail,
	wc: cmd_wc,
	man: cmd_man,
	top: cmd_top,
	curl: cmd_curl,
	python3: cmd_python3,
	python: cmd_python3,
	node: cmd_node,
	brew: cmd_brew,
	git: cmd_git,
	ssh: cmd_ssh,
	neofetch: cmd_neofetch,
	tree: cmd_tree,
	env: cmd_env,
	export: cmd_export,
	alias: cmd_alias,
	du: cmd_du,
	df: cmd_df,
	ping: cmd_ping,
	ifconfig: cmd_ifconfig,
	cp: cmd_cp,
	mv: cmd_mv,
	chmod: cmd_chmod,
	ln: cmd_ln,
	diff: cmd_diff,
	xargs: cmd_xargs,
	tee: cmd_tee,
	basename: cmd_basename,
	dirname: cmd_dirname,
	readlink: cmd_readlink,
	file: cmd_file,
	cal: cmd_cal,
	help: cmd_help,
	pytest: cmd_pytest,
	npm: cmd_npm,
	pnpm: cmd_pnpm,
	yarn: cmd_npm,
	make: cmd_make,
};

// Tab completion helpers
export function get_completions(
	partial: string,
	state: TerminalState,
): string[] {
	const parts = partial.split(/\s+/);

	// Completing a command name
	if (parts.length <= 1) {
		const prefix = parts[0] || '';
		return Object.keys(COMMANDS)
			.filter(c => c.startsWith(prefix))
			.sort();
	}

	// Completing a file/directory path argument
	const last_part = parts[parts.length - 1];
	return get_path_completions(last_part, state);
}

export function get_path_completions(partial: string, state: TerminalState): string[] {
	let dir_path: string;
	let prefix: string;

	if (partial.includes('/')) {
		const last_slash = partial.lastIndexOf('/');
		dir_path = partial.slice(0, last_slash + 1) || '/';
		prefix = partial.slice(last_slash + 1);
	} else {
		dir_path = '.';
		prefix = partial;
	}

	const target = dir_path === '.' ? state.cwd : dir_path;
	const { node } = resolve_path(vfs_root, state.cwd, target);

	if (!node || node.type !== 'dir' || !node.children) {
		return [];
	}

	const matches: string[] = [];
	for (const [name, child] of node.children) {
		if (name.startsWith(prefix)) {
			const completion = dir_path === '.' ? name : dir_path + name;
			matches.push(child.type === 'dir' ? completion + '/' : completion);
		}
	}

	return matches.sort();
}

// Parse a command line into command and arguments
export function parse_command_line(input: string): { cmd: string; args: string[] } {
	const trimmed = input.trim();
	if (!trimmed) return { cmd: '', args: [] };

	// Simple tokenizer that handles quotes
	const tokens: string[] = [];
	let current = '';
	let in_single = false;
	let in_double = false;

	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (ch === "'" && !in_double) {
			in_single = !in_single;
		} else if (ch === '"' && !in_single) {
			in_double = !in_double;
		} else if (ch === ' ' && !in_single && !in_double) {
			if (current) {
				tokens.push(current);
				current = '';
			}
		} else {
			current += ch;
		}
	}
	if (current) tokens.push(current);

	return { cmd: tokens[0] || '', args: tokens.slice(1) };
}
