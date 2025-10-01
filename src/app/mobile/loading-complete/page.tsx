'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function LoadingCompletePage() {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const toggleItem = (item: string) => {
    setSelectedItems(prev =>
      prev.includes(item)
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  const selectAll = () => {
    setSelectedItems(['Gas Trimmers', 'Edging Equipment', 'Hedge Trimmers', 'Safety Gear']);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      alert('Camera access denied: ' + err.message);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    setPhoto(photoData);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Simulate detection
    setIsProcessing(true);
    setTimeout(() => {
      setSelectedItems(['Gas Trimmers', 'Edging Equipment', 'Hedge Trimmers', 'Safety Gear']);
      setIsProcessing(false);
    }, 1500);
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Equipment Loading</title>
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
            border: 3px solid #FFC107;
            border-radius: 12px;
            background: linear-gradient(135deg, #2a4d2a 0%, #1a3d1a 100%);
            background-image:
              linear-gradient(45deg, #2a4d2a 25%, transparent 25%),
              linear-gradient(-45deg, #2a4d2a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a4d2a 75%),
              linear-gradient(-45deg, transparent 75%, #2a4d2a 75%);
            background-size: 20px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
          }

          .image-placeholder {
            color: #888;
            text-align: center;
            font-size: 14px;
            font-style: italic;
            padding: 20px;
            line-height: 1.4;
          }

          .detection-overlay {
            position: absolute;
            bottom: 15px;
            left: 15px;
            right: 15px;
            background: rgba(255, 193, 7, 0.95);
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
          }

          .detection-title {
            color: #000;
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 4px;
          }

          .detection-detail {
            color: #333;
            font-size: 12px;
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
          }

          .selection-title {
            color: #0066FF;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
          }

          .grid-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 20px;
          }

          .grid-row {
            display: flex;
            gap: 8px;
          }

          .item-card {
            flex: 1;
            background: rgba(0, 100, 255, 0.2);
            border: 2px solid #0066FF;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
          }

          .item-card:hover {
            background: rgba(0, 100, 255, 0.3);
            transform: scale(1.05);
          }

          .item-card:active {
            transform: scale(0.95);
          }

          .item-card.selected {
            background: rgba(34, 139, 34, 0.3);
            border-color: #228B22;
          }

          .item-icon {
            font-size: 24px;
            margin-bottom: 8px;
          }

          .item-name {
            color: #ddd;
            font-size: 12px;
            line-height: 1.2;
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
            <div className="company-name">Miller's Landscaping</div>
            <div className="header-info">
              Joe Miller • Monday 9/15<br />
              Crew 1 • Truck 1 • Status: <span className="status-highlight">Loading Equipment</span>
            </div>
          </div>

          <div className="container-2">
            {stream && !photo && (
              <>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={capturePhoto}
                  style={{
                    position: 'absolute',
                    bottom: '15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,0.95)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '60px',
                    height: '60px',
                    fontSize: '28px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                >
                  📸
                </button>
              </>
            )}

            {photo && (
              <>
                <img src={photo} alt="Equipment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {isProcessing && (
                  <div className="detection-overlay">
                    <div className="detection-title">Processing Equipment Detection...</div>
                    <div className="detection-detail">Analyzing image</div>
                  </div>
                )}
                {!isProcessing && (
                  <div className="detection-overlay">
                    <div className="detection-title">✓ Equipment Items Detected</div>
                    <div className="detection-detail">All items verified</div>
                  </div>
                )}
              </>
            )}

            {!stream && !photo && (
              <div className="image-placeholder">
                Starting camera...
              </div>
            )}
          </div>

          <div className="container-3">
            <div className="details-content">
              <div className="selection-title">Select/say action, or "X" for other:</div>

              <div className="grid-container">
                <div className="grid-row">
                  <div
                    className={`item-card ${selectedItems.includes('Gas Trimmers') ? 'selected' : ''}`}
                    onClick={() => toggleItem('Gas Trimmers')}
                  >
                    <div className="item-icon">🌿</div>
                    <div className="item-name">Gas<br />Trimmers</div>
                  </div>
                  <div
                    className={`item-card ${selectedItems.includes('Edging Equipment') ? 'selected' : ''}`}
                    onClick={() => toggleItem('Edging Equipment')}
                  >
                    <div className="item-icon">✂️</div>
                    <div className="item-name">Edging<br />Equipment</div>
                  </div>
                </div>
                <div className="grid-row">
                  <div
                    className={`item-card ${selectedItems.includes('Hedge Trimmers') ? 'selected' : ''}`}
                    onClick={() => toggleItem('Hedge Trimmers')}
                  >
                    <div className="item-icon">🪚</div>
                    <div className="item-name">Hedge<br />Trimmers</div>
                  </div>
                  <div
                    className={`item-card ${selectedItems.includes('Safety Gear') ? 'selected' : ''}`}
                    onClick={() => toggleItem('Safety Gear')}
                  >
                    <div className="item-icon">🦺</div>
                    <div className="item-name">Safety<br />Gear</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container-4">
            <div
              className={`container-4-comments ${selectedItems.length === 4 ? 'selected' : ''}`}
              onClick={selectAll}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ fontSize: '32px', marginBottom: '4px' }}>✓</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#228B22' }}>All 4</div>
            </div>
            <Link href="/mobile" className="container-4-wake">
              <div className="wake-button">✕</div>
            </Link>
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </body>
    </html>
  );
}
