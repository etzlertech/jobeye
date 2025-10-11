/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/(auth)/sign-in/page.tsx
 * phase: 3
 * domain: auth
 * purpose: Modern, clean sign-in page with golden theme
 * spec_ref: 007-mvp-intent-driven/contracts/auth.md
 * complexity_budget: 300
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Shield,
  Wrench,
  Crown,
  CheckCircle,
  WifiOff
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { resolveDashboardRoute } from '@/lib/auth/role-routing';
import { MobileContainer } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AuthState {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  showPassword: boolean;
}

const roleIcons = {
  admin: Crown,
  supervisor: Shield,
  crew: Wrench
};

const roleDescriptions = {
  admin: 'System administration and configuration',
  supervisor: 'Job creation, inventory management, crew oversight',
  crew: 'Job execution, equipment verification, voice control'
};

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [authState, setAuthState] = useState<AuthState>({
    email: '',
    password: '',
    isLoading: false,
    error: null,
    success: null,
    showPassword: false
  });

  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Network status monitoring
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Sync Supabase session cookies with server routes
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (typeof fetch !== 'function') return;
      if (!['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'].includes(event)) {
        return;
      }

      void fetch('/auth/callback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session })
      }).catch(error => {
        console.error('Failed to sync auth session', error);
      });
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignIn = async () => {
    if (!authState.email || !authState.password) {
      setAuthState(prev => ({ ...prev, error: 'Please enter both email and password' }));
      return;
    }

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
        // Clear any lingering demo cookies
        document.cookie = 'isDemo=; Max-Age=0; path=/';
        document.cookie = 'demoRole=; Max-Age=0; path=/';

        if (data.session && typeof fetch === 'function') {
          try {
            await fetch('/auth/callback', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'SIGNED_IN', session: data.session })
            });
          } catch (sessionError) {
            console.error('Failed to persist Supabase session', sessionError);
          }
        }

        // Check both app_metadata and user_metadata for role
        const role = data.user.app_metadata?.role || data.user.user_metadata?.role || 'crew';
        setDetectedRole(role);
        setAuthState(prev => ({ ...prev, success: `Welcome back! Redirecting to ${role} dashboard...` }));

        // Small delay to show role detection
        setTimeout(() => {
          router.push(resolveDashboardRoute(role));
        }, 2000);
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && authState.email && authState.password && !authState.isLoading) {
      handleSignIn();
    }
  };

  // Show role detection/loading screen
  if (detectedRole || authState.isLoading) {
    const RoleIcon = detectedRole ? roleIcons[detectedRole as keyof typeof roleIcons] : Loader2;

    return (
      <MobileContainer className="items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-8"
        >
          <motion.div
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center"
            animate={{ rotate: detectedRole ? 0 : 360 }}
            transition={{ duration: 1, repeat: detectedRole ? 0 : Infinity, ease: "linear" }}
          >
            <RoleIcon className="w-10 h-10 text-primary" />
          </motion.div>

          {detectedRole ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-semibold mb-3">Welcome Back!</h2>
              <Badge variant="outline" className="mb-4 gap-2 py-2 px-4 text-base border-primary text-primary">
                <RoleIcon className="w-5 h-5" />
                <span className="capitalize">{detectedRole}</span>
              </Badge>
              <p className="text-muted-foreground text-sm">
                {roleDescriptions[detectedRole as keyof typeof roleDescriptions] ?? 'Redirecting to your dashboard.'}
              </p>
            </motion.div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
              <p className="text-muted-foreground text-sm">Please wait while we verify your credentials</p>
            </>
          )}
        </motion.div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Logo/Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-primary mb-2">JobEye</h1>
          <p className="text-sm text-muted-foreground">Voice-First Field Service Management</p>
        </motion.div>

        {/* Offline Warning */}
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-md mb-4"
            >
              <Badge variant="destructive" className="w-full py-2 justify-center gap-2">
                <WifiOff className="w-4 h-4" />
                You're offline. Authentication may be limited.
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign In Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                Sign In
              </CardTitle>
              <CardDescription>
                Enter your credentials to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Message */}
              <AnimatePresence>
                {authState.error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    <span className="text-sm text-destructive">{authState.error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Message */}
              <AnimatePresence>
                {authState.success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20"
                  >
                    <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm text-primary">{authState.success}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={authState.email}
                    onChange={(e) => setAuthState(prev => ({ ...prev, email: e.target.value }))}
                    onKeyPress={handleKeyPress}
                    className="pl-10"
                    disabled={authState.isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={authState.showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={authState.password}
                    onChange={(e) => setAuthState(prev => ({ ...prev, password: e.target.value }))}
                    onKeyPress={handleKeyPress}
                    className="pl-10 pr-10"
                    disabled={authState.isLoading}
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setAuthState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    disabled={authState.isLoading}
                  >
                    {authState.showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Sign In Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleSignIn}
                disabled={!authState.email || !authState.password || authState.isLoading}
              >
                {authState.isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Test Accounts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md mt-6"
        >
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Test Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Supervisor:</span>
                <code className="px-2 py-1 bg-muted rounded">super@tophand.tech / demo123</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Crew:</span>
                <code className="px-2 py-1 bg-muted rounded">crew@tophand.tech / demo123</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Admin:</span>
                <code className="px-2 py-1 bg-muted rounded">admin@tophand.tech / demo123</code>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </MobileContainer>
  );
}
