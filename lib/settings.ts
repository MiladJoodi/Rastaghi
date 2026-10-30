import { unstable_cache } from "next/cache";
import {
  CONTACT_SOCIAL_NETWORKS,
  contactSocialEnabledKey,
  contactSocialUrlKey,
  pickContactSocialLinks,
  type ContactSocialId,
  type ContactSocialLink,
} from "@/lib/contact-social";
import { DEFAULT_FONT_ID, listFontOptions, resolveFontId } from "@/lib/fonts/catalog";
import { hasDatabaseUrl, sql } from "@/lib/db";

export type SettingOption = { value: string; label: string };

const CONTACT_SOCIAL_SETTING_DEFS = CONTACT_SOCIAL_NETWORKS.flatMap(
  (network) => [
    {
      key: contactSocialUrlKey(network.id),
      label: network.label,
      group: "راه‌های ارتباطی",
      defaultValue: "",
      type: "social" as const,
      network: network.id,
      placeholder: network.placeholder,
      enabledKey: contactSocialEnabledKey(network.id),
      clearable: true,
    },
    {
      key: contactSocialEnabledKey(network.id),
      label: `${network.label} — نمایش`,
      group: "راه‌های ارتباطی",
      defaultValue: "1",
      type: "social_enabled" as const,
    },
  ],
);

/**
 * Registry of editable site settings.
 * Add new entries here — they automatically appear in /admin/settings.
 */
const CONTACT_BODY_DEFAULT = [
  "برای ارتباط می‌توانید از راه‌های زیر استفاده کنید.",
  "",
  "ایمیل: hello@example.com",
  "تلگرام: @example",
  "",
  "پیامتان را بفرستید؛ در اولین فرصت پاسخ می‌دهم.",
].join("\n");

export const SETTING_DEFS = [
  {
    key: "home.hero_name",
    label: "نام در بنر",
    group: "صفحه اصلی",
    defaultValue: "محمد رستاقی",
    type: "text" as const,
  },
  {
    key: "home.hero_tagline",
    label: "شعار بنر",
    group: "صفحه اصلی",
    defaultValue: "آموزش نویسندگی، تفکر و توسعه فردی",
    type: "text" as const,
  },
  {
    key: "home.header_avatar",
    label: "عکس دایره‌ای هدر",
    group: "صفحه اصلی",
    defaultValue: "/img/me.png",
    type: "image" as const,
    preview: "avatar" as const,
    clearable: true,
  },
  {
    key: "home.hero_cover",
    label: "عکس کاور بنر",
    group: "صفحه اصلی",
    defaultValue: "/01.jpg",
    type: "image" as const,
    preview: "cover" as const,
    clearable: true,
  },
  {
    key: "home.hero_portrait",
    label: "عکس پرتره هیرو",
    group: "صفحه اصلی",
    defaultValue: "/img/me.png",
    type: "image" as const,
    preview: "portrait" as const,
  },
  {
    key: "home.featured_title",
    label: "عنوان برگزیده‌ها",
    group: "صفحه اصلی",
    defaultValue: "برگزیده‌ها:",
    type: "text" as const,
  },
  {
    key: "contact.title",
    label: "عنوان",
    group: "تماس با ما",
    defaultValue: "تماس با ما",
    type: "text" as const,
  },
  {
    key: "contact.body",
    label: "متن صفحه",
    group: "تماس با ما",
    defaultValue: CONTACT_BODY_DEFAULT,
    type: "textarea" as const,
  },
  ...CONTACT_SOCIAL_SETTING_DEFS,
  {
    key: "font.header",
    label: "فونت هدر",
    group: "قلم‌ها",
    defaultValue: DEFAULT_FONT_ID,
    type: "select" as const,
  },
  {
    key: "font.heading",
    label: "فونت عناوین",
    group: "قلم‌ها",
    defaultValue: DEFAULT_FONT_ID,
    type: "select" as const,
  },
  {
    key: "font.body",
    label: "فونت متن",
    group: "قلم‌ها",
    defaultValue: DEFAULT_FONT_ID,
    type: "select" as const,
  },
  {
    key: "comments.mode",
    label: "وضعیت نظرات",
    group: "نظرات",
    defaultValue: "moderation",
    type: "select" as const,
    options: [
      { value: "moderation", label: "نیاز به تأیید" },
      { value: "open", label: "باز — بدون تأیید" },
      { value: "closed", label: "بسته — ثبت نظر غیرفعال" },
    ],
  },
] as const;

export const COMMENT_MODES = ["moderation", "open", "closed"] as const;
export type CommentMode = (typeof COMMENT_MODES)[number];

