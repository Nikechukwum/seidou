import { ReactNode } from "react";

type Props = {
    id: number;
    children: ReactNode;
}

export const ListCard = ({ id, children }: Props) => {
    return (
        <div 
            className="items-center grid grid-cols-[4rem_1fr] bg-white p-4 gap-4 rounded-3xl border border-gray-100 shadow-sm"
        >
            {/* Rank Indicator */}
            <div className="shrink-0 size-16 flex items-center justify-center border-2 border-gray-100 rounded-full text-xl font-bold text-gray-800">
                {id}
            </div>

            <div className="flex flex-col justify-center gap-2 h-full w-full overflow-hidden">
                {children}
            </div>
        </div>
    );
};