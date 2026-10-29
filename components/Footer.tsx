'use client'
import { FOOTER_LINKS } from "@/utils/defaults";
import { SOCIAL_BASE, socialPath } from "@/social/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Inside Seidou Social the bottom bar is the app's own navigation: Home goes
 * to the social feed (not the storefront), Shorts opens the shorts player, and
 * Profile opens the social profile. Outside the app the normal site bar stays,
 * so Land Wars is still reachable.
 */
const SOCIAL_FOOTER_LINKS = [
  { label: 'Home', icon: 'home', href: SOCIAL_BASE },
  { label: 'Shorts', icon: 'smart_display', href: socialPath('/shorts') },
  { label: 'Mini Apps', icon: 'grid_view', href: '/app-center' },
  { label: 'Profile', icon: 'person', href: socialPath('/social-profile') },
];

type Props = {};
export const Footer = ({}: Props) => {
  const pathname = usePathname();

  const inSocial =
    pathname === SOCIAL_BASE || pathname.startsWith(`${SOCIAL_BASE}/`);
  const links = inSocial ? SOCIAL_FOOTER_LINKS : FOOTER_LINKS;

  const isActiveLink = (href: string) => {
    if (href === SOCIAL_BASE) {
      return (
        inSocial &&
        !pathname.startsWith(socialPath('/shorts')) &&
        !pathname.startsWith(socialPath('/social-profile'))
      );
    }
    if (href === '/') return pathname === '/';
    if (href === '/app-center') {
      return pathname === '/app-center' || pathname === '/app-center/apps';
    }
    if (href === '/auction') {
      return pathname.startsWith('/auction') || pathname.startsWith('/land-wars');
    }
    if (href === '/profile') {
      return pathname === '/profile' || pathname.startsWith('/profile/');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

   // Hide footer navigation on table pages and the crash game page
   const hiddenFooterPaths = [
      '/signin',
      '/signup',
      // Has its own sticky Continue button, which the footer would cover
      '/onboarding',
      // Seidou Social onboarding — same reason
      '/app-center/apps/seidou-social/onboarding'
   ]
   // Matches any /auction/free-auction/<something> (table page) — robust to quirks
   const isTablePage = /^\/auction\/free-auction\//.test(pathname) && !pathname.endsWith('/free-auction')
   //crash game has its own full-screen layout; hide global nav footer
   const isGamePage = /^\/auction\/games\//.test(pathname)

   const isActive = !(hiddenFooterPaths.includes(pathname) || isTablePage || isGamePage)
   // Shorts is a full-screen black player, so the bar goes dark to match
   const isShortsPage = pathname.startsWith(socialPath('/shorts'))

  return (
   <>
      {isActive && <footer className={`h-15 fixed bottom-0 max-w-md w-full border-t px-8 flex justify-between items-center text-xs ${
         isShortsPage ? 'border-t-white/10 bg-black text-white' : 'border-t-[#0000001A] bg-white'
      }`}>
         {links.map((link, index)=>{
            const {label, icon, href} = link
            const active = isActiveLink(href)
            return(
               <Link key={index} className="flex flex-col items-center cursor-pointer" href={href}>
               {active ? (
                  <div className="material-symbols-outlined filled text-3xl!">{icon}</div>
               ) : (
                  <div className="material-symbols-outlined text-3xl!">{icon}</div>
               )}
               <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
               </Link>
            )
         })}
      </footer>}
    </>
  );
};
