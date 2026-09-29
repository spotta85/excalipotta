import React, { useEffect, useMemo, useRef } from "react";

import { KEYS } from "@excalidraw/common";

import { renderMarkdown } from "../markdown/renderMarkdown";

import "./MarkdownElement.scss";

export const MarkdownContent = React.memo(
  ({ markdown }: { markdown: string }) => {
    const html = useMemo(() => renderMarkdown(markdown), [markdown]);
    return (
      <div
        className="excalidraw-markdown__content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

const INDENT = "  ";

/**
 * In-place editor for a markdown card's source. Edits are written through
 * `onChange` as you type; `onSubmit` ends the session (Escape, Cmd/Ctrl+Enter
 * or blur).
 */
export const MarkdownEditor = ({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submittedRef = useRef(false);
  const blurSubmitsRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const submit = () => {
    if (!submittedRef.current) {
      submittedRef.current = true;
      onSubmitRef.current();
    }
  };

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) {
      return;
    }
    const ownerWindow = textarea.ownerDocument.defaultView || window;

    // focus only after the gesture that opened the editor (pointerup, click,
    // dblclick) is done, or it'd steal the focus right back
    const focusTimer = ownerWindow.setTimeout(() => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      blurSubmitsRef.current = true;
    });

    // the canvas may keep the focus on pointerdown, so a blur isn't
    // guaranteed when clicking away
    const onPointerDown = (event: PointerEvent) => {
      if (!textarea.contains(event.target as Node)) {
        ownerWindow.requestAnimationFrame(submit);
      }
    };
    const frame = ownerWindow.requestAnimationFrame(() => {
      ownerWindow.addEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
    });

    return () => {
      ownerWindow.clearTimeout(focusTimer);
      ownerWindow.cancelAnimationFrame(frame);
      ownerWindow.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <textarea
      ref={ref}
      className="excalidraw-markdown__editor"
      value={value}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => blurSubmitsRef.current && submit()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // keep editor shortcuts (tools, delete, undo…) out of the textarea
        event.stopPropagation();

        if (
          event.key === KEYS.ESCAPE ||
          (event.key === KEYS.ENTER && (event.metaKey || event.ctrlKey))
        ) {
          event.preventDefault();
          submit();
        } else if (event.key === KEYS.TAB) {
          event.preventDefault();
          const textarea = event.currentTarget;
          const { selectionStart, selectionEnd } = textarea;
          const next =
            textarea.value.slice(0, selectionStart) +
            INDENT +
            textarea.value.slice(selectionEnd);
          onChange(next);
          requestAnimationFrame(() => {
            textarea.setSelectionRange(
              selectionStart + INDENT.length,
              selectionStart + INDENT.length,
            );
          });
        }
      }}
    />
  );
};
