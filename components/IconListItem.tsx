import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { ReactNode } from "react";

type Props = {
    icon: ReactNode;
    iconBg?: string;
    chevron?: boolean
    title: string
    description?: string 
}
export const IconListItem = ({icon, iconBg = 'bg-[#f3f4f6]', chevron, title, description}: Props) => {
    return ( 
        <button className="flex items-center justify-between w-full py-1 transition-colors group">
            <div className="flex items-center gap-4">
                <div className={`flex justify-center items-center shrink-0 size-14 rounded-xl group-active:scale-95 transition-transform ${iconBg}`}>
                    {icon}
                </div>
                <div className="w-full text-left line-clamp-2">
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>
            {chevron && <ChevronRightIcon className="size-5 text-[#b5b6b8]" />}
        </button>
    );
}