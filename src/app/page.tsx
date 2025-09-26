import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-4 text-white">
          JobEye - Voice-First Field Service Management System
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Version 3.2.1 - Deployment Test 2025-01-26
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
      </div>
    </div>
  )
}