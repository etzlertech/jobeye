/**
 * @file CamChat Page
 * @purpose Real-time camera + voice conversation with Gemini Live multimodal API
 * @phase 3
 * @domain Voice/Vision
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import { TenantBadge } from '@/components/tenant';
import { CamChatUI } from '@/components/voice/CamChatUI';

export default function CamChatPage() {
  const router = useRouter();

  // Get API key from environment
  const geminiApiKey = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY || '';

  if (!geminiApiKey) {
    return (
      <div className="mobile-container">
        <header className="header">
          <button
            onClick={() => router.push('/supervisor')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <TenantBadge />
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-red-400 mb-2">Gemini API key not configured</p>
            <p className="text-sm text-gray-500">
              Set NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY in environment variables
            </p>
          </div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  return (
    <div className="mobile-container">
      {/* Header */}
      <header className="header">
        <button
          onClick={() => router.push('/supervisor')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold">CamChat</h1>
          <p className="text-xs text-gray-400">AI sees and hears</p>
        </div>
        <TenantBadge />
      </header>

      {/* CamChat UI */}
      <div className="flex-1 overflow-hidden">
        <CamChatUI apiKey={geminiApiKey} />
      </div>

      {/* Navigation */}
      <MobileNavigation />
    </div>
  );
}
