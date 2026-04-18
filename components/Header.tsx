import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

type Props = {
    pageTitle: string;
}
export const Header = ({pageTitle}: Props) => {
    const router = useRouter()
    return ( 
        <div className="fixed top-0 left-0 z-10 bg-white shrink-0 h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-gray-200">
            <button onClick={()=>{router.back()}} className="absolute text-black top-1/2 left-3 -translate-y-1/2 p-2">
                <ArrowLeftIcon className='size-5' strokeWidth={3} /> 
            </button>
            {pageTitle}
        </div>
    );
}