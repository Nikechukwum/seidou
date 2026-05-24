'use client'

import StoreProvider from "@/redux/StoreProvider"
import CrashGame from "./CrashGame"

const CrashGamePage = () => {
    return (
        <StoreProvider>
            <CrashGame />
        </StoreProvider>
    )
}

export default CrashGamePage