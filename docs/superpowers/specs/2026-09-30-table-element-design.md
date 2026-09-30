# Table element — design

Status: draft for review · 2026-09-30

## Goal

Let people drop a table onto the canvas to compare things (e.g. "Bun vs Node"), edit it cell by cell like a spreadsheet, and grow it with rows and columns — without the grid ever drifting out of alignment.

Success looks like: place a table, type a comparison with Tab/Enter, add a row and a column, widen a column, resize the whole table, undo it all in sensible steps, and export it — in light and dark mode.

## Decisions (agreed)

| Question | Decision |
| --- | --- |
| Approach | A first-class `table` element (structured data), not a markdown preset or a group of native shapes |
| Look | Clean gray rounded card, matching markdown cards (hand-drawn style may come later as a style option) |
| Cell content | Plain text + inline markdown (`**bold**`, `*italic*`, `` `code` ``, links, emoji) |
| Long text | Column widths stay put; text wraps and the row grows. Columns resizable by dragging borders; resizing the table scales all columns |

## 1. Data model & rendering

New element type in `packages/element/src/types.ts`:

```ts
export type ExcalidrawTableElement = _ExcalidrawElementBase &
  Readonly<{
    type: "table";
    /** rows × columns of inline-markdown source; always rectangular */
    cells: readonly (readonly string[])[];
    /** each column's share of the table width; sums to 1 */
    columnWidths: readonly number[];
    /** style the first row as a header */
    headerRow: boolean;
    fontSize: number;
  }>;
```

- **Width** is user-controlled. Column pixel width = `element.width × share`, so resizing the table rescales every column with no extra bookkeeping.
- **Height is derived from content.** After a local change that can affect layout (cell edit, row/column insert/delete, column-border drag, table resize end, header toggle), the table's rendered height is measured and written to `element.height` in the same history step. Resizing only changes the width: any vertical component of a resize is discarded and the height snaps back to content on pointer-up.
- Only the client that makes a change re-measures, so collaborators never ping-pong height updates over sub-pixel font differences.
- Minimum column width: 40 scene px; minimum table size 1×1.
- Defaults: 3×3, width 480, header row on, `fontSize` 16, gray background (`DEFAULT_MARKDOWN_BG`), rounded corners (adaptive radius 12) — identical card styling to markdown cards. `strokeColor` is the text color.
- The element joins the same type-guard lists as `markdown` (bindable, rectanguloid, frame child, background/stroke-color/roundness capable, restore, collision, distance, bounds).

**Rendering.** Tables render as an HTML `<table>` on the overlay layer used by markdown cards (static canvas skips them via `markdownOverlay`, which is renamed `htmlOverlay`). The markdown-specific layer in `App.tsx` is generalized into one "HTML element" layer with per-type content components: `MarkdownContent` and a new `TableContent`. Cell sources are rendered with `marked.parseInline` + DOMPurify (same sanitizing profile, cached like `renderMarkdown`). Grid lines are subtle `currentColor` tints; the header row is bold with a light tint, as in the approved mockup.

## 2. Editing

**Creating.** Table tool in the main toolbar after Markdown, shortcut **Shift+T** (verified unused). Click places a default 3×3 table centered on the pointer; drag sets its width. Afterwards the tool reverts to selection and the first header cell opens for editing. The tool is also draggable out of the toolbar like sticky note / markdown.

**Cell editing.** New app state `editingTableCell: { elementId, row, col } | null` (not persisted/exported).

- Double-click a cell, or Enter with the table selected, edits that cell (Enter → first cell). A textarea replaces the cell's rendered content and auto-grows; the row grows with it (live height measurement while editing).
- **Tab / Shift+Tab**: next / previous cell (wrapping rows). Tab on the last cell appends a row and moves into it.
- **Enter**: cell below; in the last row, Enter stops editing. **Shift+Enter**: newline inside the cell.
- **Esc** or clicking outside the table: stop editing.
- Keystrokes write through to the element; the whole session is committed as a single history entry on exit (same pattern as markdown cards).

**Structure (only while a cell is being edited).**

- "+" buttons centered on the right edge (add column at end) and bottom edge (add row at end), styled with the editor's primary color.
- Right-click on a cell → context menu: insert row above/below, insert column left/right, delete row, delete column, toggle header row. Implemented as actions whose predicate is "a table cell is being edited", so they appear only then. Deleting the last row/column is disabled.
- Inserted columns take an equal share carved proportionally from the others; deleted columns give their share back proportionally.
- Column borders show a resize cursor; dragging moves share between the two adjacent columns (clamped to the minimum width).

**Out of scope (v1):** merged cells, sorting, per-cell colors/alignment, drag-to-reorder rows/columns, pasting TSV/markdown tables into a table, keyboard arrow navigation between cells.

## 3. Export, persistence & testing

- **Restore** (`data/restore.ts`): validate `cells` into a non-empty rectangular string grid (pad/truncate rows), normalize `columnWidths` to the column count summing to 1 (equal split if invalid), default `headerRow: true`, `fontSize: 16`.
- **SVG export**: `foreignObject` containing the rendered `<table>` plus scoped styles, extending the markdown-card export CSS.
- **Canvas / PNG export**: paint the card background, then lay out each cell with canvas text measurement (wrapped plain text of the inline markdown), deriving row heights from that layout, and draw the grid lines and header tint. An approximation of the HTML rendering, like markdown cards.
- **Library**: tables can be added to the library like any element.

**Tests** (`packages/excalidraw/tests/table.test.tsx` + element unit tests):

- pure helpers: insert/delete row/column keep the grid rectangular and shares summing to 1; column-border drag clamps; restore normalization.
- inline renderer: formatting renders, unsafe HTML/URLs are stripped.
- UI: tool click places a 3×3 table and opens the first cell; typing edits the cell; Tab moves and appends a row at the end; Esc exits; undo reverts the whole session in one step; context-menu actions change structure.
- SVG export contains the table content.
- Existing suite stays green (snapshots updated only for the new app-state field).
