import { AnimatePresence, motion } from "motion/react";
import { Dispatch, ReactNode, SetStateAction, useMemo } from "react";

type Props = {
    isActive: boolean;
    setIsActive: Dispatch<SetStateAction<boolean>>;
    children: ReactNode;
}

const drawerVariants = {
    initial: { y: '100%'},
    animate: { y: 0, transition: { duration: 0.3 } },
    exit: { y: '100%', transition: { duration: 0.3 } }
}

const overlayVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
}

export const DrawerModal = ({isActive, setIsActive, children}: Props) => {
    const variants = useMemo(() => ({ drawer: drawerVariants, overlay: overlayVariants }), []);
    
    return ( 
        <AnimatePresence mode="wait">
            {isActive && 
            <div className="fixed h-dvh top-0 left-0 w-full z-20 flex items-end touch-none">
                <motion.div 
                {...variants.drawer}
                className="bg-white border border-slate-200 px-7 pb-7 pt-5 rounded-t-3xl shadow-lg w-full will-change-transform">
                    <div className="mx-auto mb-5 h-1 w-16 rounded-full bg-gray-200"/>
                    { children }
                </motion.div>

                {/* Overlay */}
                <motion.div className="absolute top-0 left-0 -z-1 h-full w-full bg-black/20"
                {...variants.overlay}
                onClick={() => setIsActive(false)} 
                />

            </div>}
        </AnimatePresence>
    );
}