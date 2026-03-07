type Props = {
    quantity?: number,
    showNotifier: boolean,
    children: React.ReactNode;
}
export const Badge = ({quantity = 0, children, showNotifier}: Props) => {
    return ( 
        <div className="relative w-fit h-fit">
            {showNotifier && 
            <div className="h-fit min-h-1.5 p-1 aspect-square rounded-full absolute top-0 right-0 text-[10px] text-white font-bold flex justify-center items-center -translate-y-1/2 translate-x-1/2 animate-pulse bg-rose-500">
                {quantity? quantity : ''}
            </div>}
            {children}
        </div>
    );
}