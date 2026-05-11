'use client'
import { ReactNode } from "react";
import { Header } from "./Header";

type Props = {
    children: React.ReactNode
    pageTitle?: string
    header?: boolean
    noBackButton?: boolean
    className?: string
    extraButton?: ReactNode
}
export const PageLayout = ({children, header = true, noBackButton, className = '', pageTitle = '', extraButton}: Props) => {
    return ( 
        <div className={`min-h-lvh ${header? 'py-20' : 'pt-5 pb-20'} ${className}`}>
            {header && 
                <Header 
                pageTitle={pageTitle} 
                noBackButton={noBackButton} 
                extraButton={extraButton}/> 
            }

            {children}
        </div>
    );
}