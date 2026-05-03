'use client'
import { createClient } from '@/lib/supabase/client';
import { ExclamationCircleIcon } from '@heroicons/react/20/solid';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const [userNav, setuserNav] = useState<string>('/');

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
      e.preventDefault();
      setLoading(true);

      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        router.replace(userNav)
      }
      setLoading(false);
  }

  const handleBackClick = () => {
    const userNav = sessionStorage.getItem('userNav') || '/';
    let backPath = userNav
    if(backPath.startsWith('/profile')){
      backPath = '/'
    }
    sessionStorage.removeItem('userNav')
    router.push(backPath)
  }

  useEffect(() => {
    const path = sessionStorage.getItem('userNav') || '/';
    setuserNav(path);
  }, []);

  return (
    <div className="flex flex-col bg-white px-6 pb-20">
      
      {/* Back Button */}
      <button onClick={handleBackClick} className="my-6 w-fit text-gray-900">
        <ArrowLeftIcon className='size-5.5' strokeWidth={2.5} /> 
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-gray-500 font-medium">
          Please enter your details to sign in.
        </p>
        {error && <p className='max-w-lg flex gap-x-1.5 items-center font-semibold mt-3 text-sm text-red-600 bg-red-50 ring-1 ring-red-600 rounded-full px-3 py-2'>
          <ExclamationCircleIcon className='size-5.5 shrink-0'/> {error}
        </p>}
      </div>

      {/* Form */}
      <form className="space-y-6 mb-8" onSubmit={(e) => handleSubmit(e)}>
        {/* Phone Field */}
        {/* <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            Phone number
          </label>
          <input
            type="text"
            name='phone'
            placeholder="+234 9094070547"
            className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />
        </div> */}

        {/* Email Field */}
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            Email
          </label>
          <input
            type="email"
            name='email'
            placeholder="john@africa.com"
            className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
          />
        </div>

        {/* Password Field */}
        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name='password'
              className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 pr-14 text-gray-900 outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400"
            >
              <span className="material-symbols-outlined text-[22px]!">
                {showPassword ? 'visibility' : 'visibility_off'}
              </span>
            </button>
          </div>
          
          {/* Forgot Password Link */}
          <div className="mt-3 flex justify-end">
            <button className="text-sm font-bold text-gray-800 hover:underline">
              Forgot Password?
            </button>
          </div>
        </div>

        {/* Log In Button */}
        <button
          type="submit"
          className="w-full rounded-full bg-black py-3.5 text-center font-bold text-white shadow-lg shadow-black/10 transition-transform active:scale-[0.98]"
        >
          Log in
        </button>
      </form>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute w-5/6 inset-0 left-1/2 -translate-x-1/2 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 font-medium text-gray-400">Or continue with</span>
        </div>
      </div>

      {/* Google Login Button */}
      <div className="flex justify-center mb-6">
        <button className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-white transition-all hover:bg-gray-50 active:scale-95">
          <svg className="h-6 w-6" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
              fill="#EA4335"
            />
          </svg>
        </button>
      </div>

      {/* Footer Text */}
      <div className="mt-auto flex justify-center text-[15px]">
        <span className="text-gray-400">Don't have an account?&nbsp;</span>
        <Link href={'/signup'} className="font-bold text-gray-900 hover:underline">Sign up</Link>
      </div>
    </div>
  );
}