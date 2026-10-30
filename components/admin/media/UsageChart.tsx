import type { CloudinaryUsageSummary } from "@/lib/cloudinary";
import { formatBytesFa, toPersianDigits } from "@/lib/persian";

type UsageChartProps = {
  usage: CloudinaryUsageSummary;
};

function formatCreditsFa(value: number): string {
  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return `${toPersianDigits(rounded)} اعتبار`;
}

export function UsageChart({ usage }: UsageChartProps) {
  const pct = Math.min(100, Math.max(0, usage.usedPercent));
  const hue = pct >= 90 ? 8 : pct >= 70 ? 32 : "var(--hue)";

  const isCredits = usage.mode === "credits";
  const remainingCredits =
    isCredits && usage.creditsLimit != null && usage.creditsUsage != null
      ? Math.max(0, usage.creditsLimit - usage.creditsUsage)
      : null;
  const remainingBytes =
    !isCredits && usage.quotaBytes != null
      ? Math.max(0, usage.quotaBytes - usage.usedBytes)
      : null;

  const ariaMetric = isCredits ? "اعتبار پلن" : "فضای ذخیره‌سازی";

  return (
    <div className="admin-media-usage">
      <div
        className="admin-media-chart"
        style={{
          background: `conic-gradient(
            hsl(${hue}, 55%, 42%) 0 ${pct}%,
            color-mix(in oklch, var(--text) 10%, transparent) ${pct}% 100%
          )`,
        }}
        role="img"
        aria-label={`${toPersianDigits(pct)} درصد از ${ariaMetric} استفاده شده`}
      >
        <div className="admin-media-chart-hole">
          <strong>{toPersianDigits(pct)}٪</strong>
        </div>
      </div>

      <dl className="admin-media-usage-stats">
        <div className="admin-media-usage-row">
          <dt>حجم فایل‌ها</dt>
          <dd>{formatBytesFa(usage.usedBytes)}</dd>
        </div>
        {isCredits ? (
          <>
            <div className="admin-media-usage-row">
              <dt>مصرف اعتبار</dt>
              <dd>{formatCreditsFa(usage.creditsUsage ?? 0)}</dd>
            </div>
            <div className="admin-media-usage-row">
              <dt>سقف پلن</dt>
              <dd>{formatCreditsFa(usage.creditsLimit ?? 0)}</dd>
            </div>
            <div className="admin-media-usage-row">
              <dt>باقی‌مانده</dt>
              <dd>{formatCreditsFa(remainingCredits ?? 0)}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="admin-media-usage-row">
              <dt>سقف</dt>
              <dd>{formatBytesFa(usage.quotaBytes ?? 0)}</dd>
            </div>
            <div className="admin-media-usage-row">
              <dt>باقی‌مانده</dt>
              <dd>{formatBytesFa(remainingBytes ?? 0)}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
