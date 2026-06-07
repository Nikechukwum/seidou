import { AnimatePresence, motion } from "motion/react";
import { Dispatch, ReactNode, SetStateAction, useMemo } from "react";

type Props = {
    isActive: boolean;
    setIsActive: Dispatch<SetStateAction<boolean>>;
    children: ReactNode;
    persist?: boolean;
}

const modalVariants = {
    initial: { y: '10%', opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { duration: 0.3 } },
    exit: { y: '10%', opacity: 0, transition: { duration: 0.3 } }
}

const overlayVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
}

export const Modal = ({isActive, setIsActive, children, persist}: Props) => {
    const variants = useMemo(() => ({ modal: modalVariants, overlay: overlayVariants }), []);
    
    return ( 
        <AnimatePresence mode="wait">
            {isActive && 
            <div className="fixed h-dvh top-0 left-0 w-full z-20 flex justify-center items-center touch-none">
                <motion.div 
                {...variants.modal}
                className="bg-white border border-slate-200 p-7 rounded-3xl shadow-lg w-[90%] max-w-md will-change-transform">
                    { children }
                </motion.div>

                {/* Overlay */}
                <motion.div className="absolute top-0 left-0 -z-1 h-full w-full bg-black/20"
                {...variants.overlay}
                onClick={() => setIsActive(persist? true : false)} 
                />
            </div>}
        </AnimatePresence>
    );
}