'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check for configuration issues in production
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const needsConfig = isProduction && !siteUrl;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Clear any lingering demo cookies
        document.cookie = 'isDemo=; Max-Age=0; path=/';
        document.cookie = 'demoRole=; Max-Age=0; path=/';

        // Get role from app_metadata or user_metadata
        const role = data.user.app_metadata?.role || data.user.user_metadata?.role || 'crew';

        // Redirect based on role or provided redirect target
        const roleRoutes: Record<string, string> = {
          admin: '/demo-crud',
          supervisor: '/demo-crud',
          crew: '/demo-crud'
        };

        const redirectParam = searchParams?.get('redirectTo');
        const hasSafeRedirect = redirectParam?.startsWith('/');
        const targetRoute = hasSafeRedirect ? redirectParam! : roleRoutes[role] || '/demo-crud';

        router.push(targetRoute);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-yellow-400">JobEye</h1>
          <p className="text-xl text-gray-300">Simple Sign In</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border-2 border-red-500 rounded-xl p-6 text-red-400 text-lg">
            {error}
          </div>
        )}

        <form id="signin-form" onSubmit={handleSignIn} className="space-y-8">
          <div className="space-y-3">
            <label htmlFor="email" className="block text-lg font-medium text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 text-white placeholder-gray-500"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="password" className="block text-lg font-medium text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 text-lg bg-gray-800 border-2 border-gray-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 text-white placeholder-gray-500"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-5 text-xl bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="space-y-4 rounded-xl border-2 border-gray-700 bg-gray-900/60 p-6">
          <p className="text-center text-gray-300 text-lg font-medium">Test Accounts</p>
          <div className="space-y-2 text-base text-gray-200">
            <p className="font-mono">Supervisor: super@tophand.tech / demo123</p>
            <p className="font-mono">Crew: crew@tophand.tech / demo123</p>
            <p className="font-mono">Admin: admin@tophand.tech / demo123</p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border-2 border-gray-700 bg-gray-900/60 p-6">
          <p className="text-center text-gray-300 text-lg font-medium">Demo Pages (No Sign-in Required)</p>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/demo-crud"
              className="block text-center py-3 px-4 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Demo CRUD
            </a>
            <a
              href="/demo-properties"
              className="block text-center py-3 px-4 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Properties
            </a>
            <a
              href="/demo-jobs"
              className="block text-center py-3 px-4 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Jobs
            </a>
            <a
              href="/demo-items"
              className="block text-center py-3 px-4 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Inventory
            </a>
          </div>
        </div>
        
        {/* Version indicator for deployment */}
        <div className="mt-4 text-center text-xs text-gray-500">
          v3.2.1 - {new Date().toLocaleDateString()}
          {needsConfig && ' - Config Required'}
        </div>
      </div>
    </div>
  );
}

export default function SimpleSignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <SignInForm />
    </Suspense>
  );
}