export function resolveCommentMode(raw: string | undefined | null): CommentMode {
  if (raw === "open" || raw === "closed" || raw === "moderation") return raw;
  return "moderation";
}

export type SettingKey = (typeof SETTING_DEFS)[number]["key"];

export type SettingImagePreview = "avatar" | "cover" | "portrait";

export type SettingDef = {
  key: string;
  label: string;
  group: string;
  defaultValue: string;
  type?:
    | "text"
    | "textarea"
    | "select"
    | "image"
    | "social"
    | "social_enabled";
  options?: SettingOption[];
  /** Image field preview shape in admin UI */
  preview?: SettingImagePreview;
  /** Allow empty value (e.g. hide header avatar) */
  clearable?: boolean;
  network?: ContactSocialId;
  placeholder?: string;
  enabledKey?: string;
};

const FONT_KEYS = new Set<string>(["font.header", "font.heading", "font.body"]);

export function getSettingDefs(): SettingDef[] {
  const fontOptions = listFontOptions();
  return SETTING_DEFS.flatMap((d) => {
    // Companion enabled flags are saved with social fields; hide from UI list.
    if (d.type === "social_enabled") return [];

    const base: SettingDef = {
      key: d.key,
      label: d.label,
      group: d.group,
      defaultValue: d.defaultValue,
      type: d.type,
    };
    if ("preview" in d && d.preview) {
      base.preview = d.preview;
    }
    if ("clearable" in d && d.clearable) {
      base.clearable = true;
    }
    if ("network" in d && d.network) {
      base.network = d.network;
    }
    if ("placeholder" in d && d.placeholder) {
      base.placeholder = d.placeholder;
    }
    if ("enabledKey" in d && d.enabledKey) {
      base.enabledKey = d.enabledKey;
    }
    if (d.type === "select") {
      if ("options" in d && d.options) {
        base.options = [...d.options];
      } else if (FONT_KEYS.has(d.key)) {
        base.options = fontOptions;
      }
    }
    return [base];
  });
}

function requireDbOrEmpty(): boolean {
  if (hasDatabaseUrl()) return true;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[settings] DATABASE_URL is missing — using defaults.",
    );
  }
  return false;
}

async function loadSettingsMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const def of SETTING_DEFS) {
    map[def.key] = def.defaultValue;
  }
  if (!requireDbOrEmpty()) return map;

  const keys = SETTING_DEFS.map((d) => d.key);
  if (keys.length === 0) return map;

  const rows = (await sql()`
    SELECT key, value FROM site_settings
    WHERE key = ANY (${keys})
  `) as { key: string; value: string }[];

  for (const row of rows) {
    if (FONT_KEYS.has(row.key)) {
      map[row.key] = resolveFontId(row.value);
    } else if (row.key === "comments.mode") {
      map[row.key] = resolveCommentMode(row.value);
    } else {
      map[row.key] = row.value;
    }
  }
  return map;
}

const getSettingsMapCached = unstable_cache(loadSettingsMap, ["site-settings-map-v2"], {
  revalidate: 60,
  tags: ["settings"],
});

export async function getSettingsMap(): Promise<Record<string, string>> {
  return getSettingsMapCached();
}

export async function getSetting(key: SettingKey): Promise<string> {
  const def = SETTING_DEFS.find((d) => d.key === key);
  const fallback = def?.defaultValue ?? "";
  const map = await getSettingsMap();
  return map[key] ?? fallback;
}

export async function setSettings(
  values: Record<string, string>,
): Promise<void> {
  if (!requireDbOrEmpty()) {
    throw new Error("DATABASE_URL is not set.");
  }

  const allowed = new Set(SETTING_DEFS.map((d) => d.key));
  for (const [key, raw] of Object.entries(values)) {
    if (!allowed.has(key)) continue;
    const value = String(raw ?? "").trim();
    const def = SETTING_DEFS.find((d) => d.key === key);
    const clearable = Boolean(
      def &&
        (("clearable" in def && def.clearable) ||
          def.type === "social" ||
          def.type === "social_enabled"),
    );
    let next = value;
    if (!next && !clearable) {
      next = def?.defaultValue || "";
    }
    if (def?.type === "social_enabled") {
      next = next === "1" ? "1" : "0";
    }
    if (FONT_KEYS.has(key)) {
      next = resolveFontId(next);
    }
    if (key === "comments.mode") {
      next = resolveCommentMode(next);
    }
    await sql()`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (${key}, ${next}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `;
  }
}

export async function getCommentMode(): Promise<CommentMode> {
  const map = await getSettingsMap();
  return resolveCommentMode(map["comments.mode"]);
}

export async function getContactSocialLinks(): Promise<ContactSocialLink[]> {
  const map = await getSettingsMap();
  return pickContactSocialLinks(map);
}
