'use client';

import Link from 'next/link';
import TenantBadge from '@/components/tenant/TenantBadge';

export default function MobileHomePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>JobEye Mobile Home</title>
        <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #000;
          color: white;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }

        .screen {
          width: 100%;
          max-width: 375px;
          height: 100%;
          max-height: 812px;
          margin: 0 auto;
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 10px;
          gap: 10px;
        }

        .container-1 {
          height: 75px;
          border: 3px solid #228B22;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.9);
          padding: 8px 15px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
          overflow: hidden;
        }

        .company-name {
          font-size: 18px;
          font-weight: 600;
          color: #228B22;
          margin-bottom: 2px;
        }

        .header-info {
          font-size: 12px;
          color: #ccc;
          line-height: 1.3;
        }

        .status-highlight {
          color: #FFC107;
          font-weight: 600;
        }

        .container-2 {
          flex: 1.375;
          border: 3px solid #666;
          border-radius: 12px;
          background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
          background-image:
            linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
            linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
            linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
          background-size: 20px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .camera-placeholder {
          color: #666;
          text-align: center;
          font-size: 14px;
          font-style: italic;
          padding: 20px;
          line-height: 1.4;
        }

        .container-3 {
          flex: 1.375;
          border: 3px solid #0066FF;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.9);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .details-content {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 15px;
        }

        .test-button {
          width: 100%;
          background: rgba(0, 100, 255, 0.2);
          border: 2px solid #0066FF;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          color: white;
          display: block;
        }

        .test-button:hover {
          background: rgba(0, 100, 255, 0.3);
          transform: scale(1.02);
        }

        .test-button:active {
          transform: scale(0.98);
        }

        .button-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .button-text {
          font-size: 16px;
          font-weight: 600;
          color: #0066FF;
        }

        .container-4 {
          height: 75px;
          display: flex;
          gap: 10px;
        }

        .container-4-comments {
          flex: 1;
          border: 3px solid #228B22;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.1);
          padding: 15px 12px 10px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
        }

        .container-4-wake {
          width: 75px;
          height: 75px;
          border: 3px solid #FF6B35;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
        }

        .container-4-wake:hover {
          background: rgba(255, 107, 53, 0.2);
          transform: scale(1.05);
        }

        .wake-button {
          color: #FF6B35;
          font-size: 24px;
          font-weight: bold;
        }

        .encouragement-text {
          font-size: 13px;
          line-height: 1.3;
          color: #ccc;
          font-weight: 500;
        }
        `}</style>
      </head>
      <body>
        <div className="screen">
        <div className="container-1">
          <div style={{ position: 'absolute', top: '5px', right: '10px', zIndex: 1 }}>
            <TenantBadge />
          </div>
          <div className="company-name">JobEye Mobile</div>
          <div className="header-info">
            Testing Interface<br />
            Status: <span className="status-highlight">Ready</span>
          </div>
        </div>

        <div className="container-2">
          <div className="camera-placeholder">
            📹<br />
            Camera Inactive
          </div>
        </div>

        <div className="container-3">
          <div className="details-content">
            <Link href="/mobile/job-load-checklist-start" className="test-button">
              <div className="button-icon">📋</div>
              <div className="button-text">Test Load Screen</div>
            </Link>

            <Link href="/mobile/test-list-dialog" className="test-button">
              <div className="button-icon">📝</div>
              <div className="button-text">Test List Creation Dialog</div>
            </Link>
          </div>
        </div>

        <div className="container-4">
          <div className="container-4-comments">
            <div className="encouragement-text">
              Select a test screen above
            </div>
          </div>
          <div className="container-4-wake">
            <div className="wake-button">🏠</div>
          </div>
        </div>
        </div>
      </body>
    </html>
  );
}
