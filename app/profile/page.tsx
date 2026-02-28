'use client'
// import { createClient } from '@/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      // const { data } = await supabase.auth.getUser()
      // setUser(data.user)
      setLoading(false)
    }
    checkUser()
  }, [])

  if (loading) return <p>Checking auth...</p>
  if (!user) return <p>Please <Link href={'/signin'}>sign in</Link> to view this content.</p>
  
  return (
    <div>Yes</div>
  );
}