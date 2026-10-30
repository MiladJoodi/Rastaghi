import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactSocialLinks } from "@/components/contact/ContactSocialLinks";
import { ShahinShell } from "@/components/home/ShahinShell";
import { getHomeNavItems } from "@/lib/home-data";
import { renderMarkdown } from "@/lib/markdown";
import { getContactSocialLinks, getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const title = await getSetting("contact.title");
  return {
    title: title || "تماس با ما",
  };
}

export default async function ContactPage() {
  const [title, body, navItems, socialLinks] = await Promise.all([
    getSetting("contact.title"),
    getSetting("contact.body"),
    getHomeNavItems(),
    getContactSocialLinks(),
  ]);
  const html = renderMarkdown(body || "");

  return (
    <ShahinShell navItems={navItems}>
      <article className="shahin-post">
        <header className="shahin-post-header">
          <h1 className="home-shahin-section-title">{title || "تماس با ما"}</h1>
        </header>
        <div
          className="shahin-post-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <ContactSocialLinks links={socialLinks} />
        <ContactForm />
      </article>
    </ShahinShell>
  );
}
