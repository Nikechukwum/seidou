'use client'
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

type Props = {
    pageTitle: string;
    noBackButton?: boolean;
    backNavigationType?: 'default'|'manual'|'forceToHome'
    extraButton?: ReactNode
}
export const Header = ({pageTitle, noBackButton, backNavigationType = 'default', extraButton}: Props) => {
    const router = useRouter()

    const handleBack = () => {
        if(backNavigationType === 'default'){
            router.back()
            return
        }

         if(backNavigationType === 'manual'){
             const userNav = JSON.parse(sessionStorage.getItem('userNav') || '[]')
             if(userNav.length > 0){
                 const backNav = userNav.pop()
                 sessionStorage.setItem('userNav', JSON.stringify(userNav))
                 router.push(backNav)
             } else {
                 const pathSegments = window.location.pathname.split('/').filter(Boolean)
                 const mainPath = pathSegments.length > 0 ? '/' + pathSegments[0] : '/'
                 router.push(mainPath)
             }
             return
         }

        if(backNavigationType === 'forceToHome'){
            router.push('/')
            return
        }
    }
    return ( 
        <div className="fixed top-0 left-0 z-10 bg-white shrink-0 h-16 w-full grid place-content-center font-semibold text-xl border-b-2 border-b-gray-200">
            {!noBackButton && <button onClick={()=>{handleBack()}} className="absolute text-black top-1/2 left-3 -translate-y-1/2 p-2">
                <ArrowLeftIcon className='size-5' strokeWidth={3} /> 
            </button>}

            {pageTitle}

            {extraButton && <div className="absolute top-1/2 right-3 -translate-y-1/2 flex items-center">
                {extraButton}
            </div>}
        </div>
    );
}