'use client';

import Link from 'next/link'

export default function Home() {
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

        .demo-container {
          border-color: #0066FF;
        }

        .control-container {
          border-color: #FF6B35;
        }

        .mobile-container {
          border-color: #228B22;
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
        }

        .demo-title {
          color: #0066FF;
        }

        .control-title {
          color: #FF6B35;
        }

        .mobile-title {
          color: #228B22;
        }

        .demo-grid {
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

        .demo-main {
          border-color: #0066FF;
          background: rgba(0, 100, 255, 0.1);
        }

        .demo-main:hover {
          background: rgba(0, 100, 255, 0.2);
        }

        .control-card {
          border-color: #FF6B35;
          background: rgba(255, 107, 53, 0.1);
        }

        .control-card:hover {
          background: rgba(255, 107, 53, 0.2);
        }

        .mobile-card {
          border-color: #228B22;
          background: rgba(34, 139, 34, 0.1);
        }

        .mobile-card:hover {
          background: rgba(34, 139, 34, 0.2);
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
          font-size: 14px;
          line-height: 1.2;
        }

        .card-description {
          font-size: 11px;
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

        .demo-button {
          border-color: #0066FF;
          color: #0066FF;
        }

        .demo-button:hover {
          background: rgba(0, 100, 255, 0.2);
          transform: scale(1.05);
        }

        .control-button {
          border-color: #FF6B35;
          color: #FF6B35;
        }

        .control-button:hover {
          background: rgba(255, 107, 53, 0.2);
          transform: scale(1.05);
        }

        @media (min-width: 768px) {
          .mobile-screen {
            max-width: 768px;
            padding: 20px;
          }

          .demo-grid {
            grid-template-columns: 1fr 1fr;
          }

          .card-title {
            font-size: 16px;
          }

          .card-description {
            font-size: 13px;
          }

          .card-features {
            font-size: 11px;
          }
        }
      `}</style>

      <div className="mobile-screen">
        <div className="container-section header-container">
          <div className="company-name">JobEye Dev Hub</div>
          <div className="header-info">
            Railway Production • Mobile Testing<br />
            Status: <span style={{color: '#FFC107', fontWeight: 600}}>Live</span>
          </div>
        </div>
        
        {/* Demo Hub Section */}
        <div className="container-section demo-container">
          <h2 className="section-title demo-title">🎭 Complete Demo Hub</h2>
          
          <div className="demo-grid">
            <Link href="/demo-hub" className="demo-card demo-main">
              <div className="card-header">
                <span className="card-icon">🚀</span>
                <span className="card-title">Enter Demo Hub</span>
              </div>
              <p className="card-description">
                Comprehensive UI/UX demos with role-based interfaces, AI features, and workflow testing
              </p>
              <div className="card-features">
                • Role-based interfaces (Supervisor, Crew, Admin)<br />
                • AI & Vision features (YOLO+VLM, Gemini)<br />
                • Voice commands & workflow testing<br />
                • Mobile-optimized with task card layouts
              </div>
            </Link>
          </div>
        </div>

        {/* Control Tower Section */}
        <div className="container-section control-container">
          <h2 className="section-title control-title">🏗️ Architecture Control</h2>
          
          <div className="demo-grid">
            <Link href="/control-tower" className="demo-card control-card">
              <div className="card-header">
                <span className="card-icon">📋</span>
                <span className="card-title">Control Tower</span>
              </div>
              <p className="card-description">
                Architecture monitoring and system configuration
              </p>
              <div className="card-features">
                • Architecture visualization<br />
                • Project management<br />
                • Standards library<br />
                • Progress tracking
              </div>
            </Link>
          </div>
        </div>

        {/* Mobile Interfaces Section */}
        <div className="container-section mobile-container">
          <h2 className="section-title mobile-title">📱 Direct Mobile Access</h2>
          
          <div className="demo-grid">
            <Link href="/mobile/job-load-checklist-start" className="demo-card mobile-card">
              <div className="card-header">
                <span className="card-icon">🎯</span>
                <span className="card-title">Gemini VLM Checklist</span>
              </div>
              <p className="card-description">
                Real-time equipment detection using Gemini AI vision
              </p>
              <div className="card-features">
                • Live camera feed analysis<br />
                • Auto-check detected items<br />
                • Mobile-optimized interface
              </div>
            </Link>
            
            <Link href="/mobile/equipment-verification" className="demo-card mobile-card">
              <div className="card-header">
                <span className="card-icon">✅</span>
                <span className="card-title">YOLO + VLM Detection</span>
              </div>
              <p className="card-description">
                Hybrid local/cloud equipment verification
              </p>
              <div className="card-features">
                • Local YOLO inference<br />
                • GPT-4 Vision fallback<br />
                • Offline queue support
              </div>
            </Link>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="button-container">
          <Link href="/demo-hub" className="nav-button demo-button">
            🎭
          </Link>
          <Link href="/control-tower" className="nav-button control-button">
            🏗️
          </Link>
        </div>
      </div>
    </>
  )
}