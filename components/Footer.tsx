import { FOOTER_LINKS } from "@/utils/defaults";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {};
export const Footer = ({}: Props) => {
  const pathname = usePathname();
  return (
    <footer className="h-15 fixed bottom-0 max-w-md w-full border-t border-t-[#0000001A] bg-white 
    px-8 flex justify-between items-center text-xs">
      {FOOTER_LINKS.map((link, index)=>{
         const {label, icon, href} = link
         return(
            <Link key={index} className="flex flex-col items-center cursor-pointer" href={href}>
            {pathname === href ? (
               <div className="material-symbols-outlined filled text-3xl!">{icon}</div>
            ) : (
               <div className="material-symbols-outlined text-3xl!">{icon}</div>
            )}
            <span style={{ fontWeight: pathname == "/" ? 600 : 500 }}>{label}</span>
            </Link>
         )
      })}
    </footer>
  );
};
