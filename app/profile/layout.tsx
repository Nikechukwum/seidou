'use client'
import { FullScreenLoader } from '@/components/FullScreenLoader'
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

  return (
    <>
        <FullScreenLoader isActive={isLoading}/>
        {user && 
            <>
                {children}
            </>
        }
    </>
  )
}