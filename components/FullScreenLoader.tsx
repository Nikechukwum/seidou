import { AnimatePresence, motion } from "motion/react";

type Props = {
    isActive?: boolean
}
export const FullScreenLoader = ({isActive = false}: Props) => {
    return ( 
        <>
            <AnimatePresence>
                {isActive &&
                    <motion.div exit={{opacity: 0, transition:{duration: 0.3}}} className="fixed top-0 left-0 w-full bg-white h-screen z-90 grid place-content-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-11 border-b-transparent border-l-transparent border-zinc-500 mx-auto" />
                    </motion.div>
                }
            </AnimatePresence>
        </>
    );
}