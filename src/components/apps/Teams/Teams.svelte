<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	type ChatMessage = {
		message_id: string;
		channel_id: string;
		sender: string;
		text: string;
		t: number;
	};
	type Channel = { channel_id: string; name: string; members: string[]; message_count: number };

	// Network isolation: the Teams app only ever talks to channels namespaced
	// with the `teams:` prefix, so it can never surface iMessage/Slack traffic.
	const NETWORK = 'teams';
	const PREFIX = NETWORK + ':';

	// Ensure an id is namespaced for the backend. Display ids (e.g. `#general`)
	// get the prefix; already-namespaced ids pass through unchanged.
	function nsId(id: string): string {
		return id.startsWith(PREFIX) ? id : PREFIX + id;
	}
	// Strip the prefix for display in the UI.
	function displayId(id: string): string {
		return id.startsWith(PREFIX) ? id.slice(PREFIX.length) : id;
	}

	let channels: Channel[] = $state([]);
	// `selected` is held in DISPLAY form (e.g. `#general`); namespaced via nsId()
	// whenever we talk to the backend.
	let selected: string = $state('#incident');
	let messages: ChatMessage[] = $state([]);
	let composer: string = $state('');
	let me: string = $state('local');
	let connected: boolean = $state(false);
	let messages_el: HTMLDivElement;
	let poll_timer: ReturnType<typeof setInterval> | null = null;

	function client(): any {
		// @ts-ignore — injected by SynthUX runtime
		return (window as any).__synthuxInternet || null;
	}

	function scroll_bottom() {
		if (messages_el) {
			requestAnimationFrame(() => {
				messages_el.scrollTop = messages_el.scrollHeight;
			});
		}
	}

	function fmt_time(t: number): string {
		if (!t) return '';
		try {
			return new Date(t < 1e12 ? t * 1000 : t).toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '';
		}
	}

	async function refresh_channels() {
		const c = client();
		if (!c || !c.enabled) return;
		const r = await c.chatChannels();
		if (r && Array.isArray(r.channels)) {
			// Only keep channels on the teams network; display them prefix-stripped.
			channels = (r.channels as Channel[])
				.filter((ch) => ch.channel_id.startsWith(PREFIX))
				.map((ch) => ({
					...ch,
					channel_id: displayId(ch.channel_id),
					name: ch.name ? displayId(ch.name) : displayId(ch.channel_id)
				}));
			if (!channels.find((ch) => ch.channel_id === selected) && channels.length) {
				selected = channels[0].channel_id;
			}
		}
	}

	async function refresh_history() {
		const c = client();
		if (!c || !c.enabled) return;
		const r = await c.chatHistory(nsId(selected));
		if (r && Array.isArray(r.messages)) {
			messages = (r.messages as ChatMessage[]).map((m) => ({
				...m,
				channel_id: displayId(m.channel_id)
			}));
			scroll_bottom();
		}
	}

	async function send() {
		const text = composer.trim();
		if (!text) return;
		const c = client();
		if (!c || !c.enabled) return;
		composer = '';
		await c.postChat(nsId(selected), text);
		await refresh_history();
	}

	function pick(ch: Channel) {
		selected = ch.channel_id;
		refresh_history();
	}

	onMount(async () => {
		const c = client();
		if (c) {
			me = c.actor || 'local';
			connected = !!c.enabled;
		}
		await refresh_channels();
		await refresh_history();
		poll_timer = setInterval(async () => {
			await refresh_history();
			await refresh_channels();
		}, 700);
	});

	onDestroy(() => {
		if (poll_timer) clearInterval(poll_timer);
	});

	let current_messages = $derived(messages);
	let current_channel = $derived(channels.find((c) => c.channel_id === selected));
</script>

