import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import { Marked } from "marked";

const escapeHTML = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const highlightCode = (code: string, lang: string | undefined) => {
  const language = lang?.trim().split(/\s+/)[0]?.toLowerCase();
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    }
    // unlabeled fences are guessed; very long ones aren't worth the cost
    if (!language && code.length < 5000) {
      return hljs.highlightAuto(code).value;
    }
  } catch {
    // fall through to plain text
  }
  return escapeHTML(code);
};

const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      return `<pre><code class="hljs">${highlightCode(
        text,
        lang,
      )}</code></pre>\n`;
    },
  },
});

const CACHE_LIMIT = 200;
const cache = new Map<string, string>();

/**
 * Markdown → sanitized HTML (GFM, syntax-highlighted code blocks). Scene
 * data can come from other people (collab, shared links, pasted files), so
 * the output is always run through DOMPurify.
 */
export const renderMarkdown = (markdown: string): string => {
  const cached = cache.get(markdown);
  if (cached !== undefined) {
    return cached;
  }

  const html = DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    USE_PROFILES: { html: true },
    // GFM task-list checkboxes are the only form control markdown produces
    FORBID_TAGS: ["style", "form", "button", "textarea", "select"],
  });

  if (cache.size >= CACHE_LIMIT) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(markdown, html);
  return html;
};

const HIGHLIGHT_COLORS = {
  light: {
    comment: "#6a737d",
    keyword: "#d73a49",
    title: "#6f42c1",
    literal: "#005cc5",
    string: "#032f62",
    builtIn: "#e36209",
    tag: "#22863a",
  },
  dark: {
    comment: "#8b949e",
    keyword: "#ff7b72",
    title: "#d2a8ff",
    literal: "#79c0ff",
    string: "#a5d6ff",
    builtIn: "#ffa657",
    tag: "#7ee787",
  },
};

/**
 * Self-contained styles for a markdown card exported to SVG (the editor's
 * stylesheet isn't there). Mirrors `MarkdownElement.scss`.
 */
export const getMarkdownExportCSS = (scope: string, isDarkMode: boolean) => {
  const c = HIGHLIGHT_COLORS[isDarkMode ? "dark" : "light"];
  const tint = (percent: number) =>
    `color-mix(in srgb, currentColor ${percent}%, transparent)`;
  const code = `Cascadia, ui-monospace, Menlo, Consolas, monospace`;
  return `
${scope} { box-sizing: border-box; overflow: hidden; font-family: Assistant, system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; overflow-wrap: break-word; }
${scope} > div > :first-child { margin-top: 0; }
${scope} > div > :last-child { margin-bottom: 0; }
${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4, ${scope} h5, ${scope} h6 { margin: 0.9em 0 0.4em; font-weight: 700; line-height: 1.25; }
${scope} h1 { font-size: 1.6em; } ${scope} h2 { font-size: 1.35em; } ${scope} h3 { font-size: 1.15em; } ${scope} h4, ${scope} h5, ${scope} h6 { font-size: 1em; }
${scope} p, ${scope} ul, ${scope} ol, ${scope} pre, ${scope} blockquote, ${scope} table { margin: 0 0 0.7em; }
${scope} ul, ${scope} ol { padding-left: 1.4em; }
${scope} li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.3em; }
${scope} li > input[type="checkbox"] { margin: 0 0.4em 0 0; vertical-align: middle; }
${scope} a { color: #6965db; }
${scope} hr { margin: 1em 0; border: none; border-top: 1px solid ${tint(20)}; }
${scope} blockquote { padding: 0.1em 0 0.1em 0.9em; border-left: 3px solid ${tint(
    25,
  )}; opacity: 0.85; }
${scope} img { max-width: 100%; border-radius: 6px; }
${scope} code { font-family: ${code}; font-size: 0.875em; padding: 0.1em 0.35em; border-radius: 4px; background: ${tint(
    8,
  )}; }
${scope} pre { padding: 0.75em 0.9em; border-radius: 8px; overflow: hidden; background: ${tint(
    6,
  )}; }
${scope} pre code { display: block; padding: 0; background: none; white-space: pre-wrap; line-height: 1.5; }
${scope} table { border-collapse: collapse; font-size: 0.95em; }
${scope} th, ${scope} td { padding: 0.3em 0.7em; border: 1px solid ${tint(
    18,
  )}; }
${scope} th { font-weight: 700; background: ${tint(5)}; }
${scope} .hljs-comment, ${scope} .hljs-quote { color: ${
    c.comment
  }; font-style: italic; }
${scope} .hljs-keyword, ${scope} .hljs-selector-tag, ${scope} .hljs-type, ${scope} .hljs-doctag, ${scope} .hljs-template-tag, ${scope} .hljs-template-variable { color: ${
    c.keyword
  }; }
${scope} .hljs-title, ${scope} .hljs-section { color: ${c.title}; }
${scope} .hljs-attr, ${scope} .hljs-attribute, ${scope} .hljs-literal, ${scope} .hljs-meta, ${scope} .hljs-number, ${scope} .hljs-operator, ${scope} .hljs-variable, ${scope} .hljs-selector-attr, ${scope} .hljs-selector-class, ${scope} .hljs-selector-id { color: ${
    c.literal
  }; }
${scope} .hljs-string, ${scope} .hljs-regexp { color: ${c.string}; }
${scope} .hljs-built_in, ${scope} .hljs-symbol { color: ${c.builtIn}; }
${scope} .hljs-name, ${scope} .hljs-selector-pseudo, ${scope} .hljs-tag { color: ${
    c.tag
  }; }
${scope} .hljs-emphasis { font-style: italic; }
${scope} .hljs-strong { font-weight: 700; }
`;
};
