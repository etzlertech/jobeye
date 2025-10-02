import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-4 text-white">
          JobEye - Voice-First Field Service Management System
        </h1>
        <p className="text-lg text-gray-400 mb-4">
          Version 3.2.1 - Railway Deployment
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Architecture-as-Code Voice-First FSM System • Build 20250126
        </p>
        
        <div className="bg-tower-gray rounded-lg p-8 border border-tower-border">
          <h2 className="text-2xl font-semibold text-white mb-4">
            {process.env.NODE_ENV === 'development' ? '🏗️ Development Mode' : '📋 Documentation & Demo'}
          </h2>
          <p className="text-gray-300 mb-6">
            {process.env.NODE_ENV === 'development' 
              ? 'Access the Construction Control Tower for architecture monitoring and project management.'
              : 'Explore the Control Tower interface and architecture. For full functionality, run locally during development.'
            }
          </p>
          
          <Link 
            href="/control-tower"
            className="inline-flex items-center space-x-3 bg-tower-accent hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <span>{process.env.NODE_ENV === 'development' ? '🏗️' : '📋'}</span>
            <span>{process.env.NODE_ENV === 'development' ? 'Enter Control Tower' : 'View Demo'}</span>
          </Link>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>
              {process.env.NODE_ENV === 'development' 
                ? '⚠️ This is a development tool isolated from production'
                : '💡 This is a demo deployment. Run locally for full manifest generation and codebase analysis.'
              }
            </p>
          </div>
        </div>

        <div className="mt-8 bg-tower-gray rounded-lg p-8 border border-tower-border">
          <h2 className="text-2xl font-semibold text-white mb-4">
            🚀 Demo Hub
          </h2>
          <p className="text-gray-300 mb-6">
            Explore comprehensive UI/UX demos with role-based interfaces, AI features, and workflow testing.
          </p>
          
          <Link 
            href="/demo-hub"
            className="inline-flex items-center space-x-3 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors text-lg"
          >
            <span>🎭</span>
            <span>Enter Demo Hub</span>
          </Link>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              href="/mobile/job-load-checklist-start"
              className="block bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">🎯</span>
                <span className="font-semibold">Gemini VLM Item Checklist</span>
              </div>
              <p className="text-sm text-gray-400">
                Real-time equipment detection using Gemini AI vision. Automatically checks off items as they're detected in your camera feed.
              </p>
            </Link>
            
            <Link 
              href="/mobile/equipment-verification"
              className="block bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">✅</span>
                <span className="font-semibold">Equipment Verification</span>
              </div>
              <p className="text-sm text-gray-400">
                Comprehensive kit verification with offline support. Uses hybrid YOLO + VLM detection for accurate equipment tracking.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}