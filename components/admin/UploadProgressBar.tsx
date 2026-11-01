"use client";

import { toPersianDigits } from "@/lib/persian";

type UploadProgressBarProps = {
  percent: number;
  /** Shown while waiting for server after bytes reached 100% */
  processing?: boolean;
  label?: string;
  onCancel?: () => void;
  /** Slim single-row bar (editor toolbar). */
  compact?: boolean;
};

export function UploadProgressBar({
  percent,
  processing = false,
  label = "آپلود…",
  onCancel,
  compact = false,
}: UploadProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const statusText = processing
    ? "پردازش…"
    : compact
      ? `${toPersianDigits(pct)}٪`
      : `${label} ${toPersianDigits(pct)}٪`;

  return (
    <div
      className={
        compact
          ? "admin-upload-progress admin-upload-progress--compact"
          : "admin-upload-progress"
      }
      role="status"
      aria-live="polite"
    >
      <div
        className="admin-upload-progress-track"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        role="progressbar"
        aria-label={processing ? "در حال پردازش" : `${label} ${pct}٪`}
      >
        <div
          className="admin-upload-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="admin-upload-progress-label">{statusText}</span>
      {onCancel ? (
        <button
          type="button"
          className="admin-text-btn admin-upload-progress-cancel"
          onClick={onCancel}
        >
          لغو
        </button>
      ) : null}
    </div>
  );
}
