'use client'
import { createClient } from '@/lib/supabase/client'
import { UpdateUser } from '@/redux/authSlice'
import { RootState } from '@/redux/store'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
    const [loading, setLoading] = useState(true)
    const supabase = createClient()
    const router = useRouter()
    const dispatch = useDispatch()

    const { user } = useSelector(
        (state: RootState) => state.auth
    );


  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      setLoading(false)

      if(!data.user){
        router.replace('/signin')
        return
      }

      if(!user){
        fetchProfile(data.user.id)
      }
    }

    const fetchProfile = async (id: string) => {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single()

        if (data) dispatch(UpdateUser(data))

    }
    checkUser()
  }, [])

  if (loading) {
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