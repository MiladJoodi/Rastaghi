import {
  EmailIcon,
  InstagramIcon,
  TelegramIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/social";
import type { ContactSocialLink } from "@/lib/contact-social";

type ContactSocialLinksProps = {
  links: ContactSocialLink[];
};

function SocialIcon({ id }: { id: ContactSocialLink["id"] }) {
  switch (id) {
    case "email":
      return <EmailIcon size={44} aria-hidden />;
    case "telegram":
      return <TelegramIcon size={44} aria-hidden />;
    case "instagram":
      return <InstagramIcon size={44} aria-hidden />;
    case "whatsapp":
      return <WhatsAppIcon size={44} aria-hidden />;
    case "x":
      return <XIcon size={40} aria-hidden />;
    default:
      return null;
  }
}

export function ContactSocialLinks({ links }: ContactSocialLinksProps) {
  if (links.length === 0) return null;

  return (
    <nav className="contact-socials" aria-label="راه‌های ارتباطی">
      <ul className="contact-socials-list">
        {links.map((link) => {
          const isMail = link.id === "email";
          return (
            <li key={link.id}>
              <a
                href={link.href}
                className={`contact-social-link contact-social-link--${link.id}`}
                target={isMail ? undefined : "_blank"}
                rel={isMail ? undefined : "noopener noreferrer"}
                title={link.label}
                aria-label={link.label}
              >
                <span className="contact-social-icon" aria-hidden>
                  <SocialIcon id={link.id} />
                </span>
                <span className="contact-social-label">{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
