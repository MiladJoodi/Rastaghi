import {
  categoryUrl,
  getHeaderCategories,
  getHomeCategories,
} from "@/lib/categories";
import { formatJalali } from "@/lib/jalali";
import {
  getPostBodiesBySlugs,
  getPostSummaries,
  getProjects,
  postUrl,
} from "@/lib/posts";
import { getSetting } from "@/lib/settings";
import type {
  HomeLinkItem,
  HomeNavItem,
  HomeProjectCard,
  HomeSection,
} from "@/lib/home-fake";
import { homeHero as homeHeroDefaults } from "@/lib/home-fake";

export type HomeHeroContent = {
  name: string;
  tagline: string;
  portrait: string;
  /** Hero cover / background; empty = no cover image */
  cover: string;
  /** Circular header avatar; empty = hidden */
  avatar: string;
};

export async function getHomeHero(): Promise<HomeHeroContent> {
  const [name, tagline, portrait, cover, avatar] = await Promise.all([
    getSetting("home.hero_name"),
    getSetting("home.hero_tagline"),
    getSetting("home.hero_portrait"),
    getSetting("home.hero_cover"),
    getSetting("home.header_avatar"),
  ]);
  return {
    name: name.trim() || homeHeroDefaults.name,
    tagline: tagline.trim() || homeHeroDefaults.tagline,
    portrait: portrait.trim() || homeHeroDefaults.portrait,
    cover: cover.trim(),
    avatar: avatar.trim(),
  };
}

export async function getHomeNavItems(): Promise<HomeNavItem[]> {
  const headerCats = await getHeaderCategories();
  const items: HomeNavItem[] = [{ label: "خانه", href: "/" }];
  for (const cat of headerCats) {
    items.push({
      label: cat.name,
      href: categoryUrl(cat.slug),
    });
  }
  items.push({ label: "تماس با ما", href: "/contact" });
  return items;
}

/** Strip light markdown/markup so short posts can show as plain line text. */
function plainBodyText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~#>]+/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postToItem(
  post: {
    slug: string;
    title: string;
    date: string;
    body?: string;
  },
  mode: "title" | "body" = "title",
): HomeLinkItem {
  const fromBody = mode === "body" ? plainBodyText(post.body ?? "") : "";
  return {
    title: fromBody || post.title,
    href: postUrl(post.slug),
    meta: formatJalali(post.date, "%Y/%m/%d"),
  };
}

export async function getHomeSections(): Promise<HomeSection[]> {
  const [posts, homeCategories, featuredTitle] = await Promise.all([
    getPostSummaries(),
    getHomeCategories(),
    getSetting("home.featured_title"),
  ]);

  const bodyModeCats = homeCategories.filter((c) => c.homeItemMode === "body");
  const bodySlugs =
    bodyModeCats.length > 0
      ? posts
          .filter((p) =>
            bodyModeCats.some((c) => (p.categories ?? []).includes(c.name)),
          )
          .map((p) => p.slug)
      : [];
  const bodies =
    bodySlugs.length > 0
      ? await getPostBodiesBySlugs(bodySlugs)
      : new Map<string, string>();

  const sections: HomeSection[] = [];
  const featured = posts.filter((p) => p.featured);

  if (featured.length > 0) {
    sections.push({
      id: "featured",
      title: featuredTitle || "برگزیده‌ها:",
      items: featured.slice(0, 12).map((p) => postToItem(p, "title")),
    });
  }

  for (const cat of homeCategories) {
    const catPosts = posts
      .filter((p) => (p.categories ?? []).includes(cat.name))
      .slice(0, 12);
    const items = catPosts.map((p) =>
      postToItem(
        cat.homeItemMode === "body"
          ? { ...p, body: bodies.get(p.slug) ?? "" }
          : p,
        cat.homeItemMode,
      ),
    );
    if (items.length === 0) continue;
    sections.push({
      id: `cat-${cat.slug || encodeURIComponent(cat.name)}`,
      title: cat.name,
      items,
    });
  }

  if (posts.length > 0) {
    sections.push({
      id: "latest",
      title: "آخرین نوشته‌ها",
      items: posts.slice(0, 15).map((p) => postToItem(p, "title")),
    });
  }

  return sections;
}

export async function getHomeProjects(): Promise<HomeProjectCard[]> {
  const projects = await getProjects();
  return projects.slice(0, 6).map((project, index) => ({
    title: project.title,
    href: `/projects/${project.slug}`,
    image: index % 2 === 0 ? "/01.jpg" : "/img/me.png",
  }));
}
