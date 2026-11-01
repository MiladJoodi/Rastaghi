import {
  assertMediaSize,
  type MediaKind,
} from "@/lib/media-limits";

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0–100 while bytes are uploading to Cloudinary */
  percent: number;
};

export type AdminUploadResult = {
  url: string;
  publicId?: string;
  kind: MediaKind;
};

export class UploadAbortedError extends Error {
  constructor(message = "آپلود لغو شد.") {
    super(message);
    this.name = "UploadAbortedError";
  }
}

export function isUploadAborted(err: unknown): boolean {
  return err instanceof UploadAbortedError;
}

type SignPayload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: "image" | "video";
  error?: string;
};

/**
 * Direct browser → Cloudinary upload with real byte progress + AbortSignal cancel.
 * Gets a short-lived signed payload from /api/admin/upload-sign first.
 */
export async function uploadAdminMedia(
  file: File,
  kind: MediaKind,
  options: {
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<AdminUploadResult> {
  assertMediaSize(file.size, kind);

  if (options.signal?.aborted) {
    throw new UploadAbortedError();
  }

  const signRes = await fetch("/api/admin/upload-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, bytes: file.size }),
    signal: options.signal,
  });
  const sign = (await signRes.json()) as SignPayload;
  if (!signRes.ok || !sign.cloudName || !sign.signature) {
    throw new Error(sign.error || "آماده‌سازی آپلود ناموفق بود.");
  }

  if (options.signal?.aborted) {
    throw new UploadAbortedError();
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sign.apiKey);
    form.append("timestamp", String(sign.timestamp));
    form.append("signature", sign.signature);
    form.append("folder", sign.folder);

    const cleanup = () => {
      options.signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      xhr.abort();
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort);
    }

    // Start at 0 so UI does not jump straight to "done"
    options.onProgress?.({ loaded: 0, total: file.size, percent: 0 });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const percent = Math.min(
        100,
        Math.max(0, Math.round((event.loaded / event.total) * 100)),
      );
      options.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent,
      });
    };

    xhr.onload = () => {
      cleanup();
      let data: {
        secure_url?: string;
        public_id?: string;
        error?: { message?: string };
      } = {};
      try {
        data = JSON.parse(xhr.responseText || "{}") as typeof data;
      } catch {
        reject(new Error("پاسخ آپلود نامعتبر بود."));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || !data.secure_url) {
        reject(
          new Error(
            data.error?.message || "آپلود به Cloudinary ناموفق بود.",
          ),
        );
        return;
      }
      options.onProgress?.({
        loaded: file.size,
        total: file.size,
        percent: 100,
      });
      resolve({
        url: data.secure_url,
        publicId: data.public_id,
        kind,
      });
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("خطا در ارتباط هنگام آپلود."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortedError());
    };

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(sign.cloudName)}/${sign.resourceType}/upload`;
    xhr.open("POST", endpoint);
    xhr.send(form);
  });
}
