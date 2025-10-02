/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/(auth)/sign-in/page.tsx
 * phase: 3
 * domain: auth
 * purpose: Login page with role detection and redirect
 * spec_ref: 007-mvp-intent-driven/contracts/auth.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['initial', 'authenticating', 'role_detected', 'redirecting'],
 *   transitions: [
 *     'initial->authenticating: submitCredentials()',
 *     'authenticating->role_detected: authSuccess()',
 *     'role_detected->redirecting: determineRoute()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "render": "$0.00 (no AI calls)"
 * }
 * offline_capability: OPTIONAL
 * dependencies: {
 *   internal: [
 *     '@/lib/auth/supabase-client',
 *     '@/components/ui/ButtonLimiter'
 *   ],
 *   external: ['next/navigation', 'react'],
 *   supabase: ['auth.users']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands disabled on auth pages for security
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/auth-flow.test.ts'
 * }
 * tasks: [
 *   'Create login form with email/password',
 *   'Implement role detection from user metadata',
 *   'Add role-based routing after authentication',
 *   'Handle offline authentication gracefully'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  AlertCircle, 
  Loader,
  Shield,
  Users,
  Wrench,
  Crown
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';

interface AuthState {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  showPassword: boolean;
}

const roleIcons = {
  admin: Crown,
  supervisor: Shield,
  crew: Wrench
};

const roleColors = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  supervisor: 'bg-blue-100 text-blue-800 border-blue-200',
  crew: 'bg-emerald-100 text-emerald-800 border-emerald-200'
};

const roleRoutes = {
  admin: '/admin',
  supervisor: '/supervisor',
  crew: '/crew'
};

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { actions, addAction, clearActions } = useButtonActions();

  const [authState, setAuthState] = useState<AuthState>({
    email: '',
    password: '',
    isLoading: false,
    error: null,
    showPassword: false
  });

  const [detectedRole, setDetectedRole] = useState<string | null>(null);

  // Set up button actions
  useEffect(() => {
    clearActions();
    
    addAction({
      id: 'sign-in',
      label: authState.isLoading ? 'Signing In...' : 'Sign In',
      priority: 'critical',
      disabled: authState.isLoading || !authState.email || !authState.password,
      onClick: handleSignIn,
      className: 'bg-emerald-600 text-white hover:bg-emerald-700'
    });

    if (authState.email && authState.password) {
      addAction({
        id: 'demo-crew',
        label: 'Demo as Crew',
        priority: 'medium',
        onClick: () => handleDemoLogin('crew'),
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'demo-supervisor',
        label: 'Demo as Supervisor',
        priority: 'medium',
        onClick: () => handleDemoLogin('supervisor'),
        className: 'bg-purple-600 text-white hover:bg-purple-700'
      });
    }
  }, [authState.email, authState.password, authState.isLoading, addAction, clearActions]);

  const handleInputChange = (field: keyof Pick<AuthState, 'email' | 'password'>) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAuthState(prev => ({
        ...prev,
        [field]: e.target.value,
        error: null
      }));
    };

  const handleSignIn = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authState.email,
        password: authState.password
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const role = data.user.app_metadata?.role || 'crew';
        setDetectedRole(role);
        
        // Small delay to show role detection
        setTimeout(() => {
          router.push(roleRoutes[role as keyof typeof roleRoutes]);
        }, 1500);
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }));
    }
  };

  const handleDemoLogin = async (role: 'crew' | 'supervisor' | 'admin') => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Demo credentials (in a real app, these would be from environment)
      const demoCredentials = {
        crew: { email: 'crew@demo.com', password: 'demo123' },
        supervisor: { email: 'supervisor@demo.com', password: 'demo123' },
        admin: { email: 'admin@demo.com', password: 'demo123' }
      };

      const { email, password } = demoCredentials[role];
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setDetectedRole(role);
        setTimeout(() => {
          router.push(roleRoutes[role]);
        }, 1500);
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: `Demo login failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && authState.email && authState.password && !authState.isLoading) {
      handleSignIn();
    }
  };

  // Show role detection screen
  if (detectedRole) {
    const RoleIcon = roleIcons[detectedRole as keyof typeof roleIcons];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <RoleIcon className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${roleColors[detectedRole as keyof typeof roleColors]}`}>
              <RoleIcon className="w-4 h-4" />
              <span className="font-medium capitalize">{detectedRole}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Loader className="w-5 h-5 animate-spin" />
            <span>Redirecting to dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to JobEye
          </h1>
          <p className="text-gray-600">
            Voice-First Field Service Management
          </p>
        </div>

        {/* Error Message */}
        {authState.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800 text-sm">{authState.error}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={authState.email}
                onChange={handleInputChange('email')}
                onKeyPress={handleKeyPress}
                disabled={authState.isLoading}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                         disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="password"
                type={authState.showPassword ? 'text' : 'password'}
                value={authState.password}
                onChange={handleInputChange('password')}
                onKeyPress={handleKeyPress}
                disabled={authState.isLoading}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg 
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                         disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setAuthState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                disabled={authState.isLoading}
                className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 disabled:opacity-50"
              >
                {authState.showPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4">
            <ButtonLimiter
              actions={actions}
              maxVisibleButtons={4}
              showVoiceButton={false} // Disabled for security on auth pages
              layout="grid"
              buttonSize="lg"
              className="w-full"
            />
          </div>
        </form>

        {/* Demo Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 text-sm text-center">
            <strong>Demo Mode:</strong> Use demo buttons above or these credentials:
          </p>
          <div className="mt-2 text-xs text-blue-700 space-y-1">
            <div>Crew: crew@demo.com / demo123</div>
            <div>Supervisor: supervisor@demo.com / demo123</div>
          </div>
        </div>

        {/* Offline Notice */}
        {!navigator?.onLine && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-yellow-800 text-sm">
                You're offline. Authentication may be limited.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}