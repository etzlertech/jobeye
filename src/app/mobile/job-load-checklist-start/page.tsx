'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ChecklistItem {
  id: string;
  name: string;
  icon: string;
  checked: boolean;
  detectedBy?: 'gpt4' | 'gemini' | 'both';
}

interface Detection {
  label: string;
  confidence: number;
  source?: 'gpt4' | 'gemini' | 'both';
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export default function JobLoadChecklistStartPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>('Waiting to start...');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: '1', name: 'Plastic Water Bottle', icon: '💧', checked: false },
    { id: '2', name: 'Computer Mouse', icon: '🖱️', checked: false },
    { id: '3', name: 'Book with Blue and Yellow Cover', icon: '📘', checked: false },
    { id: '4', name: 'Red Cup', icon: '🥤', checked: false },
    { id: '5', name: 'Whiteboard Eraser', icon: '🧽', checked: false },
    { id: '6', name: 'Computer Keyboard', icon: '⌨️', checked: false },
    { id: '7', name: 'Silver Laptop', icon: '💻', checked: false },
    { id: '8', name: 'Bag of Doritos', icon: '🍿', checked: false },
  ]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editableItems, setEditableItems] = useState(
    checklist.map(item => item.name)
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const analysisQueue = useRef<Set<number>>(new Set()); // Track frames in flight
  const sessionStartTime = useRef<number>(0); // Track session duration
  const frameCount = useRef<number>(0); // Track total frames sent

  const startCamera = async () => {
    try {
      console.log('Requesting camera access...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
        audio: false
      });
      console.log('Camera access granted!', mediaStream);
      setStream(mediaStream);
      startAnalysis();
    } catch (err: any) {
      console.error('Camera error:', err);
      alert('Camera access denied: ' + err.message);
    }
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Return as base64 JPEG
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const analyzeFrame = async () => {
    const frameData = captureFrame();
    if (!frameData) {
      console.error('[VLM] Failed to capture frame - video or canvas not ready');
      return;
    }

    // Generate unique frame ID for tracking
    const frameId = Date.now();
    
    // Check if we have too many concurrent requests (limit to 3)
    if (analysisQueue.current.size >= 3) {
      console.log(`[VLM] Skipping frame ${frameId} - too many concurrent analyses (${analysisQueue.current.size})`);
      return;
    }

    // Add to queue and increment frame count
    analysisQueue.current.add(frameId);
    frameCount.current++;
    
    const timestamp = new Date().toISOString();
    const elapsed = (Date.now() - sessionStartTime.current) / 1000;
    console.log(`[VLM] ${timestamp} - Starting analysis #${frameId} (${analysisQueue.current.size} in flight, ${frameCount.current} total, ${elapsed.toFixed(1)}s elapsed)`);

    try {
      // Only look for unchecked items
      const uncheckedItems = checklist.filter(item => !item.checked);

      // If all items found, stop analysis and camera
      if (uncheckedItems.length === 0) {
        console.log('[VLM] ✅ All items detected! Stopping analysis and camera...');
        setDetectionStatus('✅ LIST COMPLETED!');
        setIsAnalyzing(false);

        // Stop the interval
        if (analysisIntervalRef.current) {
          clearInterval(analysisIntervalRef.current);
          analysisIntervalRef.current = null;
        }

        // Stop the camera
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }

        // Clear queue
        analysisQueue.current.clear();
        return;
      }

      const expectedItems = uncheckedItems.map(item => item.name);
      const estimatedCost = (frameCount.current * 0.039).toFixed(3);

      setDetectionStatus(`🔍 Analyzing (${uncheckedItems.length} remaining, ${analysisQueue.current.size} frames processing, ~$${estimatedCost})...`);
      console.log(`[VLM] Unchecked items remaining (${uncheckedItems.length}):`, expectedItems);
      console.log(`[VLM] Already detected (${checklist.length - uncheckedItems.length}):`, checklist.filter(item => item.checked).map(item => item.name));

      // Call VLM API
      const requestStart = performance.now();
      const response = await fetch('/api/vision/vlm-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: frameData,
          expectedItems,
          includeBboxes: true,
        }),
      });
      const requestDuration = performance.now() - requestStart;

      console.log(`[VLM] Frame #${frameId} API Response: ${response.status} ${response.statusText} (${requestDuration.toFixed(0)}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[VLM] Frame #${frameId} API Error:`, errorText);
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[VLM] Frame #${frameId} Success - Detections:`, {
        count: result.detections?.length || 0,
        detections: result.detections,
        winner: result.winner,
        gpt4TimeMs: result.gpt4TimeMs,
        geminiTimeMs: result.geminiTimeMs,
        gpt4Success: result.gpt4Success,
        geminiSuccess: result.geminiSuccess,
        processingTimeMs: result.processingTimeMs,
        estimatedCost: result.estimatedCost
      });

      if (result.detections && result.detections.length > 0) {
        setDetections(result.detections);
        const detectedLabels = result.detections.map((d: Detection) => d.label).join(', ');

        // Show detection info
        const winnerEmoji = result.winner === 'gpt4' ? '🤖 GPT-4 Fallback' : '💎 Gemini';
        const timeMs = result.geminiTimeMs || result.gpt4TimeMs || 0;

        setDetectionStatus(`${winnerEmoji} (${timeMs}ms): ${detectedLabels}`);

        // Auto-check matching items
        setChecklist(prev => {
          let hasChanges = false;
          const updated = prev.map(item => {
            // Skip if already checked
            if (item.checked) return item;

            // Check if this item matches any detection
            const matchingDetection = result.detections.find((d: Detection) =>
              d.label.toLowerCase().includes(item.name.toLowerCase()) ||
              item.name.toLowerCase().includes(d.label.toLowerCase())
            );

            if (matchingDetection) {
              console.log(`[VLM] Match found: "${matchingDetection.label}" → "${item.name}" (source: ${matchingDetection.source}, confidence: ${Math.round(matchingDetection.confidence * 100)}%)`);
              console.log(`[VLM] Auto-checking: ${item.name}`);
              hasChanges = true;
              return { ...item, checked: true, detectedBy: matchingDetection.source };
            }
            return item;
          });

          // Only sort if there were changes
          if (!hasChanges) return prev;

          // Sort: unchecked items first, checked items last
          const sorted = updated.sort((a, b) => {
            if (a.checked === b.checked) return 0;
            return a.checked ? 1 : -1;
          });

          // Flash animation and sound on detection
          if (hasChanges) {
            setShowFlash(true);
            // Simple beep sound
            playBeep();
            setTimeout(() => setShowFlash(false), 300);
          }

          return sorted;
        });
      } else {
        console.log(`[VLM] Frame #${frameId} - No detections in response`);
        setDetections([]);
      }
    } catch (error: any) {
      console.error(`[VLM] Frame #${frameId} Detection error:`, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      setDetectionStatus(`❌ Frame #${frameId} failed`);
    } finally {
      // Remove from queue when done
      analysisQueue.current.delete(frameId);
      console.log(`[VLM] Frame #${frameId} completed. ${analysisQueue.current.size} still processing.`);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setDetectionStatus('Starting analysis...');

    // Reset session tracking
    sessionStartTime.current = Date.now();
    frameCount.current = 0;
    analysisQueue.current.clear();

    // Minimal delay for video to initialize (reduced from 500ms to 100ms)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send first frame immediately for quick initial capture
    console.log('[VLM] Sending initial frame immediately...');
    analyzeFrame();

    // Set aggressive capture interval: 0.5 seconds = 2 fps
    // This allows 3-4 frames in 2 seconds as requested
    // Cost: ~$0.039 per frame, max 30 frames in 15 seconds = $1.17 max
    analysisIntervalRef.current = setInterval(() => {
      // Check 15-second safety limit
      const elapsed = (Date.now() - sessionStartTime.current) / 1000;
      if (elapsed >= 15) {
        console.log(`[VLM] 🔒 15-second safety limit reached. Stopping analysis. Frames sent: ${frameCount.current}, Est. cost: $${(frameCount.current * 0.039).toFixed(3)}`);
        setDetectionStatus(`🔒 15s limit reached (${frameCount.current} frames, ~$${(frameCount.current * 0.039).toFixed(2)})`);
        stopCamera();
        return;
      }
      
      analyzeFrame();
    }, 500); // 2 fps for responsive detection
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    
    // Show final session statistics
    const elapsed = (Date.now() - sessionStartTime.current) / 1000;
    const finalCost = (frameCount.current * 0.039).toFixed(3);
    console.log(`[VLM] 📊 Session ended: ${frameCount.current} frames in ${elapsed.toFixed(1)}s, Est. cost: $${finalCost}`);
    
    setIsAnalyzing(false);
    analysisQueue.current.clear();
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const playBeep = () => {
    try {
      // Try HTML5 Audio first (might work better on Safari)
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYJGmW58OScTgwOUazi5LllHQU7ks3w14w5CRuDy/DThDYJHLzx8//6fzIHP5pVBAAA/74AAPhDAAAP/wAAmkEAAG9PAABm/wAAWEoAAE8yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      audio.volume = 0.5;
      audio.play().then(() => {
        console.log('[Audio] HTML5 beep played');
      }).catch(err => {
        console.log('[Audio] HTML5 audio failed, trying Web Audio API');
        
        // Fallback to Web Audio API
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
          const audioContext = audioContextRef.current;
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          
          console.log('[Audio] Web Audio API beep played');
        }
      });
    } catch (err) {
      console.error('[Audio] Beep error:', err);
    }
  };

  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state !== 'running') {
        console.warn('[Audio] Context not ready for success sound. State:', audioContextRef.current?.state);
        return;
      }
      
      const audioContext = audioContextRef.current;
      
      const now = audioContext.currentTime;
      const duration = 0.6;
      
      // Create multiple oscillators for a celebratory chord progression
      const notes = [
        { freq: 523.25, start: 0 },      // C5
        { freq: 659.25, start: 0.1 },    // E5
        { freq: 783.99, start: 0.2 },    // G5
        { freq: 1046.5, start: 0.3 },    // C6
      ];
      
      notes.forEach(({ freq, start }) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        // Envelope
        gainNode.gain.setValueAtTime(0, now + start);
        gainNode.gain.linearRampToValueAtTime(0.4, now + start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
        
        oscillator.start(now + start);
        oscillator.stop(now + start + duration);
      });
      
      console.log('[Audio] Success chord played!');
    } catch (err) {
      console.error('[Audio] Failed to play success sound:', err);
    }
  };

  const handleStart = async () => {
    // Initialize audio context on user interaction (Safari requirement)
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        console.log('[Audio] Context created on START button press, state:', audioContextRef.current.state);
      }
      
      // CRITICAL for Safari: Must resume on user gesture
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[Audio] Context resumed successfully, state:', audioContextRef.current.state);
      }
      
      // Test beep to verify audio is working
      if (audioContextRef.current.state === 'running') {
        const osc = audioContextRef.current.createOscillator();
        const gain = audioContextRef.current.createGain();
        osc.connect(gain);
        gain.connect(audioContextRef.current.destination);
        gain.gain.value = 0.2;
        osc.frequency.value = 440;
        osc.start();
        osc.stop(audioContextRef.current.currentTime + 0.1);
        console.log('[Audio] Test beep should play now');
      } else {
        console.warn('[Audio] Context not running after resume, state:', audioContextRef.current.state);
      }
    } catch (e) {
      console.error('[Audio] Failed to initialize:', e);
    }
    
    if (!stream) {
      // Camera not started yet - start it
      startCamera();
    } else if (allChecked) {
      // All items checked - verify and finish
      alert('Load verified! Ready to proceed.');
      stopCamera();
    }
  };

  const handleStop = () => {
    stopCamera();
  };

  const openSettings = () => {
    setEditableItems(checklist.map(item => item.name));
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  const saveSettings = () => {
    const icons = ['💧', '🖱️', '📘', '🥤', '🧽', '⌨️', '💻', '🍿']; // Default icons
    const updatedChecklist = editableItems.map((name, index) => ({
      id: (index + 1).toString(),
      name: name.trim() || `Item ${index + 1}`,
      icon: icons[index] || '📦',
      checked: false
    }));
    
    setChecklist(updatedChecklist);
    setShowSettings(false);
  };

  const updateEditableItem = (index: number, value: string) => {
    const updated = [...editableItems];
    updated[index] = value;
    setEditableItems(updated);
  };

  const clearField = (index: number) => {
    // Clear the field value
    const updated = [...editableItems];
    updated[index] = '';
    setEditableItems(updated);
    
    // Focus the input and position cursor at the beginning
    setTimeout(() => {
      const input = inputRefs.current[index];
      if (input) {
        input.focus();
        input.setSelectionRange(0, 0);
      }
    }, 10);
  };

  // Attach stream to video element when stream changes
  useEffect(() => {
    if (stream && videoRef.current) {
      console.log('Attaching stream to video element');
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.error('Play error:', err));
    }
  }, [stream]);

  useEffect(() => {
    // Camera start disabled - use manual button instead
    console.log('Page loaded - click button to start camera');
    setMounted(true);
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for all items being checked
  useEffect(() => {
    const allChecked = checklist.every(item => item.checked);
    if (allChecked && checklist.length > 0 && isAnalyzing) {
      console.log('[AUTO-STOP] All items checked! Stopping...');
      setDetectionStatus('✅ LIST COMPLETED!');
      setIsAnalyzing(false);
      
      // Play success sound and show confetti
      playSuccessSound();
      setShowConfetti(true);
      
      // Stop confetti after 8 seconds
      setTimeout(() => setShowConfetti(false), 8000);
      
      // Stop the interval immediately
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
      
      // Stop camera after delay
      setTimeout(() => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }, 1500);
    }
  }, [checklist, isAnalyzing, stream]);

  const allChecked = checklist.every(item => item.checked);

  return (
    <>
      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #000;
          color: white;
          overflow: hidden;
        }

        .mobile-screen {
          width: 100vw;
          height: 100vh;
          max-width: 375px;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          display: flex;
          flex-direction: column;
          padding: 10px;
          gap: 8px;
        }

        .container-1 {
          height: 50px;
          border-radius: 12px;
          background: #000;
          padding: 8px 15px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }

        .company-name {
          font-size: 22px;
          font-weight: 600;
          color: #FFD700;
          text-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
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
          flex: 1.3;
          border: 3px solid #FFC107;
          border-radius: 12px;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .video-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
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

        .detection-text {
          color: #000;
          font-weight: bold;
          font-size: 14px;
        }

        .container-3 {
          flex: 1.7;
          border-radius: 12px;
          background: #000;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .details-content {
          padding: 15px 0;
          overflow-y: auto;
          flex: 1;
        }

        .checklist-title {
          color: #0066FF;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          padding: 0 15px;
        }

        .checklist-items {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          background: rgba(0, 100, 255, 0.1);
          border: 2px solid #0066FF;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 44px;
        }

        .checklist-item:hover {
          background: rgba(0, 100, 255, 0.2);
          transform: scale(1.02);
        }

        .checklist-item:active {
          transform: scale(0.98);
        }

        .checklist-item.checked {
          background: rgba(34, 139, 34, 0.2);
          border-color: #228B22;
        }

        .item-checkbox {
          width: 24px;
          height: 24px;
          border: 2px solid #0066FF;
          border-radius: 4px;
          margin-right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          flex-shrink: 0;
        }

        .checklist-item.checked .item-checkbox {
          background: #228B22;
          border-color: #228B22;
        }

        .checkmark {
          color: white;
          font-weight: bold;
          font-size: 14px;
        }

        .item-content {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .item-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .item-name {
          color: #ddd;
          font-size: 11px;
          font-weight: 500;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .container-4 {
          height: 75px;
          display: flex;
          gap: 10px;
        }

        .button-half {
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
        }

        .button-stop {
          border-color: #FF6B35;
          color: #FF6B35;
        }

        .button-stop:hover {
          background: rgba(255, 107, 53, 0.2);
          transform: scale(1.05);
        }

        .button-yes {
          border-color: #228B22;
          color: #228B22;
        }

        .button-yes:hover {
          background: rgba(34, 139, 34, 0.2);
          transform: scale(1.05);
        }

        .button-yes.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .button-yes.disabled:hover {
          background: #000;
          transform: scale(1);
        }

        .flash-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 255, 0, 0.4);
          pointer-events: none;
          animation: flash 0.3s ease-out;
          z-index: 9999;
        }

        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }

        .confetti-container {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          pointer-events: none;
          overflow: visible !important;
          z-index: 99999 !important;
          transform: none !important;
        }

        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          background: #f0f;
        }

        .confetti-1 { 
          width: 13px; 
          height: 13px; 
          background: linear-gradient(45deg, #ff0080, #ff8c00);
          animation: confetti-fall-1 8s linear forwards;
        }
        .confetti-2 { 
          width: 10px; 
          height: 16px; 
          background: linear-gradient(45deg, #00ff88, #00ffff);
          animation: confetti-fall-2 8s linear forwards;
        }
        .confetti-3 { 
          width: 11px; 
          height: 11px; 
          background: linear-gradient(45deg, #ffff00, #ffaa00);
          animation: confetti-fall-3 8s linear forwards;
        }
        .confetti-4 { 
          width: 9px; 
          height: 14px; 
          background: linear-gradient(45deg, #ff00ff, #ff0080);
          animation: confetti-fall-1 8s linear forwards;
        }
        .confetti-5 { 
          width: 15px; 
          height: 8px; 
          background: linear-gradient(45deg, #00ff00, #00ff88);
          animation: confetti-fall-2 8s linear forwards;
        }
        .confetti-6 { 
          width: 12px; 
          height: 12px; 
          background: linear-gradient(45deg, #4169e1, #00bfff);
          animation: confetti-fall-3 8s linear forwards;
        }

        @keyframes confetti-fall-1 {
          0% {
            transform: translateY(-100vh) translateX(0) rotate(0deg) scale(0);
            opacity: 1;
          }
          10% {
            transform: translateY(-80vh) translateX(10px) rotate(90deg) scale(1);
          }
          20% {
            transform: translateY(-60vh) translateX(-10px) rotate(180deg) scale(1);
          }
          30% {
            transform: translateY(-40vh) translateX(15px) rotate(270deg) scale(1);
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(-20px) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes confetti-fall-2 {
          0% {
            transform: translateY(-100vh) translateX(0) rotate(0deg) scale(0);
            opacity: 1;
          }
          10% {
            transform: translateY(-80vh) translateX(-15px) rotate(-90deg) scale(1);
          }
          25% {
            transform: translateY(-50vh) translateX(20px) rotate(-180deg) scale(1);
          }
          40% {
            transform: translateY(-20vh) translateX(-25px) rotate(-270deg) scale(1);
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(15px) rotate(-630deg) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes confetti-fall-3 {
          0% {
            transform: translateY(-100vh) translateX(0) rotate(0deg) scale(0);
            opacity: 1;
          }
          15% {
            transform: translateY(-70vh) translateX(25px) rotate(120deg) scale(1);
          }
          35% {
            transform: translateY(-35vh) translateX(-15px) rotate(240deg) scale(1);
          }
          55% {
            transform: translateY(0vh) translateX(10px) rotate(360deg) scale(1);
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(-10px) rotate(540deg) scale(0.3);
            opacity: 0;
          }
        }

        .settings-button {
          position: absolute;
          top: 15px;
          left: 15px;
          width: 44px;
          height: 44px;
          background: rgba(0, 0, 0, 0.7);
          border: 2px solid #FFD700;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1000;
          transition: all 0.3s ease;
        }

        .settings-button:hover {
          background: rgba(255, 215, 0, 0.2);
          transform: scale(1.1);
        }

        .settings-button:active {
          transform: scale(0.95);
        }

        .settings-icon {
          font-size: 20px;
          color: #FFD700;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          padding: 20px;
        }

        .modal-content {
          background: #1a1a1a;
          border: 3px solid #FFD700;
          border-radius: 12px;
          padding: 20px;
          width: 100%;
          max-width: 400px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          color: #FFD700;
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 20px;
          text-align: center;
        }

        .input-group {
          margin-bottom: 15px;
        }

        .input-label {
          color: #ddd;
          font-size: 14px;
          margin-bottom: 5px;
          display: block;
        }

        .input-field {
          width: 100%;
          padding: 12px;
          background: #2a2a2a;
          border: 2px solid #666;
          border-radius: 8px;
          color: #fff;
          font-size: 16px;
          box-sizing: border-box;
        }

        .input-field:focus {
          outline: none;
          border-color: #FFD700;
        }

        .input-with-clear {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-clear .input-field {
          padding-right: 45px; /* Make room for clear button */
        }

        .clear-button {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: #666;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 1;
        }

        .clear-button:hover {
          background: #FFD700;
          color: #000;
          transform: translateY(-50%) scale(1.1);
        }

        .clear-button:active {
          transform: translateY(-50%) scale(0.95);
        }

        .modal-buttons {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .modal-button {
          flex: 1;
          padding: 12px;
          border: 2px solid;
          border-radius: 8px;
          background: #000;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .modal-button.primary {
          border-color: #228B22;
          color: #228B22;
        }

        .modal-button.primary:hover {
          background: rgba(34, 139, 34, 0.2);
        }

        .modal-button.secondary {
          border-color: #FF6B35;
          color: #FF6B35;
        }

        .modal-button.secondary:hover {
          background: rgba(255, 107, 53, 0.2);
        }
      `}</style>
      <div className="mobile-screen">
        <div className="container-1">
          <div className="company-name">Evergold Landscaping</div>
          <div className="settings-button" onClick={openSettings}>
            <div className="settings-icon">⚙️</div>
          </div>
        </div>

        <div className="container-2">
          {stream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="video-feed"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              {detections.map((detection, index) => (
                detection.bbox && (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      left: `${detection.bbox.x}%`,
                      top: `${detection.bbox.y}%`,
                      width: `${detection.bbox.width}%`,
                      height: `${detection.bbox.height}%`,
                      border: '3px solid #00FF00',
                      borderRadius: '4px',
                      boxShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
                      pointerEvents: 'none'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '-25px',
                        left: '0',
                        background: '#00FF00',
                        color: '#000',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {detection.label} ({Math.round(detection.confidence * 100)}%)
                    </div>
                  </div>
                )
              ))}
              {isAnalyzing && (
                <div className="detection-overlay">
                  <div className="detection-text">{detectionStatus}</div>
                </div>
              )}
            </>
          ) : (
            <div style={{
              color: '#ddd',
              textAlign: 'center',
              padding: '40px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              {allChecked ? (
                <>
                  <div style={{
                    fontSize: '64px',
                    marginBottom: '20px',
                  }}>✅</div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginBottom: '10px',
                    color: '#228B22'
                  }}>LIST COMPLETED!</div>
                  <div style={{
                    fontSize: '14px',
                    opacity: 0.7
                  }}>All {checklist.length} items verified</div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '20px',
                    opacity: 0.7
                  }}>📷</div>
                  <div style={{
                    fontSize: '16px',
                    marginBottom: '10px',
                    opacity: 0.9
                  }}>Camera Ready</div>
                  <div style={{
                    fontSize: '12px',
                    opacity: 0.6
                  }}>Press START to begin detection</div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="container-3">
          <div className="details-content">
            <div className="checklist-title">Equipment Checklist:</div>
            <div className="checklist-items">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className={`checklist-item ${item.checked ? 'checked' : ''}`}
                  onClick={() => toggleChecklistItem(item.id)}
                >
                  <div className="item-checkbox">
                    {item.checked && <span className="checkmark">✓</span>}
                  </div>
                  <div className="item-content">
                    <div className="item-icon">{item.icon}</div>
                    <div className="item-name">{item.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container-4">
          <div
            className={`button-half button-yes ${stream && !allChecked ? 'disabled' : ''}`}
            onClick={handleStart}
          >
            START
          </div>
          <div className="button-half button-stop" onClick={handleStop}>
            STOP
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {showFlash && <div className="flash-overlay" />}
      {mounted && showConfetti && createPortal(
        <div className="confetti-container" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 99999
        }}>
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className={`confetti-${(i % 6) + 1}`}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 4}s`,
                borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '20%' : '0'
              }}
            />
          ))}
        </div>,
        document.body
      )}
      {showSettings && (
        <div className="modal-overlay" onClick={closeSettings}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Edit Checklist Items</div>
            {editableItems.map((item, index) => (
              <div key={index} className="input-group">
                <label className="input-label">Item {index + 1}:</label>
                <div className="input-with-clear">
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current[index] = el;
                    }}
                    type="text"
                    className="input-field"
                    value={item}
                    onChange={(e) => updateEditableItem(index, e.target.value)}
                    placeholder={`Enter item ${index + 1} name...`}
                    maxLength={50}
                  />
                  <button
                    className="clear-button"
                    onClick={() => clearField(index)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="modal-buttons">
              <button className="modal-button secondary" onClick={closeSettings}>
                Cancel
              </button>
              <button className="modal-button primary" onClick={saveSettings}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
