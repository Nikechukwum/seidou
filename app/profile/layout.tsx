'use client'
import useAuth from '@/hooks/useAuth'
import { RootState } from '@/redux/store'
import { useEffect } from 'react'
import { useSelector } from 'react-redux'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
    const {isLoading, checkSession} = useAuth()

    const { user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    checkSession()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-11 border-b-transparent border-l-transparent border-zinc-500 mx-auto" />
      </div>
    )
  }

  return (
    <>
        {user && 
            <>
                {children}
            </>
        }
    </>
  )
}