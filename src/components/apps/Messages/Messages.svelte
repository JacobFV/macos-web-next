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

	let channels: Channel[] = $state([]);
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

	async function refresh_channels() {
		const c = client();
		if (!c || !c.enabled) return;
		const r = await c.chatChannels();
		if (r && Array.isArray(r.channels)) {
			channels = r.channels;
			if (!channels.find((c) => c.channel_id === selected) && channels.length) {
				selected = channels[0].channel_id;
			}
		}
	}

	async function refresh_history() {
		const c = client();
		if (!c || !c.enabled) return;
		const r = await c.chatHistory(selected);
		if (r && Array.isArray(r.messages)) {
			messages = r.messages as ChatMessage[];
			scroll_bottom();
		}
	}

	async function send() {
		const text = composer.trim();
		if (!text) return;
		const c = client();
		if (!c || !c.enabled) return;
		composer = '';
		await c.postChat(selected, text);
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
		<span class="me">{me}</span>
		<span class="space"></span>
		<span class="net">{connected ? 'virtual-internet' : 'offline'}</span>
	</header>

	<div class="main">
		<aside class="sidebar">
			<div class="sidebar-title">Channels</div>
			<div class="conversation-list">
				{#each channels as ch (ch.channel_id)}
					<button
						class="conversation"
						class:active={selected === ch.channel_id}
						onclick={() => pick(ch)}
					>
						<div class="avatar">#</div>
						<div class="convo-info">
							<div class="convo-header">
								<span class="convo-name">{ch.name || ch.channel_id}</span>
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
						<div class="bubble">
							<div class="sender">{msg.sender}</div>
							<div class="text">{msg.text}</div>
						</div>
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
					placeholder="Message {selected}"
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
		background-color: var(--system-color-light);
		border-radius: inherit;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: var(--system-font-family);
		color: var(--system-color-light-contrast);
		min-width: 720px;
	}

	.titlebar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		min-height: 36px;
		background: linear-gradient(to bottom, #f6f6f6, #ededef);
		border-bottom: 1px solid #d1d1d6;
		font-size: 12px;
		color: #555;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d33;
	}
	.status-dot.online { background: #34c759; }
	.me { font-weight: 600; color: #333; }
	.space { flex: 1; }
	.net { font-family: ui-monospace, monospace; opacity: 0.8; }

	.main { display: flex; flex: 1; overflow: hidden; }

	.sidebar {
		width: 240px;
		min-width: 200px;
		border-right: 1px solid #d1d1d6;
		display: flex;
		flex-direction: column;
		background: #f2f2f7;
	}
	.sidebar-title {
		padding: 12px 14px 6px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #888;
	}
	.conversation-list { flex: 1; overflow-y: auto; }
	.conversation {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		border-bottom: 1px solid rgba(0, 0, 0, 0.04);
	}
	.conversation:hover { background: rgba(0, 0, 0, 0.04); }
	.conversation.active { background: #007aff; color: white; }
	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: #007aff;
		color: white;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.conversation.active .avatar { background: rgba(255,255,255,0.25); }
	.convo-info { flex: 1; min-width: 0; }
	.convo-header { display: flex; justify-content: space-between; align-items: center; }
	.convo-name { font-size: 14px; font-weight: 600; }
	.convo-count { font-size: 11px; opacity: 0.6; }
	.convo-preview {
		font-size: 12px;
		opacity: 0.7;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.empty {
		padding: 20px;
		font-size: 13px;
		color: #888;
		text-align: center;
	}

	.chat-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
	.chat-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 10px 18px;
		border-bottom: 1px solid #d1d1d6;
		background: rgba(0, 0, 0, 0.02);
	}
	.chat-name { font-size: 15px; font-weight: 700; }
	.chat-members { font-size: 12px; color: #888; }

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: #fff;
	}
	.message { display: flex; flex-direction: column; max-width: 78%; }
	.message.sent { align-self: flex-end; align-items: flex-end; }
	.bubble {
		padding: 8px 14px;
		border-radius: 14px;
		font-size: 14px;
		line-height: 1.4;
		background: #e9e9eb;
		color: #1c1c1e;
	}
	.message.sent .bubble {
		background: #007aff;
		color: white;
	}
	.sender { font-size: 11px; font-weight: 700; opacity: 0.7; margin-bottom: 2px; }

	.input-area {
		display: flex;
		gap: 8px;
		padding: 10px 18px;
		border-top: 1px solid #d1d1d6;
		background: rgba(0, 0, 0, 0.02);
	}
	.composer {
		flex: 1;
		padding: 10px 14px;
		border: 1px solid #d1d1d6;
		border-radius: 20px;
		font-size: 14px;
		background: white;
		outline: none;
	}
	.composer:focus { border-color: #007aff; }
	.send-btn {
		padding: 0 18px;
		min-width: 70px;
		border-radius: 18px;
		border: none;
		background: #007aff;
		color: white;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.send-btn:hover { background: #0066d6; }
</style>
