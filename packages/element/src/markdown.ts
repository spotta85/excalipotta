import { MARKDOWN_PADDING, applyDarkModeFilter } from "@excalidraw/common";

import { getCornerRadius } from "./utils";

import type { ExcalidrawMarkdownElement } from "./types";

const BODY_FONT = "Assistant, system-ui, -apple-system, Segoe UI, sans-serif";
const CODE_FONT = "Cascadia, ui-monospace, Menlo, Consolas, monospace";
const LINE_HEIGHT = 1.5;
const HEADING_SCALE = [1.6, 1.35, 1.15, 1, 1, 1];

type MarkdownLine = {
  text: string;
  scale: number;
  bold: boolean;
  code: boolean;
};

const stripInline = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]*)`/g, "$1");

/**
 * A plain-text approximation of the rendered markdown, used where the HTML
 * rendering isn't available (canvas/PNG export).
 */
export const getMarkdownPlainLines = (markdown: string): MarkdownLine[] => {
  const lines: MarkdownLine[] = [];
  let inFence = false;

  for (const raw of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      lines.push({ text: raw, scale: 0.875, bold: false, code: true });
      continue;
    }

    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      lines.push({
        text: stripInline(heading[2]),
        scale: HEADING_SCALE[heading[1].length - 1],
        bold: true,
        code: false,
      });
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) {
      lines.push({ text: "", scale: 1, bold: false, code: false });
      continue;
    }

    const text = raw
      .replace(
        /^(\s*)[-*+]\s+\[( |x|X)\]\s+/,
        (_, indent, checked) => `${indent}${checked === " " ? "☐" : "☑"} `,
      )
      .replace(/^(\s*)[-*+]\s+/, "$1• ")
      .replace(/^\s*>\s?/, "│ ");

    lines.push({
      text: stripInline(text),
      scale: 1,
      bold: false,
      code: false,
    });
  }

  return lines;
};

const wrapLine = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  if (!text || context.measureText(text).width <= maxWidth) {
    return [text];
  }
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/(\s+)/)) {
    const candidate = current + word;
    if (current && context.measureText(candidate).width > maxWidth) {
      out.push(current.trimEnd());
      current = word.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current) {
    out.push(current);
  }
  return out;
};

export const drawMarkdownElementOnCanvas = (
  element: ExcalidrawMarkdownElement,
  context: CanvasRenderingContext2D,
  opts: { isDarkMode: boolean; renderText: boolean },
) => {
  const { width, height } = element;
  const radius = getCornerRadius(Math.min(width, height), element);

  context.save();
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(width - radius, 0);
  context.quadraticCurveTo(width, 0, width, radius);
  context.lineTo(width, height - radius);
  context.quadraticCurveTo(width, height, width - radius, height);
  context.lineTo(radius, height);
  context.quadraticCurveTo(0, height, 0, height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fillStyle = applyDarkModeFilter(
    element.backgroundColor,
    opts.isDarkMode,
  );
  context.fill();

  // on the editor canvas the text is laid out as HTML on top of the card;
  // only exports paint an approximation of it here
  if (opts.renderText) {
    context.clip();
    context.fillStyle = applyDarkModeFilter(
      element.strokeColor,
      opts.isDarkMode,
    );
    context.textBaseline = "top";

    const maxWidth = width - MARKDOWN_PADDING * 2;
    let y = MARKDOWN_PADDING;

    for (const line of getMarkdownPlainLines(element.markdown)) {
      const fontSize = element.fontSize * line.scale;
      context.font = `${line.bold ? "bold " : ""}${fontSize}px ${
        line.code ? CODE_FONT : BODY_FONT
      }`;
      for (const part of line.code
        ? [line.text]
        : wrapLine(context, line.text, maxWidth)) {
        if (y > height - MARKDOWN_PADDING) {
          break;
        }
        context.fillText(part, MARKDOWN_PADDING, y);
        y += fontSize * LINE_HEIGHT;
      }
    }
  }

  context.restore();
};
