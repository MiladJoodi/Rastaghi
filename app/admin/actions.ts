"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkPassword,
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
} from "@/lib/auth";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/categories";
import {
  deletePost,
  getPostSlugs,
  insertPost,
  nextNumericSlug,
  setPostPublished,
  slugifyTitle,
  tagUrl,
  uniqueSlug,
  updatePost,
} from "@/lib/posts";
import { getSettingDefs, setSettings } from "@/lib/settings";
import {
  createTag,
  deleteTag,
  ensureTagsExist,
  normalizeTagName,
  updateTag,
} from "@/lib/tags";

function requireAuthOrThrow(ok: boolean) {
  if (!ok) {
    throw new Error("Unauthorized");
  }
}

/** Invalidate admin list + public pages so redirects show fresh data. */
function revalidateAfterPostChange(options: {
  slug: string;
  previousSlug?: string;
  tags?: string[];
}) {
  const { slug, previousSlug, tags = [] } = options;

  revalidatePath("/admin");
  revalidatePath("/admin/new");
  revalidatePath("/admin/[slug]/edit", "page");

  revalidatePath("/");
  revalidatePath("/all");
  revalidatePath("/tags");
  revalidatePath("/categories");
  revalidatePath("/[slug]", "page");
  revalidatePath("/tag/[slug]", "page");

  revalidatePath(`/${slug}`);
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/${previousSlug}`);
  }
  for (const tag of tags) {
    revalidatePath(tagUrl(tag));
  }
}

function parseList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,،]/)) {
    const name = normalizeTagName(part);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    return { error: "رمز عبور اشتباه است." };
  }
  await createAdminSession();
  const next = String(formData.get("next") ?? "/admin");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function savePostAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  requireAuthOrThrow(await isAdminAuthenticated());

  const title = String(formData.get("title") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const excerpt = String(formData.get("excerpt") ?? "").trim() || undefined;
  const tags = parseList(formData.get("tags"));
  const category = String(formData.get("category") ?? "").trim();
  const categories = category ? [category] : [];
  const originalSlug = String(formData.get("originalSlug") ?? "").trim();
  const intent = String(formData.get("intent") ?? "publish").trim();
  const published = intent !== "draft";
  const featured = String(formData.get("featured") ?? "") === "on";

  if (!title) return { error: "عنوان الزامی است." };
  if (!body.trim()) return { error: "متن پست الزامی است." };
  if (!category) return { error: "انتخاب دسته‌بندی الزامی است." };
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(date)) {
    return { error: "تاریخ نامعتبر است." };
  }

  const taken = await getPostSlugs();
  const exclude = originalSlug || undefined;
  if (!slug) {
    slug = nextNumericSlug(taken, exclude);
  } else {
    const base = slugifyTitle(slug.replace(/_/g, "-"));
    slug = uniqueSlug(base || nextNumericSlug(taken, exclude), taken, exclude);
  }

  if (!slug) return { error: "اسلاگ معتبر نیست." };

  const payload = {
    slug,
    title,
    date,
    tags,
    categories,
    excerpt,
    body,
    published,
    featured,
  };

  try {
    await ensureTagsExist(tags);
    if (originalSlug) {
      await updatePost(originalSlug, payload);
    } else {
      await insertPost(payload);
    }
  } catch (err) {
    console.error(err);
    return { error: "ذخیره در دیتابیس ناموفق بود." };
  }

  revalidateAfterPostChange({
    slug,
    previousSlug: originalSlug || undefined,
    tags,
  });
  revalidatePath("/admin/tags");

  redirect("/admin");
}

export async function deletePostAction(formData: FormData): Promise<void> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;
  await deletePost(slug);
  revalidateAfterPostChange({ slug });
  redirect("/admin");
}

export async function setPostPublishedAction(
  formData: FormData,
): Promise<void> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const slug = String(formData.get("slug") ?? "").trim();
  const published = String(formData.get("published") ?? "") === "true";
  if (!slug) return;
  await setPostPublished(slug, published);
  revalidateAfterPostChange({ slug });
}

function revalidateCategoryPaths() {
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/admin/new");
  revalidatePath("/admin/[slug]/edit", "page");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/[slug]", "page");
}

function revalidateTagPaths() {
  revalidatePath("/admin/tags");
  revalidatePath("/tags");
  revalidatePath("/tag/[slug]", "page");
  revalidatePath("/admin/new");
  revalidatePath("/admin/[slug]/edit", "page");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/[slug]", "page");
}

export async function createCategoryAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const name = String(formData.get("name") ?? "").trim();
  const showOnHome = String(formData.get("show_on_home") ?? "") === "on";
  const showInHeader = String(formData.get("show_in_header") ?? "") === "on";
  const homeItemMode =
    String(formData.get("home_item_mode") ?? "title") === "body"
      ? "body"
      : "title";
  if (!name) return { error: "نام دسته‌بندی را وارد کن." };
  try {
    await createCategory(name, showOnHome, homeItemMode, showInHeader);
  } catch (err) {
    console.error(err);
    return { error: "ساخت دسته‌بندی ناموفق بود (شاید تکراری است)." };
  }
  revalidateCategoryPaths();
  return { ok: true };
}

export async function updateCategoryAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const showOnHome = String(formData.get("show_on_home") ?? "") === "on";
  const showInHeader = String(formData.get("show_in_header") ?? "") === "on";
  const homeItemMode =
    String(formData.get("home_item_mode") ?? "title") === "body"
      ? "body"
      : "title";
  if (!Number.isFinite(id)) return { error: "دسته نامعتبر است." };
  if (!name) return { error: "نام دسته‌بندی را وارد کن." };
  try {
    await updateCategory(id, name, showOnHome, homeItemMode, showInHeader);
  } catch (err) {
    console.error(err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "ویرایش دسته‌بندی ناموفق بود.",
    };
  }
  revalidateCategoryPaths();
  return { ok: true };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await deleteCategory(id);
  revalidateCategoryPaths();
  redirect("/admin/categories");
}

export async function createTagAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const name = String(formData.get("name") ?? "");
  if (!normalizeTagName(name)) return { error: "نام برچسب را وارد کن." };
  try {
    await createTag(name);
  } catch (err) {
    console.error(err);
    return { error: "ساخت برچسب ناموفق بود (شاید تکراری است)." };
  }
  revalidateTagPaths();
  return { ok: true };
}

export async function updateTagAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "");
  if (!Number.isFinite(id)) return { error: "برچسب نامعتبر است." };
  if (!normalizeTagName(name)) return { error: "نام برچسب را وارد کن." };
  try {
    await updateTag(id, name);
  } catch (err) {
    console.error(err);
    return {
      error:
        err instanceof Error ? err.message : "ویرایش برچسب ناموفق بود.",
    };
  }
  revalidateTagPaths();
  return { ok: true };
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  requireAuthOrThrow(await isAdminAuthenticated());
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await deleteTag(id);
  revalidateTagPaths();
  redirect("/admin/tags");
}

export async function saveSettingsAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  requireAuthOrThrow(await isAdminAuthenticated());

  const values: Record<string, string> = {};
  for (const def of getSettingDefs()) {
    values[def.key] = String(formData.get(def.key) ?? "");
    if (def.type === "social" && def.enabledKey) {
      const raw = formData.get(def.enabledKey);
      values[def.enabledKey] =
        raw === "1" || raw === "on" || raw === "true" ? "1" : "0";
    }
  }

  try {
    await setSettings(values);
  } catch (err) {
    console.error(err);
    return { error: "ذخیره تنظیمات ناموفق بود." };
  }

  revalidateTag("settings", { expire: 0 });
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/contact");
  return { ok: true };
}
