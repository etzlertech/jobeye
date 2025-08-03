import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-4 text-white">
          JobEye - Voice-First Field Service Management System
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Version 3.2.1
        </p>
        
        <div className="bg-tower-gray rounded-lg p-8 border border-tower-border">
          <h2 className="text-2xl font-semibold text-white mb-4">🏗️ Development Mode</h2>
          <p className="text-gray-300 mb-6">
            Access the Construction Control Tower for architecture monitoring and project management.
          </p>
          
          <Link 
            href="/(control-tower)"
            className="inline-flex items-center space-x-3 bg-tower-accent hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <span>🏗️</span>
            <span>Enter Control Tower</span>
          </Link>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>⚠️ This is a development tool isolated from production</p>
          </div>
        </div>
      </div>
    </div>
  )
}