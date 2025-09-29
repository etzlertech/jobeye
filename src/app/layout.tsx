import type { Metadata, Viewport } from 'next'
import { PWAProvider } from '@/components/providers/pwa-provider'
import { OfflineIndicator } from '@/components/shared/offline-indicator'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobEye - Voice-First FSM',
  description: 'Voice-First Field Service Management System with Multi-Object Vision',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/icon-192.png'
  }
}

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-tower-dark text-white min-h-screen">
        <PWAProvider>
          {children}
          <OfflineIndicator />
        </PWAProvider>
      </body>
    </html>
  )
}