import { AnimatePresence, motion } from "motion/react";
import { Dispatch, ReactNode, SetStateAction } from "react";

type Props = {
    isActive: boolean;
    setIsActive: Dispatch<SetStateAction<boolean>>;
    children: ReactNode;
}
export const Modal = ({isActive, setIsActive, children}: Props) => {
    return ( 
        <AnimatePresence>
            {isActive && 
            <motion.div 
            animate={{backgroundColor: '#00000050', transition:{duration: 0.3}}} 
            exit={{backgroundColor: '#00000000', transition:{duration: 0.3}}}
            onClick={()=>{setIsActive(false)}} 
            className="fixed h-dvh top-0 left-0 w-full z-20 flex justify-center items-center touch-none">
                <motion.div 
                initial={{y: '10%', opacity: 0}} 
                animate={{y: 0, opacity: 1, transition:{duration: 0.3}}} 
                exit={{y: '10%', opacity: 0, transition:{duration: 0.3}}}
                onClick={(e)=>{e.stopPropagation()}} 
                className="bg-white border border-slate-200 p-7 rounded-3xl shadow-lg w-[95%] max-w-md">
                    { children }
                </motion.div>
            </motion.div>}
        </AnimatePresence>
    );
}