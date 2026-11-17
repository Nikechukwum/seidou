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
                    // A floating overlay: fixed, so it never pushes the page down.
                    // w-max sizes the box to its text, so the padding is the same
                    // on both sides and it stays centred (it used to span the full
                    // width with the text on the left).
                    className="fixed top-3 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] cursor-pointer"
                >
                    <p
                        className={`flex gap-x-1.5 items-center justify-center font-semibold text-xs leading-tight rounded-full px-3 py-1.5 shadow-md ring-1 ${
                            isSuccess
                                ? 'text-green-600 bg-green-50 ring-green-500'
                                : 'text-red-500 bg-red-50 ring-red-500'
                        }`}
                    >
                        {isSuccess ? (
                            <CheckCircleIcon className="size-4 shrink-0" />
                        ) : (
                            <ExclamationCircleIcon className="size-4 shrink-0" />
                        )}
                        <span className="text-center">{message}</span>
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
