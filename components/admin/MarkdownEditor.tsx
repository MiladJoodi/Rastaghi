"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconTooltip } from "@/components/IconTooltip";
import { renderMarkdown } from "@/lib/markdown";
import { BoldIcon } from "@/components/lucide/BoldIcon";
import { CodeIcon } from "@/components/lucide/CodeIcon";
import { CodeXmlIcon } from "@/components/lucide/CodeXmlIcon";
import { CornerDownLeftIcon } from "@/components/lucide/CornerDownLeftIcon";
import { Heading2Icon } from "@/components/lucide/Heading2Icon";
import { Heading3Icon } from "@/components/lucide/Heading3Icon";
import { ImageIcon } from "@/components/lucide/ImageIcon";
import { ItalicIcon } from "@/components/lucide/ItalicIcon";
import { LinkIcon } from "@/components/lucide/LinkIcon";
import { ListIcon } from "@/components/lucide/ListIcon";
import { ListOrderedIcon } from "@/components/lucide/ListOrderedIcon";
import { MicIcon } from "@/components/lucide/MicIcon";
import { MinusIcon } from "@/components/lucide/MinusIcon";
import { QuoteIcon } from "@/components/lucide/QuoteIcon";
import { Redo2Icon } from "@/components/lucide/Redo2Icon";
import { Undo2Icon } from "@/components/lucide/Undo2Icon";
import { VideoIcon } from "@/components/lucide/VideoIcon";
import {
  insertBlock,
  insertInline,
  prefixLines,
  wrapSelection,
  type EditResult,
  type TextSelection,
} from "@/lib/markdown-edit";
import type { MediaKind } from "@/lib/cloudinary";
import {
  isUploadAborted,
  uploadAdminMedia,
} from "@/lib/admin-upload-client";
import { toPersianDigits } from "@/lib/persian";
import { XIcon } from "@/components/lucide/XIcon";

type MarkdownEditorProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  /** Controlled preview (eye lives in page toolbar). */
  preview?: boolean;
};

type HistoryEntry = {
  value: string;
  start: number;
  end: number;
};

const HISTORY_LIMIT = 120;
const COALESCE_MS = 450;

