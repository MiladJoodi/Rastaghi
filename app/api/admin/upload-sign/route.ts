import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createCloudinaryBrowserUploadSign,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";
import { assertMediaSize, parseMediaKind } from "@/lib/media-limits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary در env پیکربندی نشده است." },
      { status: 503 },
    );
  }

  let body: { kind?: unknown; bytes?: unknown };
  try {
    body = (await request.json()) as { kind?: unknown; bytes?: unknown };
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const kind = parseMediaKind(body.kind);
  if (!kind) {
    return NextResponse.json({ error: "نوع فایل نامعتبر است." }, { status: 400 });
  }

  const bytes = Number(body.bytes);
  try {
    assertMediaSize(bytes, kind);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "حجم نامعتبر است." },
      { status: 400 },
    );
  }

  try {
    const sign = createCloudinaryBrowserUploadSign(kind);
    return NextResponse.json(sign);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ساخت امضا ناموفق بود." },
      { status: 500 },
    );
  }
}
