export const CONTACT_SOCIAL_NETWORKS = [
  {
    id: "telegram",
    label: "تلگرام",
    placeholder: "@mohammad_rastaghi",
  },
  {
    id: "instagram",
    label: "اینستاگرام",
    placeholder: "@mohammad_rastaghi",
  },
  {
    id: "whatsapp",
    label: "واتساپ",
    placeholder: "989123456789",
  },
  {
    id: "x",
    label: "ایکس (X)",
    placeholder: "@mohammad_rastaghi",
  },
] as const;

export type ContactSocialId = (typeof CONTACT_SOCIAL_NETWORKS)[number]["id"];

export function contactSocialUrlKey(id: ContactSocialId): string {
  return `contact.social.${id}`;
}

export function contactSocialEnabledKey(id: ContactSocialId): string {
  return `contact.social.${id}_enabled`;
}

export type ContactSocialLink = {
  id: ContactSocialId;
  label: string;
  href: string;
};

function stripHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/^\/+/, "");
}

function extractPathAfterHost(value: string, hosts: string[]): string | null {
  const lower = value.toLowerCase();
  for (const host of hosts) {
    const idx = lower.indexOf(host);
    if (idx === -1) continue;
    let path = value.slice(idx + host.length).replace(/^\/+/, "");
    path = path.split(/[?#]/)[0] ?? "";
    path = path.replace(/^@+/, "").replace(/\/+$/, "");
    return path || null;
  }
  return null;
}

/** Build a clickable profile / chat URL from a stored handle, phone, or full URL. */
export function resolveSocialHref(
  id: ContactSocialId,
  raw: string,
): string {
  const value = raw.trim();
  if (!value) return "";

  if (id === "whatsapp") {
    if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
      return value.startsWith("//") ? `https:${value}` : value;
    }
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "";
    return `https://wa.me/${digits}`;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  const hosts: Record<ContactSocialId, string[]> = {
    telegram: ["t.me/", "telegram.me/", "telegram.dog/"],
    instagram: ["instagram.com/", "www.instagram.com/"],
    whatsapp: ["wa.me/", "api.whatsapp.com/"],
    x: ["x.com/", "twitter.com/", "www.x.com/", "www.twitter.com/"],
  };

  const fromHost = extractPathAfterHost(value, hosts[id]);
  const handle = stripHandle(fromHost ?? value);
  if (!handle) return "";

  switch (id) {
    case "telegram":
      return `https://t.me/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    default:
      return "";
  }
}

export function pickContactSocialLinks(
  map: Record<string, string>,
): ContactSocialLink[] {
  const links: ContactSocialLink[] = [];
  for (const network of CONTACT_SOCIAL_NETWORKS) {
    const raw = (map[contactSocialUrlKey(network.id)] ?? "").trim();
    // Empty handle → hidden. Checkbox off → hidden. Missing flag defaults to on.
    const enabledRaw = map[contactSocialEnabledKey(network.id)];
    const enabled = enabledRaw == null ? true : enabledRaw === "1";
    if (!enabled || !raw) continue;
    const href = resolveSocialHref(network.id, raw);
    if (!href) continue;
    links.push({
      id: network.id,
      label: network.label,
      href,
    });
  }
  return links;
}
