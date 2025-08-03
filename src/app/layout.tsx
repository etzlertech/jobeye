import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JobEye - Voice-First FSM',
  description: 'Voice-First Field Service Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-tower-dark text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}