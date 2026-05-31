'use client'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { RootState } from '@/redux/store'
import { hideToast } from '@/redux/toastSlice'

const AUTO_DISMISS_MS = 4000

export const Toast = () => {
    const dispatch = useDispatch()
    const { visible, message, type, id } = useSelector((state: RootState) => state.toast)

    // Restart the auto-dismiss timer whenever a new toast is shown (id changes).
    useEffect(() => {
        if (!visible) return
        const timeout = setTimeout(() => dispatch(hideToast()), AUTO_DISMISS_MS)
        return () => clearTimeout(timeout)
    }, [id, visible, dispatch])

    const isSuccess = type === 'success'

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key={id}
                    initial={{ y: -80, opacity: 0, x: '-50%' }}
                    animate={{ y: 0, opacity: 1, x: '-50%' }}
                    exit={{ y: -80, opacity: 0, x: '-50%' }}
                    transition={{ duration: 0.3 }}
                    onClick={() => dispatch(hideToast())}
                    className="fixed top-4.5 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm cursor-pointer"
                >
                    <p
                        className={`flex gap-x-1.5 items-center font-semibold text-sm rounded-full px-3.5 py-2 shadow-lg ring-1 ${
                            isSuccess
                                ? 'text-green-500 bg-green-50 ring-green-500'
                                : 'text-red-500 bg-red-50 ring-red-500'
                        }`}
                    >
                        {isSuccess ? (
                            <CheckCircleIcon className="size-5.5 shrink-0" />
                        ) : (
                            <ExclamationCircleIcon className="size-5.5 shrink-0" />
                        )}
                        {message}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
