<script lang="ts">
	const COLS = 26; // A–Z
	const ROWS = 40;

	function col_label(index: number): string {
		return String.fromCharCode(65 + index); // 0 -> 'A'
	}

	function cell_ref(col: number, row: number): string {
		return `${col_label(col)}${row + 1}`;
	}

	// Sparse store keyed by "A1" etc.
	const seed: Record<string, string> = {
		A1: 'Region',
		B1: 'Q1',
		C1: 'Q2',
		D1: 'Total',
		A2: 'North',
		B2: '1200',
		C2: '1450',
		D2: '=SUM(B2:C2)',
		A3: 'South',
		B3: '980',
		C3: '1100',
		D3: '=SUM(B3:C3)',
		A4: 'West',
		B4: '1530',
		C4: '1610',
		D4: '=SUM(B4:C4)',
		A5: 'Total',
		B5: '=SUM(B2:B4)',
		C5: '=SUM(C2:C4)',
		D5: '=SUM(D2:D4)',
	};

	let cells = $state<Record<string, string>>({ ...seed });
	let sel_col = $state(1); // B
	let sel_row = $state(13); // row 14 (index 13)

	const selected_ref = $derived(cell_ref(sel_col, sel_row));

	function get_cell(col: number, row: number): string {
		return cells[cell_ref(col, row)] ?? '';
	}

	function select_cell(col: number, row: number) {
		sel_col = col;
		sel_row = row;
	}
</script>

<section class="container">
	<header class="app-window-drag-handle toolbar">
		<span class="app-name">Numbers</span>
	</header>

	<div class="formula-bar">
		<span class="cell-ref">{selected_ref}</span>
		<input
			class="cell-input"
			type="text"
			placeholder="Enter value or formula"
			bind:value={cells[selected_ref]}
		/>
	</div>

	<div class="grid-scroll">
		<table class="sheet">
			<thead>
				<tr>
					<th class="corner"></th>
					{#each Array(COLS) as _, c}
						<th class="col-head" class:active={c === sel_col}>{col_label(c)}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each Array(ROWS) as _, r}
					<tr>
						<th class="row-head" class:active={r === sel_row}>{r + 1}</th>
						{#each Array(COLS) as _, c}
							<td
								class="cell"
								class:selected={c === sel_col && r === sel_row}
								onclick={() => select_cell(c, r)}
							>
								{get_cell(c, r)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.container {
		height: 100%;
		width: 100%;
		background: #ffffff;
		color: #1c1c1e;
		border-radius: inherit;
		display: grid;
		grid-template-rows: auto auto 1fr;
		overflow: hidden;
		font-family: var(--system-font-family);
	}

	.toolbar {
		display: flex;
		align-items: center;
		padding: 6px 12px;
		min-height: 38px;
		background: linear-gradient(to bottom, #f6f6f6, #ececec);
		border-bottom: 1px solid #d6d6d6;
	}

	.app-name {
		font-size: 13px;
		font-weight: 600;
		color: #1fb35a;
	}

	.formula-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: #fafafa;
		border-bottom: 1px solid #e0e0e0;
	}

	.cell-ref {
		min-width: 48px;
		font-size: 12px;
		font-weight: 600;
		color: #6e6e73;
		padding: 4px 8px;
		background: #eef0f2;
		border-radius: 4px;
		text-align: center;
	}

	.cell-input {
		flex: 1;
		font-size: 13px;
		padding: 5px 8px;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		outline: none;
		font-family: var(--system-font-family);
		color: #1c1c1e;
		background: #ffffff;

		&:focus {
			border-color: #1fb35a;
			box-shadow: 0 0 0 2px rgba(31, 179, 90, 0.2);
		}
	}

	.grid-scroll {
		overflow: auto;
		min-height: 0;
	}

	.sheet {
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 12px;
	}

	.corner,
	.col-head,
	.row-head {
		background: #1fb35a;
		color: #ffffff;
		font-weight: 600;
		border: 1px solid #18934b;
		position: sticky;
		text-align: center;
		user-select: none;
	}

	.col-head {
		top: 0;
		min-width: 80px;
		width: 80px;
		height: 22px;
	}

	.row-head {
		left: 0;
		min-width: 40px;
		width: 40px;
	}

	.corner {
		top: 0;
		left: 0;
		z-index: 2;
		width: 40px;
		min-width: 40px;
	}

	.col-head.active,
	.row-head.active {
		background: #18934b;
	}

	.cell {
		border: 1px solid #e2e2e2;
		min-width: 80px;
		width: 80px;
		height: 22px;
		padding: 2px 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: cell;
		background: #ffffff;
	}

	.cell.selected {
		outline: 2px solid #1fb35a;
		outline-offset: -2px;
		background: rgba(31, 179, 90, 0.06);
	}
</style>