function ToolButton({
  label,
  disabled,
  pressed,
  busy,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const className = [
    "md-tool-btn",
    pressed ? "is-active" : "",
    busy ? "is-uploading" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <IconTooltip
      label={label}
      side="bottom"
      render={
        <button
          type="button"
          className={className}
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          aria-pressed={pressed || undefined}
          aria-busy={busy || undefined}
        />
      }
    >
      {children}
    </IconTooltip>
  );
}

function ToolSep() {
  return <span className="md-tool-sep" aria-hidden />;
}

export function MarkdownEditor({
  name = "body",
  value,
  onChange,
  rows = 18,
  preview = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HistoryEntry[]>([
    { value, start: 0, end: 0 },
  ]);
  const indexRef = useRef(0);
  const lastRecordAt = useRef(Date.now());
  const applyingHistory = useRef(false);

  const [uploadKind, setUploadKind] = useState<MediaKind | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);

  function cancelUpload() {
    uploadAbortRef.current?.abort();
  }

  function syncHistoryButtons() {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }

  useEffect(() => {
    syncHistoryButtons();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once with initial value
  }, []);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  const previewHtml = useMemo(() => {
    if (!preview) return "";
    try {
      return renderMarkdown(value || "_چیزی نوشته نشده._");
    } catch {
      return "<p>پیش‌نمایش ناموفق بود.</p>";
    }
  }, [preview, value]);

  function readSelection(): TextSelection {
    const el = textareaRef.current;
    if (!el) return { value, start: value.length, end: value.length };
    return {
      value,
      start: el.selectionStart,
      end: el.selectionEnd,
    };
  }

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  }

  function record(entry: HistoryEntry, coalesce: boolean) {
    if (applyingHistory.current) return;

    const now = Date.now();
    const atTip = indexRef.current === historyRef.current.length - 1;
    const tip = historyRef.current[indexRef.current];

    if (tip && tip.value === entry.value) {
      tip.start = entry.start;
      tip.end = entry.end;
      return;
    }

    if (
      coalesce &&
      atTip &&
      indexRef.current > 0 &&
      now - lastRecordAt.current < COALESCE_MS
    ) {
      // Keep typing bursts as one undo step (never overwrite the base entry).
      historyRef.current[indexRef.current] = entry;
    } else {
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
      historyRef.current.push(entry);
      if (historyRef.current.length > HISTORY_LIMIT) {
        historyRef.current.shift();
      }
      indexRef.current = historyRef.current.length - 1;
    }

    lastRecordAt.current = now;
    syncHistoryButtons();
  }

  function commit(result: EditResult, coalesce = false) {
    onChange(result.value);
    record(
      {
        value: result.value,
        start: result.selectionStart,
        end: result.selectionEnd,
      },
      coalesce,
    );
    restoreSelection(result.selectionStart, result.selectionEnd);
  }

  function apply(result: EditResult) {
    commit(result, false);
  }

  function undo() {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const entry = historyRef.current[indexRef.current]!;
    applyingHistory.current = true;
    onChange(entry.value);
    restoreSelection(entry.start, entry.end);
    syncHistoryButtons();
    requestAnimationFrame(() => {
      applyingHistory.current = false;
    });
  }

  function redo() {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    const entry = historyRef.current[indexRef.current]!;
    applyingHistory.current = true;
    onChange(entry.value);
    restoreSelection(entry.start, entry.end);
    syncHistoryButtons();
    requestAnimationFrame(() => {
      applyingHistory.current = false;
    });
  }

  function insertSnippet(snippet: string) {
    const sel = readSelection();
    const next =
      sel.value.slice(0, sel.start) + snippet + sel.value.slice(sel.end);
    const pos = sel.start + snippet.length;
    commit(
      { value: next, selectionStart: pos, selectionEnd: pos },
      false,
    );
  }

  async function uploadMedia(file: File, kind: MediaKind) {
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setUploadKind(kind);
    setUploadPercent(0);
    setUploadProcessing(false);
    setUploadError("");
    try {
      const data = await uploadAdminMedia(file, kind, {
        signal: controller.signal,
        onProgress: (p) => {
          setUploadPercent(p.percent);
          if (p.percent >= 100) setUploadProcessing(true);
        },
      });
      if (kind === "audio") {
        insertSnippet(`\n\n<audio controls src="${data.url}"></audio>\n\n`);
      } else if (kind === "video") {
        insertSnippet(
          `\n\n<video controls src="${data.url}"></video>\n\n`,
        );
      } else {
        const alt = file.name.replace(/\.[^.]+$/, "") || "تصویر";
        insertSnippet(`\n\n![${alt}](${data.url})\n\n`);
      }
    } catch (err) {
      if (isUploadAborted(err)) {
        setUploadError("");
      } else {
        setUploadError(
          err instanceof Error ? err.message : "آپلود ناموفق بود.",
        );
      }
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
      }
      setUploadKind(null);
      setUploadPercent(0);
      setUploadProcessing(false);
    }
  }

  const uploadPctLabel = uploadProcessing
    ? "…"
    : `${toPersianDigits(Math.min(99, Math.max(0, uploadPercent)))}٪`;

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return;
    const key = event.key.toLowerCase();

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      redo();
      return;
    }

    if (key === "b") {
      event.preventDefault();
      apply(wrapSelection(readSelection(), "**", "**", "متن پررنگ"));
    } else if (key === "i") {
      event.preventDefault();
      apply(wrapSelection(readSelection(), "*", "*", "متن کج"));
    } else if (key === "k") {
      event.preventDefault();
      const sel = readSelection();
      const label = sel.value.slice(sel.start, sel.end) || "متن پیوند";
      const snippet = `[${label}](https://)`;
      apply(insertInline(sel, snippet, label.length + 3, "https://".length));
    }
  }

  return (
    <div className="admin-editor-block">
      <div
        className="admin-editor-toolbar md-toolbar"
        role="toolbar"
        aria-label="قالب‌بندی Markdown"
      >
        <div className="md-tool-row">
          <ToolButton
            label="بازگشت (Ctrl+Z)"
            disabled={preview || !canUndo}
            onClick={undo}
          >
            <Undo2Icon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="جلو (Ctrl+Y)"
            disabled={preview || !canRedo}
            onClick={redo}
          >
            <Redo2Icon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>

          <ToolSep />

          <ToolButton
            label="پررنگ (Ctrl+B)"
            disabled={preview}
            onClick={() =>
              apply(wrapSelection(readSelection(), "**", "**", "متن پررنگ"))
            }
          >
            <BoldIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="کج (Ctrl+I)"
            disabled={preview}
            onClick={() =>
              apply(wrapSelection(readSelection(), "*", "*", "متن کج"))
            }
          >
            <ItalicIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>

          <ToolSep />

          <ToolButton
            label="عنوان ۲"
            disabled={preview}
            onClick={() => apply(prefixLines(readSelection(), "## "))}
          >
            <Heading2Icon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="عنوان ۳"
            disabled={preview}
            onClick={() => apply(prefixLines(readSelection(), "### "))}
          >
            <Heading3Icon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>

          <ToolSep />

          <ToolButton
            label="فهرست نقطه‌ای"
            disabled={preview}
            onClick={() => apply(prefixLines(readSelection(), "- "))}
          >
            <ListIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="فهرست شماره‌دار"
            disabled={preview}
            onClick={() => apply(prefixLines(readSelection(), "1. "))}
          >
            <ListOrderedIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="نقل‌قول"
            disabled={preview}
            onClick={() => apply(prefixLines(readSelection(), "> "))}
          >
            <QuoteIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
        </div>

        <div className="md-tool-row">
          <ToolButton
            label="کد درون‌خطی"
            disabled={preview}
            onClick={() =>
              apply(wrapSelection(readSelection(), "`", "`", "کد"))
            }
          >
            <CodeIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="بلوک کد"
            disabled={preview}
            onClick={() => {
              const sel = readSelection();
              const inner = sel.value.slice(sel.start, sel.end) || "کد";
              apply(insertBlock(sel, "```\n" + inner + "\n```"));
            }}
          >
            <CodeXmlIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="پیوند (Ctrl+K)"
            disabled={preview}
            onClick={() => {
              const sel = readSelection();
              const label = sel.value.slice(sel.start, sel.end) || "متن پیوند";
              const snippet = `[${label}](https://)`;
              apply(
                insertInline(sel, snippet, label.length + 3, "https://".length),
              );
            }}
          >
            <LinkIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="خط جداکننده"
            disabled={preview}
            onClick={() => apply(insertBlock(readSelection(), "---"))}
          >
            <MinusIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>
          <ToolButton
            label="شکست خط (br)"
            disabled={preview}
            onClick={() => {
              const sel = readSelection();
              const snippet = "<br>\n";
              apply(insertInline(sel, snippet, snippet.length, 0));
            }}
          >
            <CornerDownLeftIcon size={15} strokeWidth={1.75} aria-hidden />
          </ToolButton>

          <ToolSep />

          <span className="md-tool-upload-slot">
            <ToolButton
              label={
                uploadKind === "image"
                  ? `آپلود تصویر ${toPersianDigits(uploadPercent)}٪`
                  : "آپلود تصویر"
              }
              disabled={preview || uploadKind === "image"}
              busy={uploadKind === "image"}
              onClick={() => {
                setUploadError("");
                imageFileRef.current?.click();
              }}
            >
              {uploadKind === "image" ? (
                <span className="md-tool-upload-ring" aria-hidden>
                  <span className="md-tool-upload-pct">{uploadPctLabel}</span>
                </span>
              ) : (
                <ImageIcon size={15} strokeWidth={1.75} aria-hidden />
              )}
            </ToolButton>
            {uploadKind === "image" ? (
              <button
                type="button"
                className="md-tool-upload-cancel"
                aria-label="لغو آپلود"
                onClick={cancelUpload}
              >
                <XIcon size={12} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </span>

          <span className="md-tool-upload-slot">
            <ToolButton
              label={
                uploadKind === "audio"
                  ? `آپلود صوت ${toPersianDigits(uploadPercent)}٪`
                  : "آپلود ویس / صوت"
              }
              disabled={preview || uploadKind === "audio"}
              busy={uploadKind === "audio"}
              onClick={() => {
                setUploadError("");
                audioFileRef.current?.click();
              }}
            >
              {uploadKind === "audio" ? (
                <span className="md-tool-upload-ring" aria-hidden>
                  <span className="md-tool-upload-pct">{uploadPctLabel}</span>
                </span>
              ) : (
                <MicIcon size={15} strokeWidth={1.75} aria-hidden />
              )}
            </ToolButton>
            {uploadKind === "audio" ? (
              <button
                type="button"
                className="md-tool-upload-cancel"
                aria-label="لغو آپلود"
                onClick={cancelUpload}
              >
                <XIcon size={12} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </span>

          <span className="md-tool-upload-slot">
            <ToolButton
              label={
                uploadKind === "video"
                  ? `آپلود ویدیو ${toPersianDigits(uploadPercent)}٪`
                  : "آپلود ویدیو"
              }
              disabled={preview || uploadKind === "video"}
              busy={uploadKind === "video"}
              onClick={() => {
                setUploadError("");
                videoFileRef.current?.click();
              }}
            >
              {uploadKind === "video" ? (
                <span className="md-tool-upload-ring" aria-hidden>
                  <span className="md-tool-upload-pct">{uploadPctLabel}</span>
                </span>
              ) : (
                <VideoIcon size={15} strokeWidth={1.75} aria-hidden />
              )}
            </ToolButton>
            {uploadKind === "video" ? (
              <button
                type="button"
                className="md-tool-upload-cancel"
                aria-label="لغو آپلود"
                onClick={cancelUpload}
              >
                <XIcon size={12} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {uploadError ? (
        <p className="admin-error admin-upload-error" role="alert">
          {uploadError}
        </p>
      ) : null}

      <input
        ref={imageFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadMedia(file, "image");
        }}
      />
      <input
        ref={audioFileRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg,.aac"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadMedia(file, "audio");
        }}
      />
      <input
        ref={videoFileRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadMedia(file, "video");
        }}
      />

      {preview ? (
        <div
          className="admin-md-preview post-content"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : null}

      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          const start = e.target.selectionStart;
          const end = e.target.selectionEnd;
          onChange(next);
          record({ value: next, start, end }, true);
        }}
        onSelect={(e) => {
          const el = e.currentTarget;
          const tip = historyRef.current[indexRef.current];
          if (tip && tip.value === value) {
            tip.start = el.selectionStart;
            tip.end = el.selectionEnd;
          }
        }}
        onKeyDown={onKeyDown}
        rows={rows}
        dir="rtl"
        className="admin-editor"
        spellCheck
        hidden={preview}
      />
    </div>
  );
}