<section class="container">
	<header class="app-window-drag-handle titlebar">
		<span class="status-dot" class:online={connected}></span>
		<span class="workspace">Microsoft Teams</span>
		<span class="me">{me}</span>
		<span class="space"></span>
		<span class="net">{connected ? NETWORK : 'offline'}</span>
	</header>

	<div class="main">
		<aside class="sidebar">
			<div class="team-card">
				<span class="team-avatar">A</span>
				<span class="team-name">ACME Engineering</span>
			</div>
			<div class="sidebar-title">Channels</div>
			<div class="conversation-list">
				{#each channels as ch (ch.channel_id)}
					<button
						class="conversation channel"
						class:active={selected === ch.channel_id}
						onclick={() => pick(ch)}
					>
						<span class="hash">#</span>
						<div class="convo-info">
							<div class="convo-header">
								<span class="convo-name">{displayId(ch.name || ch.channel_id).replace(/^#/, '')}</span>
								<span class="convo-count">{ch.message_count}</span>
							</div>
							<div class="convo-preview">{ch.members.join(', ')}</div>
						</div>
					</button>
				{/each}
				{#if channels.length === 0}
					<div class="empty">No channels yet</div>
				{/if}
			</div>
		</aside>

		<div class="chat-area">
			<div class="chat-header">
				<span class="chat-name">{current_channel?.name || selected}</span>
				<span class="chat-members">{current_channel?.members.join(', ') || ''}</span>
			</div>

			<div class="messages" bind:this={messages_el}>
				{#each current_messages as msg (msg.message_id)}
					<div class="message" class:sent={msg.sender === me}>
						<div class="msg-line">
							<span class="sender">{msg.sender}</span>
							<span class="timestamp">{fmt_time(msg.t)}</span>
						</div>
						<div class="text">{msg.text}</div>
					</div>
				{/each}
				{#if current_messages.length === 0}
					<div class="empty">No messages in {selected}</div>
				{/if}
			</div>

			<div class="input-area">
				<input
					class="composer"
					type="text"
					placeholder="Type a message in {selected}"
					bind:value={composer}
					onkeydown={(e) => {
						if (e.key === 'Enter') send();
					}}
				/>
				<button class="send-btn" onclick={send}>Send</button>
			</div>
		</div>
	</div>
</section>

<style>
	.container {
		height: 100%;
		width: 100%;
		background-color: #ffffff;
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--system-font-family);
		color: #242424;
		min-width: 720px;
	}

	.titlebar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		min-height: 36px;
		background: #6264a7;
		border-bottom: 1px solid #4b4ba6;
		font-size: 12px;
		color: #e6e6f5;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d33;
	}
	.status-dot.online { background: #6bb700; }
	.workspace { font-weight: 700; color: #ffffff; }
	.me { font-weight: 600; color: #c7c7ec; }
	.space { flex: 1; }
	.net { font-family: ui-monospace, monospace; opacity: 0.8; }

	.main { display: flex; flex: 1; overflow: hidden; }

	.sidebar {
		width: 240px;
		min-width: 200px;
		border-right: 1px solid #4b4ba6;
		display: flex;
		flex-direction: column;
		background: #4b4ba6;
		color: #dcdcf2;
	}
	.team-card {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}
	.team-avatar {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		background: #5b5fc7;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.team-name { font-size: 13px; font-weight: 600; color: #ffffff; }
	.sidebar-title {
		padding: 12px 14px 6px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #b5b5e0;
	}
	.conversation-list { flex: 1; overflow-y: auto; }
	.conversation {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 14px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
	}
	.conversation:hover { background: rgba(255, 255, 255, 0.08); }
	.conversation.active { background: #5b5fc7; color: #ffffff; }
	.conversation.active .convo-name,
	.conversation.active .convo-count,
	.conversation.active .convo-preview,
	.conversation.active .hash { color: #ffffff; }
	.hash {
		font-size: 16px;
		font-weight: 600;
		color: #b5b5e0;
		flex-shrink: 0;
		width: 16px;
		text-align: center;
	}
	.convo-info { flex: 1; min-width: 0; }
	.convo-header { display: flex; justify-content: space-between; align-items: center; }
	.convo-name { font-size: 14px; font-weight: 500; color: #dcdcf2; }
	.convo-count { font-size: 11px; opacity: 0.6; color: #dcdcf2; }
	.convo-preview {
		font-size: 12px;
		opacity: 0.6;
		color: #dcdcf2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.empty {
		padding: 20px;
		font-size: 13px;
		color: #999;
		text-align: center;
	}

	.chat-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
	.chat-header {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 10px 18px;
		border-bottom: 1px solid #e1e1e8;
		background: #fff;
	}
	.chat-name { font-size: 16px; font-weight: 800; color: #242424; }
	.chat-name::before { content: '# '; opacity: 0.5; }
	.chat-members { font-size: 12px; color: #888; }

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: #fff;
	}
	.message {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		max-width: 100%;
		padding: 6px 10px;
		border-radius: 8px;
		border-left: 3px solid transparent;
	}
	.message:hover { background: #f5f5fb; }
	.message.sent { background: #eef0fb; border-left-color: #6264a7; }
	.msg-line { display: flex; align-items: baseline; gap: 8px; }
	.sender { font-size: 13px; font-weight: 700; color: #6264a7; }
	.timestamp { font-size: 11px; color: #999; }
	.text { font-size: 14px; line-height: 1.46; color: #242424; }

	.input-area {
		display: flex;
		gap: 8px;
		padding: 10px 18px 14px;
		border-top: 1px solid #e1e1e8;
		background: #fff;
	}
	.composer {
		flex: 1;
		padding: 10px 14px;
		border: 1px solid #c5c5d4;
		border-radius: 8px;
		font-size: 14px;
		background: white;
		outline: none;
		color: #242424;
	}
	.composer:focus { border-color: #6264a7; box-shadow: 0 0 0 1px #6264a7; }
	.send-btn {
		padding: 0 18px;
		min-width: 70px;
		border-radius: 8px;
		border: none;
		background: #5b5fc7;
		color: white;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
	.send-btn:hover { background: #4b4ba6; }
</style>
