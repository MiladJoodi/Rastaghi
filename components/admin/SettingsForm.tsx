"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSettingsAction } from "@/app/admin/actions";
import { UploadProgressBar } from "@/components/admin/UploadProgressBar";
import { PendingButton } from "@/components/PendingButton";
import { ThemeToggle } from "@/components/ThemeControls";
import { FoldersIcon } from "@/components/lucide/FoldersIcon";
import {
  isUploadAborted,
  uploadAdminMedia,
} from "@/lib/admin-upload-client";
import type { SettingDef } from "@/lib/settings";

type SettingsFormProps = {
  defs: SettingDef[];
  values: Record<string, string>;
};

function SettingsImageField({
  def,
  initialValue,
}: {
  def: SettingDef;
  initialValue: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const clearable = Boolean(def.clearable);
  const [url, setUrl] = useState(() =>
    clearable ? initialValue : initialValue || def.defaultValue,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [error, setError] = useState("");
  const preview = def.preview ?? "portrait";
  const previewClass = `admin-settings-image-preview admin-settings-image-preview--${preview}`;

  function cancelUpload() {
    uploadAbortRef.current?.abort();
  }

  async function uploadFile(file: File) {
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setUploading(true);
    setUploadPercent(0);
    setUploadProcessing(false);
    setError("");
    try {
      const data = await uploadAdminMedia(file, "image", {
        signal: controller.signal,
        onProgress: (p) => {
          setUploadPercent(p.percent);
          if (p.percent >= 100) setUploadProcessing(true);
        },
      });
      setUrl(data.url);
    } catch (err) {
      if (!isUploadAborted(err)) {
        setError(err instanceof Error ? err.message : "آپلود ناموفق بود.");
      }
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
      }
      setUploading(false);
      setUploadPercent(0);
      setUploadProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="admin-settings-field admin-settings-image-field">
      <span className="admin-settings-label" id={`${inputId}-label`}>
        {def.label}
      </span>
      <input type="hidden" name={def.key} value={url} />
      <div className="admin-settings-image-row">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={previewClass} />
        ) : (
          <div
            className={`${previewClass} admin-settings-image-preview--empty`}
            aria-hidden
          />
        )}
        <div className="admin-settings-image-actions">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            aria-labelledby={`${inputId}-label`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <button
            type="button"
            className="admin-text-btn"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "در حال آپلود…" : "انتخاب تصویر"}
          </button>
          {clearable && url ? (
            <button
              type="button"
              className="admin-text-btn admin-text-btn-danger"
              disabled={uploading}
              onClick={() => {
                setUrl("");
                setError("");
              }}
            >
              حذف
            </button>
          ) : null}
          {!clearable && url && url !== def.defaultValue ? (
            <button
              type="button"
              className="admin-text-btn"
              disabled={uploading}
              onClick={() => {
                setUrl(def.defaultValue);
                setError("");
              }}
            >
              بازگشت به پیش‌فرض
            </button>
          ) : null}
          {clearable && !url && def.defaultValue ? (
            <button
              type="button"
              className="admin-text-btn"
              disabled={uploading}
              onClick={() => {
                setUrl(def.defaultValue);
                setError("");
              }}
            >
              بازگردانی پیش‌فرض
            </button>
          ) : null}
        </div>
      </div>
      {uploading ? (
        <UploadProgressBar
          percent={uploadPercent}
          processing={uploadProcessing}
          label="آپلود تصویر…"
          onCancel={cancelUpload}
        />
      ) : null}
      {error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SettingsSocialField({
  def,
  initialUrl,
  initialEnabled,
}: {
  def: SettingDef;
  initialUrl: string;
  initialEnabled: boolean;
}) {
  const inputId = useId();
  const enabledKey = def.enabledKey ?? `${def.key}_enabled`;

  return (
    <div className="admin-settings-field admin-settings-social-field">
      <div className="admin-settings-social-row">
        <input
          type="checkbox"
          name={enabledKey}
          value="1"
          defaultChecked={initialEnabled}
          className="admin-settings-social-check"
          aria-label={`نمایش ${def.label}`}
          title="روشن / خاموش"
        />
        <label className="admin-settings-label" htmlFor={inputId}>
          {def.label}
        </label>
        <input
          id={inputId}
          name={def.key}
          type="text"
          dir="ltr"
          className="admin-settings-social-url latin-digits"
          defaultValue={initialUrl}
          placeholder={def.placeholder ?? "@username"}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export function SettingsForm({ defs, values }: SettingsFormProps) {
  const router = useRouter();
  const [state, action] = useActionState(saveSettingsAction, undefined);
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
    if (okTimer.current) clearTimeout(okTimer.current);
    okTimer.current = setTimeout(() => {
      /* toast is inline; no-op clear */
    }, 2500);
    return () => {
      if (okTimer.current) clearTimeout(okTimer.current);
    };
  }, [state?.ok, router]);

  const groups = new Map<string, SettingDef[]>();
  for (const def of defs) {
    const list = groups.get(def.group) ?? [];
    list.push(def);
    groups.set(def.group, list);
  }

  return (
    <form action={action} className="admin-settings-form">
      <div className="admin-settings-theme">
        <ThemeToggle variant="settings" />
      </div>
      <Link href="/admin/media" className="admin-settings-media-link">
        <FoldersIcon size={18} strokeWidth={1.75} aria-hidden />
        <span>
          <strong>مدیریت فایل‌ها</strong>
          <span className="admin-muted">حجم Cloudinary و حذف فایل‌ها</span>
        </span>
      </Link>
      {[...groups.entries()].map(([group, items]) => (
        <details key={group} className="admin-settings-group">
          <summary className="admin-settings-group-summary">{group}</summary>
          <div className="admin-settings-group-body">
            {items.map((def) =>
              def.type === "image" ? (
                <SettingsImageField
                  key={def.key}
                  def={def}
                  initialValue={
                    values[def.key] !== undefined
                      ? values[def.key]!
                      : def.defaultValue
                  }
                />
              ) : def.type === "social" ? (
                <SettingsSocialField
                  key={def.key}
                  def={def}
                  initialUrl={values[def.key] ?? ""}
                  initialEnabled={
                    (values[def.enabledKey ?? ""] ?? "1") === "1"
                  }
                />
              ) : (
                <label key={def.key} className="admin-settings-field">
                  <span className="admin-settings-label">{def.label}</span>
                  {def.type === "select" ? (
                    <select
                      name={def.key}
                      defaultValue={values[def.key] ?? def.defaultValue}
                    >
                      {(def.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : def.type === "textarea" ? (
                    <textarea
                      name={def.key}
                      rows={8}
                      defaultValue={values[def.key] ?? def.defaultValue}
                      placeholder={def.defaultValue}
                      autoComplete="off"
                    />
                  ) : (
                    <input
                      name={def.key}
                      type="text"
                      defaultValue={values[def.key] ?? def.defaultValue}
                      placeholder={def.defaultValue}
                      autoComplete="off"
                    />
                  )}
                </label>
              ),
            )}
          </div>
        </details>
      ))}

      {state?.error ? (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="admin-settings-ok" role="status">
          ذخیره شد.
        </p>
      ) : null}

      <div className="admin-settings-actions">
        <PendingButton pendingLabel="در حال ذخیره…">ذخیره تنظیمات</PendingButton>
      </div>
    </form>
  );
}
