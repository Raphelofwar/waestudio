
import {
  SiTiktok,
  SiWhatsapp,
} from "react-icons/si";

const TIKTOK_URL =
  "https://www.tiktok.com/@waestudio2.0";

const WHATSAPP_URL =
  "https://wa.me/584121237187";

export default function SocialFooter() {
  const socialLinks = [
    {
      name: "TikTok",
      url: TIKTOK_URL,
      Icon: SiTiktok,
    },
    {
      name: "WhatsApp",
      url: WHATSAPP_URL,
      Icon: SiWhatsapp,
    },
  ];

  return (
    <footer className="mx-auto w-full max-w-md px-5 pb-6 pt-5 sm:max-w-xl">
      <div className="flex items-center justify-center gap-5">
        {socialLinks.map(
          ({ name, url, Icon }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visitar ${name} de WAESTUDIO`}
              title={name}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c5a66d]/25 bg-[#c5a66d]/[0.05] text-[#c5a66d] transition-all duration-200 hover:border-[#c5a66d]/60 hover:bg-[#c5a66d]/10 active:scale-95"
            >
              <Icon size={19} />
            </a>
          )
        )}
      </div>

      <p className="mt-3 text-center text-[9px] uppercase tracking-[0.25em] text-white/25">
        WAESTUDIO · Conecta con nosotros
      </p>
    </footer>
  );
}
