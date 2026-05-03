'use client'
import { Header } from "./Header";

type Props = {
    children: React.ReactNode
    pageTitle?: string
    header?: boolean
    backButton?: boolean
    className?: string
}
export const PageLayout = ({children, header = true, backButton = false, className = '', pageTitle = ''}: Props) => {
    return ( 
        <div className={`min-h-dvh ${header? 'py-20' : 'pt-5 pb-20'} ${className}`}>
            {header && 
                <Header pageTitle={pageTitle} backButton={backButton}/>
            }

            {children}
        </div>
    );
}