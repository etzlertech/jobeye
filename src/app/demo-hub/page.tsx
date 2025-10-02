'use client';

import Link from 'next/link'

export default function DemoHub() {
  return (
    <>
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #000;
          color: white;
          overflow-x: hidden;
        }

        .mobile-screen {
          width: 100vw;
          max-width: 375px;
          margin: 0 auto;
          background: #000;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 10px;
          gap: 8px;
        }

        .container-section {
          border-radius: 12px;
          background: #000;
          border: 3px solid;
          padding: 15px;
          margin-bottom: 8px;
        }

        .header-container {
          border-color: #FFD700;
          padding: 8px 15px;
          text-align: center;
        }

        .role-container {
          border-color: #0066FF;
        }

        .ai-container {
          border-color: #FF6B35;
        }

        .voice-container {
          border-color: #228B22;
        }

        .quick-container {
          border-color: #FFC107;
        }

        .company-name {
          font-size: 22px;
          font-weight: 600;
          color: #FFD700;
          text-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
          margin-bottom: 4px;
        }

        .header-info {
          font-size: 12px;
          color: #ccc;
          line-height: 1.3;
        }

        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #0066FF;
        }

        .role-title {
          color: #0066FF;
        }

        .ai-title {
          color: #FF6B35;
        }

        .voice-title {
          color: #228B22;
        }

        .quick-title {
          color: #FFC107;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .demo-single {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .demo-card {
          background: rgba(0, 100, 255, 0.1);
          border: 2px solid #0066FF;
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s;
          text-decoration: none;
          color: white;
          display: block;
          min-height: 80px;
        }

        .demo-card:hover {
          background: rgba(0, 100, 255, 0.2);
          transform: scale(1.02);
        }

        .demo-card:active {
          transform: scale(0.98);
        }

        .role-card {
          border-color: #0066FF;
          background: rgba(0, 100, 255, 0.1);
        }

        .role-card:hover {
          background: rgba(0, 100, 255, 0.2);
        }

        .ai-card {
          border-color: #FF6B35;
          background: rgba(255, 107, 53, 0.1);
        }

        .ai-card:hover {
          background: rgba(255, 107, 53, 0.2);
        }

        .voice-card {
          border-color: #228B22;
          background: rgba(34, 139, 34, 0.1);
        }

        .voice-card:hover {
          background: rgba(34, 139, 34, 0.2);
        }

        .quick-card {
          border-color: #FFC107;
          background: rgba(255, 193, 7, 0.1);
        }

        .quick-card:hover {
          background: rgba(255, 193, 7, 0.2);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .card-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .card-title {
          font-weight: 600;
          font-size: 12px;
          line-height: 1.2;
        }

        .card-description {
          font-size: 10px;
          color: #ccc;
          line-height: 1.3;
          margin-bottom: 6px;
        }

        .card-features {
          font-size: 9px;
          color: #999;
          line-height: 1.2;
        }

        .button-container {
          height: 75px;
          display: flex;
          gap: 10px;
          margin-top: 8px;
        }

        .nav-button {
          flex: 1;
          border: 3px solid;
          border-radius: 12px;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 24px;
          font-weight: bold;
          text-decoration: none;
        }

        .back-button {
          border-color: #666;
          color: #666;
        }

        .back-button:hover {
          background: rgba(102, 102, 102, 0.2);
          transform: scale(1.05);
        }

        .home-button {
          border-color: #228B22;
          color: #228B22;
        }

        .home-button:hover {
          background: rgba(34, 139, 34, 0.2);
          transform: scale(1.05);
        }

        @media (min-width: 768px) {
          .mobile-screen {
            max-width: 768px;
            padding: 20px;
          }

          .demo-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .card-title {
            font-size: 14px;
          }

          .card-description {
            font-size: 12px;
          }

          .card-features {
            font-size: 10px;
          }
        }
      `}</style>

      <div className="mobile-screen">
        <div className="container-section header-container">
          <div className="company-name">JobEye Demo Hub</div>
          <div className="header-info">
            UI/UX Testing • Mobile Optimized<br />
            Status: <span style={{color: '#FFC107', fontWeight: 600}}>Ready</span>
          </div>
        </div>
        
        {/* Role-Based Demos */}
        <div className="container-section role-container">
          <h2 className="section-title role-title">🎭 Role-Based Interfaces</h2>
          
          <div className="demo-grid">
            <Link href="/sign-in" className="demo-card role-card">
              <div className="card-header">
                <span className="card-icon">👨‍💼</span>
                <span className="card-title">Supervisor</span>
              </div>
              <p className="card-description">
                Job creation, inventory management, crew oversight
              </p>
              <div className="card-features">
                • Create jobs & schedules<br />
                • Add inventory via camera<br />
                • Crew performance tracking
              </div>
            </Link>
            
            <Link href="/sign-in" className="demo-card role-card">
              <div className="card-header">
                <span className="card-icon">👷‍♂️</span>
                <span className="card-title">Crew Member</span>
              </div>
              <p className="card-description">
                Job execution, equipment verification, voice control
              </p>
              <div className="card-features">
                • Voice-driven workflows<br />
                • Equipment verification<br />
                • Offline operation
              </div>
            </Link>
            
            <Link href="/control-tower" className="demo-card role-card">
              <div className="card-header">
                <span className="card-icon">🏗️</span>
                <span className="card-title">Admin/Dev</span>
              </div>
              <p className="card-description">
                Architecture monitoring, system configuration
              </p>
              <div className="card-features">
                • Control Tower interface<br />
                • System monitoring<br />
                • Architecture analysis
              </div>
            </Link>
            
            <Link href="/mobile" className="demo-card role-card">
              <div className="card-header">
                <span className="card-icon">📱</span>
                <span className="card-title">Mobile Hub</span>
              </div>
              <p className="card-description">
                Native mobile testing interface
              </p>
              <div className="card-features">
                • Test screen navigation<br />
                • Mobile-optimized layout<br />
                • Cross-platform support
              </div>
            </Link>
          </div>
          
          <p style={{fontSize: '10px', color: '#999', marginTop: '10px', textAlign: 'center'}}>
            💡 Click any role to go to sign-in page, then use "Demo: [Role]" buttons
          </p>
        </div>

        {/* AI/Vision Feature Demos */}
        <div className="container-section ai-container">
          <h2 className="section-title ai-title">🤖 AI & Vision Features</h2>
          
          <div className="demo-grid">
            <Link href="/mobile/equipment-verification" className="demo-card ai-card">
              <div className="card-header">
                <span className="card-icon">📷</span>
                <span className="card-title">YOLO + VLM Detection</span>
              </div>
              <p className="card-description">
                Hybrid local/cloud equipment verification
              </p>
              <div className="card-features">
                • Local YOLO inference<br />
                • GPT-4 Vision fallback<br />
                • &lt;$10/day cost budget<br />
                • Offline queue support
              </div>
            </Link>
            
            <Link href="/mobile/job-load-checklist-start" className="demo-card ai-card">
              <div className="card-header">
                <span className="card-icon">🎯</span>
                <span className="card-title">Gemini VLM Checklist</span>
              </div>
              <p className="card-description">
                Real-time equipment detection checklist
              </p>
              <div className="card-features">
                • Live camera feed analysis<br />
                • Auto-check detected items<br />
                • Google Gemini AI<br />
                • Mobile-optimized UI
              </div>
            </Link>
            
            <Link href="/crew/job-load" className="demo-card ai-card">
              <div className="card-header">
                <span className="card-icon">🚛</span>
                <span className="card-title">Crew Job Load</span>
              </div>
              <p className="card-description">
                Production crew equipment verification
              </p>
              <div className="card-features">
                • Database integration<br />
                • Real VLM detection<br />
                • Cost tracking<br />
                • Settings modal
              </div>
            </Link>
            
            <Link href="/mobile/loading-complete" className="demo-card ai-card">
              <div className="card-header">
                <span className="card-icon">✅</span>
                <span className="card-title">Loading Complete</span>
              </div>
              <p className="card-description">
                Equipment loading completion screen
              </p>
              <div className="card-features">
                • Success animations<br />
                • Completion feedback<br />
                • Next step navigation<br />
                • Progress tracking
              </div>
            </Link>
          </div>
        </div>

        {/* Voice & Workflow Demos */}
        <div className="container-section voice-container">
          <h2 className="section-title voice-title">🎤 Voice & Workflow Features</h2>
          
          <div className="demo-single">
            <Link href="/supervisor/inventory" className="demo-card voice-card">
              <div className="card-header">
                <span className="card-icon">🗣️</span>
                <span className="card-title">Voice Commands & Inventory</span>
              </div>
              <p className="card-description">
                Speech-to-text with AI intent recognition + camera inventory addition
              </p>
              <div className="card-features">
                • Web Speech API integration • Camera-based item addition<br />
                • LLM command processing • Duplicate detection<br />
                • TTS audio feedback • Real-time intent recognition
              </div>
            </Link>
            
            <div className="demo-grid">
              <div className="demo-card voice-card" style={{pointerEvents: 'none', opacity: 0.7}}>
                <div className="card-header">
                  <span className="card-icon">📱</span>
                  <span className="card-title">PWA Offline Mode</span>
                </div>
                <p className="card-description">
                  Full offline operation with background sync
                </p>
                <div className="card-features">
                  • IndexedDB storage<br />
                  • Service worker caching<br />
                  • Background sync queue<br />
                  • 50-photo offline capacity
                </div>
              </div>
              
              <div className="demo-card voice-card" style={{pointerEvents: 'none', opacity: 0.7}}>
                <div className="card-header">
                  <span className="card-icon">🔄</span>
                  <span className="card-title">Background Sync</span>
                </div>
                <p className="card-description">
                  Automatic data synchronization when online
                </p>
                <div className="card-features">
                  • Priority-based queue<br />
                  • Network status detection<br />
                  • Retry mechanisms<br />
                  • Data integrity checks
                </div>
              </div>
            </div>
          </div>
          
          <p style={{fontSize: '10px', color: '#999', marginTop: '10px', textAlign: 'center'}}>
            Available in Supervisor & Crew interfaces • Test by going offline in browser
          </p>
        </div>

        {/* Quick Access URLs */}
        <div className="container-section quick-container">
          <h2 className="section-title quick-title">🔗 Quick Access URLs</h2>
          
          <div className="demo-grid">
            <div className="demo-card quick-card" style={{pointerEvents: 'none'}}>
              <div className="card-header">
                <span className="card-icon">👨‍💼</span>
                <span className="card-title">Supervisor Features</span>
              </div>
              <div className="card-features">
                /supervisor/inventory<br />
                /supervisor/jobs/create<br />
                /supervisor/dashboard
              </div>
            </div>
            
            <div className="demo-card quick-card" style={{pointerEvents: 'none'}}>
              <div className="card-header">
                <span className="card-icon">👷‍♂️</span>
                <span className="card-title">Crew Features</span>
              </div>
              <div className="card-features">
                /crew/dashboard<br />
                /crew/jobs<br />
                /crew/job-load
              </div>
            </div>
            
            <div className="demo-card quick-card" style={{pointerEvents: 'none'}}>
              <div className="card-header">
                <span className="card-icon">📱</span>
                <span className="card-title">Mobile Features</span>
              </div>
              <div className="card-features">
                /mobile/equipment-verification<br />
                /mobile/job-load-checklist-start<br />
                /mobile/loading-complete
              </div>
            </div>
            
            <div className="demo-card quick-card" style={{pointerEvents: 'none'}}>
              <div className="card-header">
                <span className="card-icon">🏗️</span>
                <span className="card-title">System Features</span>
              </div>
              <div className="card-features">
                /control-tower<br />
                /sign-in<br />
                /api/health
              </div>
            </div>
          </div>
          
          <p style={{fontSize: '10px', color: '#999', marginTop: '10px', textAlign: 'center'}}>
            💡 All URLs work with your current Railway deployment domain
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="button-container">
          <Link href="/" className="nav-button back-button">
            ←
          </Link>
          <Link href="/control-tower" className="nav-button home-button">
            🏗️
          </Link>
        </div>
      </div>
    </>
  )
}