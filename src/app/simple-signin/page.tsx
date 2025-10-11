'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function SimpleSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          admin: '/admin',
          supervisor: '/supervisor',
          crew: '/crew'
        };

        const redirectParam = searchParams?.get('redirectTo');
        const hasSafeRedirect = redirectParam?.startsWith('/');
        const targetRoute = hasSafeRedirect ? redirectParam! : roleRoutes[role] || '/';

        router.push(targetRoute);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-yellow-400">JobEye</h1>
          <p className="mt-2 text-gray-400">Simple Sign In</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        <form id="signin-form" onSubmit={handleSignIn} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-900/40 p-4">
          <p className="text-center text-gray-400">Test Accounts</p>
          <div className="space-y-1 text-sm text-gray-300">
            <p>Supervisor: super@tophand.tech / demo123</p>
            <p>Crew: crew@tophand.tech / demo123</p>
            <p>Admin: admin@tophand.tech / demo123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
