<script lang="ts">
	const {
		is_being_dragged,
	}: {
		is_being_dragged?: boolean;
	} = $props();

	void is_being_dragged;

	type FileEntry = {
		path: string;
		content: string;
	};

	const seed_files: FileEntry[] = [
		{
			path: 'src/checkout.py',
			content: `"""Checkout flow for the storefront."""
from decimal import Decimal
from billing import charge_card


TAX_RATE = Decimal("0.0825")


def subtotal(cart):
    total = Decimal("0")
    for item in cart:
        total += Decimal(str(item["price"])) * item["qty"]
    return total


def apply_tax(amount):
    return (amount * (1 + TAX_RATE)).quantize(Decimal("0.01"))


def checkout(cart, card):
    amount = apply_tax(subtotal(cart))
    receipt = charge_card(card, amount)
    return {"ok": receipt["status"] == "paid", "total": str(amount)}
`,
		},
		{
			path: 'src/api.ts',
			content: `import { checkout } from './billing';

export interface CartItem {
  sku: string;
  price: number;
  qty: number;
}

export async function postCheckout(items: CartItem[], cardToken: string) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items, cardToken }),
  });
  if (!res.ok) throw new Error(\`checkout failed: \${res.status}\`);
  return (await res.json()) as { ok: boolean; total: string };
}

export function formatMoney(cents: number): string {
  return \`$\${(cents / 100).toFixed(2)}\`;
}
`,
		},
		{
			path: 'src/billing.ts',
			content: `const TAX_RATE = 0.0825;

export interface Card {
  number: string;
  exp: string;
  cvc: string;
}

export function subtotal(items: { price: number; qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function applyTax(amount: number): number {
  return Math.round(amount * (1 + TAX_RATE) * 100) / 100;
}

export function checkout(items: { price: number; qty: number }[], card: Card) {
  const total = applyTax(subtotal(items));
  return { status: card.cvc ? 'paid' : 'declined', total };
}
`,
		},
		{
			path: 'tests/test_checkout.py',
			content: `import pytest
from src.checkout import subtotal, apply_tax, checkout


CART = [
    {"sku": "A1", "price": 10.00, "qty": 2},
    {"sku": "B2", "price": 5.50, "qty": 1},
]


def test_subtotal():
    assert float(subtotal(CART)) == 25.50


def test_apply_tax():
    assert float(apply_tax(subtotal(CART))) == pytest.approx(27.60, abs=0.01)


def test_checkout_ok():
    result = checkout(CART, {"number": "4242", "cvc": "123"})
    assert result["ok"] is True
`,
		},
		{
			path: 'README.md',
			content: `# Storefront

A tiny example checkout service.

## Layout

- \`src/checkout.py\` — Python checkout flow
- \`src/api.ts\` — front-end API client
- \`src/billing.ts\` — billing helpers
- \`tests/test_checkout.py\` — pytest suite

## Running

\`\`\`bash
pnpm install
pnpm test
\`\`\`

Edit any file in the sidebar to get started.
`,
		},
		{
			path: 'package.json',
			content: `{
  "name": "storefront",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p .",
    "test": "vitest run",
    "dev": "vite"
  },
  "dependencies": {
    "decimal.js": "^10.4.3"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
`,
		},
	];

	let files = $state<FileEntry[]>(seed_files.map((f) => ({ ...f })));
	let active_index = $state(0);

	const active_file = $derived(files[active_index]);
	const line_count = $derived(active_file.content.split('\n').length);
	const line_numbers = $derived(Array.from({ length: line_count }, (_, i) => i + 1));

	function select_file(index: number) {
		active_index = index;
	}

	function file_name(path: string): string {
		const parts = path.split('/');
		return parts[parts.length - 1];
	}
</script>

<section class="container">
	<header class="app-window-drag-handle titlebar">
		<span class="titlebar-label">{active_file.path} — VSCode</span>
	</header>

	<div class="body">
		<aside class="sidebar">
			<div class="sidebar-header">EXPLORER</div>
			<ul class="file-tree">
				{#each files as file, i}
					<li>
						<button
							class="file-item"
							class:active={i === active_index}
							onclick={() => select_file(i)}
							title={file.path}
						>
							{file.path}
						</button>
					</li>
				{/each}
			</ul>
		</aside>

		<div class="editor-area">
			<div class="tab-bar">
				<div class="tab active">{file_name(active_file.path)}</div>
			</div>

			<div class="editor-wrap">
				<div class="gutter" aria-hidden="true">
					{#each line_numbers as n}
						<div class="gutter-line">{n}</div>
					{/each}
				</div>
				<textarea
					class="editor-textarea"
					spellcheck="false"
					bind:value={files[active_index].content}
				></textarea>
			</div>
		</div>
	</div>
</section>

<style>
	.container {
		height: 100%;
		width: 100%;
		background-color: #1e1e1e;
		color: #d4d4d4;
		border-radius: inherit;
		display: grid;
		grid-template-rows: auto 1fr;
		overflow: hidden;
		font-family: var(--system-font-family);
	}

	.titlebar {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		min-height: 32px;
		background: #323233;
		color: #cccccc;
		font-size: 12px;
		border-bottom: 1px solid #1b1b1b;
	}

	.titlebar-label {
		opacity: 0.85;
	}

	.body {
		display: grid;
		grid-template-columns: 200px 1fr;
		overflow: hidden;
		min-height: 0;
	}

	.sidebar {
		background: #252526;
		border-right: 1px solid #1b1b1b;
		overflow-y: auto;
		min-width: 0;
	}

	.sidebar-header {
		font-size: 11px;
		letter-spacing: 0.08em;
		color: #bbbbbb;
		padding: 8px 12px;
		text-transform: uppercase;
	}

	.file-tree {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.file-item {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		color: #cccccc;
		font-size: 13px;
		padding: 4px 12px 4px 18px;
		cursor: pointer;
		font-family: var(--system-font-family);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		&:hover {
			background: #2a2d2e;
		}

		&.active {
			background: #37373d;
			color: #ffffff;
		}
	}

	.editor-area {
		display: grid;
		grid-template-rows: auto 1fr;
		overflow: hidden;
		min-width: 0;
		min-height: 0;
	}

	.tab-bar {
		display: flex;
		background: #252526;
		border-bottom: 1px solid #1b1b1b;
	}

	.tab {
		padding: 7px 16px;
		font-size: 13px;
		color: #969696;
		background: #2d2d2d;

		&.active {
			color: #ffffff;
			background: #1e1e1e;
			border-top: 1px solid #007acc;
		}
	}

	.editor-wrap {
		display: grid;
		grid-template-columns: auto 1fr;
		overflow: hidden;
		min-height: 0;
		background: #1e1e1e;
	}

	.gutter {
		padding: 8px 8px 8px 12px;
		text-align: right;
		color: #6e7681;
		font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
		font-size: 13px;
		line-height: 1.5;
		user-select: none;
		overflow: hidden;
		background: #1e1e1e;
	}

	.gutter-line {
		height: 1.5em;
	}

	.editor-textarea {
		width: 100%;
		height: 100%;
		resize: none;
		border: none;
		outline: none;
		background: #1e1e1e;
		color: #d4d4d4;
		font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
		font-size: 13px;
		line-height: 1.5;
		padding: 8px 12px;
		white-space: pre;
		overflow: auto;
		tab-size: 4;
		box-sizing: border-box;
	}
</style>
