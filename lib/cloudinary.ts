import { v2 as cloudinary } from "cloudinary";

export type MediaKind = "image" | "audio" | "video";

const ALLOWED_TYPES: Record<MediaKind, Set<string>> = {
  image: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  audio: new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/webm",
  ]),
  video: new Set([
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
  ]),
};

export const CLOUDINARY_MAX_BYTES: Record<MediaKind, number> = {
  image: 8 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

const KIND_LABEL: Record<MediaKind, string> = {
  image: "تصویر",
  audio: "صوت",
  video: "ویدیو",
};

const KIND_LIMIT_LABEL: Record<MediaKind, string> = {
  image: "۸ مگابایت",
  audio: "۱۰۰ مگابایت",
  video: "۱۰۰ مگابایت",
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set in environment.`);
  }
  return value;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function configure() {
  cloudinary.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
    secure: true,
  });
}

export function parseMediaKind(value: unknown): MediaKind | null {
  if (value === "image" || value === "audio" || value === "video") {
    return value;
  }
  return null;
}

function mimeFromExtension(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return "";
  }
}

export function assertAllowedMedia(file: File, kind: MediaKind) {
  const mime = mimeFromExtension(file);
  if (!ALLOWED_TYPES[kind].has(mime)) {
    if (kind === "image") {
      throw new Error("فقط JPEG، PNG، WebP یا GIF مجاز است.");
    }
    if (kind === "audio") {
      throw new Error("فقط MP3، M4A، AAC، WAV، OGG یا WebM صوتی مجاز است.");
    }
    throw new Error("فقط MP4، WebM یا MOV مجاز است.");
  }
  const max = CLOUDINARY_MAX_BYTES[kind];
  if (file.size <= 0 || file.size > max) {
    throw new Error(
      `حجم ${KIND_LABEL[kind]} باید کمتر از ${KIND_LIMIT_LABEL[kind]} باشد.`,
    );
  }
}

/** @deprecated Prefer assertAllowedMedia(file, "image") */
export function assertAllowedImage(file: File) {
  assertAllowedMedia(file, "image");
}

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  resourceType: string;
  width?: number;
  height?: number;
};

export async function uploadMediaToCloudinary(
  file: File,
  kind: MediaKind,
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary پیکربندی نشده است.");
  }

  assertAllowedMedia(file, kind);
  configure();

  const folder = process.env.CLOUDINARY_FOLDER?.trim() || "rastaghi";
  const bytes = Buffer.from(await file.arrayBuffer());
  // Cloudinary stores audio under the video resource type.
  const resourceType = kind === "image" ? "image" : "video";

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
    resource_type?: string;
    width?: number;
    height?: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        overwrite: false,
        unique_filename: true,
      },
      (error, uploaded) => {
        if (error || !uploaded?.secure_url || !uploaded.public_id) {
          reject(error ?? new Error("آپلود ناموفق بود."));
          return;
        }
        resolve({
          secure_url: uploaded.secure_url,
          public_id: uploaded.public_id,
          resource_type: uploaded.resource_type,
          width: uploaded.width,
          height: uploaded.height,
        });
      },
    );
    stream.end(bytes);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type || resourceType,
    width: result.width,
    height: result.height,
  };
}

export async function uploadImageToCloudinary(
  file: File,
): Promise<{ url: string; publicId: string; width?: number; height?: number }> {
  const uploaded = await uploadMediaToCloudinary(file, "image");
  return {
    url: uploaded.url,
    publicId: uploaded.publicId,
    width: uploaded.width,
    height: uploaded.height,
  };
}

const AUDIO_FORMATS = new Set([
  "mp3",
  "m4a",
  "aac",
  "wav",
  "ogg",
  "flac",
  "mpga",
  "wma",
]);

const GIB = 1024 * 1024 * 1024;

/**
 * Optional soft quota override (bytes).
 * When set, admin UI uses this instead of Cloudinary plan limits.
 */
export function getCloudinaryQuotaBytesOverride(): number | null {
  const raw = process.env.CLOUDINARY_STORAGE_LIMIT_GB?.trim();
  if (!raw) return null;
  const gb = Number(raw);
  if (!Number.isFinite(gb) || gb <= 0) return null;
  return gb * GIB;
}

export function cloudinaryFolder(): string {
  return process.env.CLOUDINARY_FOLDER?.trim() || "rastaghi";
}

export type CloudinaryUsageSummary = {
  usedBytes: number;
  /** 0–100 of the active plan metric */
  usedPercent: number;
  mode: "bytes" | "credits";
  /** Byte ceiling when mode is "bytes" */
  quotaBytes: number | null;
  /** Credit usage when mode is "credits" */
  creditsUsage: number | null;
  creditsLimit: number | null;
  plan: string | null;
};

function roundPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export async function getCloudinaryUsage(): Promise<CloudinaryUsageSummary> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary پیکربندی نشده است.");
  }
  configure();
  const usage = (await cloudinary.api.usage()) as {
    plan?: string;
    storage?: { usage?: number; limit?: number; used_percent?: number };
    credits?: { usage?: number; limit?: number; used_percent?: number };
  };

  const usedBytes = Number(usage.storage?.usage) || 0;
  const plan = usage.plan?.trim() || null;
  const overrideQuota = getCloudinaryQuotaBytesOverride();

  if (overrideQuota != null) {
    return {
      usedBytes,
      quotaBytes: overrideQuota,
      usedPercent: roundPercent((usedBytes / overrideQuota) * 100),
      mode: "bytes",
      creditsUsage: null,
      creditsLimit: null,
      plan,
    };
  }

  const storageLimit = Number(usage.storage?.limit);
  if (Number.isFinite(storageLimit) && storageLimit > 0) {
    const apiPct = Number(usage.storage?.used_percent);
    return {
      usedBytes,
      quotaBytes: storageLimit,
      usedPercent: Number.isFinite(apiPct)
        ? roundPercent(apiPct)
        : roundPercent((usedBytes / storageLimit) * 100),
      mode: "bytes",
      creditsUsage: null,
      creditsLimit: null,
      plan,
    };
  }

  const creditsLimit = Number(usage.credits?.limit);
  const creditsUsage = Number(usage.credits?.usage);
  if (Number.isFinite(creditsLimit) && creditsLimit > 0) {
    const apiPct = Number(usage.credits?.used_percent);
    const used =
      Number.isFinite(creditsUsage) && creditsUsage >= 0 ? creditsUsage : 0;
    return {
      usedBytes,
      quotaBytes: null,
      usedPercent: Number.isFinite(apiPct)
        ? roundPercent(apiPct)
        : roundPercent((used / creditsLimit) * 100),
      mode: "credits",
      creditsUsage: used,
      creditsLimit,
      plan,
    };
  }

  // Last resort: treat 1 credit ≈ 1 GiB if we somehow only have storage bytes
  const fallbackQuota = 25 * GIB;
  return {
    usedBytes,
    quotaBytes: fallbackQuota,
    usedPercent: roundPercent((usedBytes / fallbackQuota) * 100),
    mode: "bytes",
    creditsUsage: null,
    creditsLimit: null,
    plan,
  };
}

export type CloudinaryMediaItem = {
  publicId: string;
  resourceType: "image" | "video";
  kind: MediaKind;
  url: string;
  bytes: number;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
  displayName: string;
};

type RawResource = {
  public_id: string;
  secure_url?: string;
  url?: string;
  bytes?: number;
  format?: string;
  resource_type?: string;
  width?: number;
  height?: number;
  duration?: number;
  created_at?: string;
};

function classifyKind(row: RawResource): MediaKind {
  const format = (row.format || "").toLowerCase();
  if (row.resource_type === "image") return "image";
  if (AUDIO_FORMATS.has(format)) return "audio";
  // Audio webm/ogg often has no meaningful frame size
  if (
    (format === "webm" || format === "ogg") &&
    (!row.width || row.width < 2)
  ) {
    return "audio";
  }
  return "video";
}

function displayNameFromPublicId(publicId: string, format?: string): string {
  const base = publicId.split("/").pop() || publicId;
  if (format && !base.toLowerCase().endsWith(`.${format.toLowerCase()}`)) {
    return `${base}.${format}`;
  }
  return base;
}

function mapResource(row: RawResource): CloudinaryMediaItem {
  const kind = classifyKind(row);
  const resourceType: "image" | "video" =
    row.resource_type === "image" ? "image" : "video";
  const format = row.format || "";
  return {
    publicId: row.public_id,
    resourceType,
    kind,
    url: row.secure_url || row.url || "",
    bytes: Number(row.bytes) || 0,
    format,
    width: row.width,
    height: row.height,
    duration: row.duration,
    createdAt: row.created_at || new Date(0).toISOString(),
    displayName: displayNameFromPublicId(row.public_id, format),
  };
}

export type ListCloudinaryMediaResult = {
  items: CloudinaryMediaItem[];
  nextCursor: string | null;
};

/**
 * List assets in the configured folder, filtered by media kind.
 * Audio lives under Cloudinary `video` resource type.
 */
export async function listCloudinaryMedia(options: {
  kind: MediaKind;
  nextCursor?: string | null;
  maxResults?: number;
}): Promise<ListCloudinaryMediaResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary پیکربندی نشده است.");
  }
  configure();

  const folder = cloudinaryFolder();
  const maxResults = Math.min(Math.max(options.maxResults ?? 50, 1), 100);
  const resourceType = options.kind === "image" ? "image" : "video";

  // Pull a larger page then filter so audio/video tabs stay useful.
  const fetchSize =
    options.kind === "image" ? maxResults : Math.min(maxResults * 3, 100);

  const result = (await cloudinary.api.resources({
    type: "upload",
    resource_type: resourceType,
    prefix: `${folder}/`,
    max_results: fetchSize,
    next_cursor: options.nextCursor || undefined,
  })) as {
    resources?: RawResource[];
    next_cursor?: string;
  };

  const mapped = (result.resources ?? []).map(mapResource);
  const items =
    options.kind === "image"
      ? mapped
      : mapped
          .filter((item) => item.kind === options.kind)
          .slice(0, maxResults);

  return {
    items,
    nextCursor: result.next_cursor ?? null,
  };
}

export async function deleteCloudinaryMedia(
  targets: { publicId: string; resourceType: "image" | "video" }[],
): Promise<{ deleted: string[]; failed: string[] }> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary پیکربندی نشده است.");
  }
  if (targets.length === 0) {
    return { deleted: [], failed: [] };
  }
  configure();

  const byType = new Map<"image" | "video", string[]>();
  for (const t of targets) {
    const list = byType.get(t.resourceType) ?? [];
    list.push(t.publicId);
    byType.set(t.resourceType, list);
  }

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const [resourceType, ids] of byType) {
    // Cloudinary accepts up to 100 ids per call
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const result = (await cloudinary.api.delete_resources(chunk, {
        resource_type: resourceType,
        type: "upload",
      })) as { deleted?: Record<string, string> };

      const map = result.deleted ?? {};
      for (const id of chunk) {
        if (map[id] === "deleted") deleted.push(id);
        else failed.push(id);
      }
    }
  }

  return { deleted, failed };
}

