import React from "react";

import {
  DEFAULT_MARKDOWN_BG,
  DEFAULT_MARKDOWN_FONT_SIZE,
  DEFAULT_MARKDOWN_HEIGHT,
  DEFAULT_MARKDOWN_WIDTH,
  KEYS,
  ROUNDNESS,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  getMarkdownPlainLines,
} from "@excalidraw/element";

import type {
  ExcalidrawMarkdownElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { restoreElements } from "../data/restore";
import { Excalidraw } from "../index";
import { renderMarkdown } from "../markdown/renderMarkdown";
import { exportToSvg } from "../scene/export";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

const getMarkdownElement = () =>
  h.elements.find(
    (element) => element.type === "markdown",
  ) as NonDeleted<ExcalidrawMarkdownElement>;

const getEditor = () =>
  waitFor(() => {
    const editor = document.querySelector<HTMLTextAreaElement>(
      ".excalidraw-markdown__editor",
    );
    expect(editor).not.toBe(null);
    return editor!;
  });

describe("renderMarkdown", () => {
  it("renders GFM with highlighted code blocks", () => {
    const html = renderMarkdown(
      "# Title\n\n- [x] done\n\n```js\nconst a = 1;\n```",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<code class="hljs">');
    expect(html).toContain('class="hljs-keyword"');
  });

  /* eslint-disable no-script-url */
  it("sanitizes untrusted HTML", () => {
    const html = renderMarkdown(
      `<img src="x" onerror="alert(1)"><script>alert(2)</script>[a](javascript:alert(3))`,
    );
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });
  /* eslint-enable no-script-url */
});

describe("getMarkdownPlainLines", () => {
  it("strips markdown syntax for canvas export", () => {
    const lines = getMarkdownPlainLines(
      "## Heading\n- **bold** item\n```\ncode()\n```",
    );
    expect(lines.map((line) => line.text)).toEqual([
      "Heading",
      "• bold item",
      "code()",
    ]);
    expect(lines[0].bold).toBe(true);
    expect(lines[2].code).toBe(true);
  });
});

describe("restore", () => {
  it("keeps markdown fields and fills in missing ones", () => {
    const [restored, legacy] = restoreElements(
      [
        API.createElement({ type: "markdown", markdown: "# hi" }),
        { ...API.createElement({ type: "markdown" }), fontSize: undefined },
      ] as any,
      null,
    ) as ExcalidrawMarkdownElement[];

    expect(restored.type).toBe("markdown");
    expect(restored.markdown).toBe("# hi");
    expect(legacy.fontSize).toBe(DEFAULT_MARKDOWN_FONT_SIZE);
  });
});

describe("markdown cards", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("clicking with the tool places a default card and opens the editor", async () => {
    UI.clickTool("markdown");
    mouse.clickAt(300, 300);

    const card = getMarkdownElement();
    expect(card.width).toBe(DEFAULT_MARKDOWN_WIDTH);
    expect(card.height).toBe(DEFAULT_MARKDOWN_HEIGHT);
    expect(card.backgroundColor).toBe(DEFAULT_MARKDOWN_BG);
    expect(card.roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
    expect(h.state.editingMarkdownId).toBe(card.id);
    expect(h.state.activeTool.type).toBe("selection");

    const editor = await getEditor();
    fireEvent.change(editor, { target: { value: "**new**" } });
    expect(getMarkdownElement().markdown).toBe("**new**");

    Keyboard.keyPress(KEYS.ESCAPE, editor);
    expect(h.state.editingMarkdownId).toBe(null);
  });

  it("Enter edits the selected card and the edit is undoable", async () => {
    const card = API.createElement({ type: "markdown", markdown: "before" });
    API.updateScene({
      elements: [card],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    API.setSelectedElements([card]);

    Keyboard.keyPress(KEYS.ENTER);
    expect(h.state.editingMarkdownId).toBe(card.id);

    const editor = await getEditor();
    fireEvent.change(editor, { target: { value: "after" } });
    Keyboard.keyPress(KEYS.ESCAPE, editor);
    expect(getMarkdownElement().markdown).toBe("after");

    Keyboard.undo();
    expect(getMarkdownElement().markdown).toBe("before");
  });

  it("renders the card as HTML over the canvas", async () => {
    const card = API.createElement({
      type: "markdown",
      markdown: "## Rendered",
    });
    API.setElements([card]);

    await waitFor(() => {
      const node = document.querySelector(`[data-markdown-id="${card.id}"] h2`);
      expect(node?.textContent).toBe("Rendered");
    });
  });

  it("exports to SVG with the rendered markdown", async () => {
    const card = API.createElement({
      type: "markdown",
      markdown: "## Exported",
    });
    const svg = await exportToSvg([card], h.state, {}, {});
    expect(svg.querySelector("foreignObject h2")?.textContent).toBe("Exported");
  });
});
