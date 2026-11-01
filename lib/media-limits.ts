/** Shared media limits — safe to import from client and server. */

export type MediaKind = "image" | "audio" | "video";

export const MEDIA_MAX_BYTES: Record<MediaKind, number> = {
  image: 8 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  image: "تصویر",
  audio: "صوت",
  video: "ویدیو",
};

export const MEDIA_LIMIT_LABEL: Record<MediaKind, string> = {
  image: "۸ مگابایت",
  audio: "۱۰۰ مگابایت",
  video: "۱۰۰ مگابایت",
};

export function parseMediaKind(value: unknown): MediaKind | null {
  if (value === "image" || value === "audio" || value === "video") {
    return value;
  }
  return null;
}

export function assertMediaSize(bytes: number, kind: MediaKind) {
  const max = MEDIA_MAX_BYTES[kind];
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > max) {
    throw new Error(
      `حجم ${MEDIA_KIND_LABEL[kind]} باید کمتر از ${MEDIA_LIMIT_LABEL[kind]} باشد.`,
    );
  }
}

export function cloudinaryResourceType(
  kind: MediaKind,
): "image" | "video" {
  // Cloudinary stores audio under the video resource type.
  return kind === "image" ? "image" : "video";
}
