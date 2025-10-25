/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/crew/job-load/page.tsx
 * phase: 3
 * domain: crew
 * purpose: Job load verification screen for crew members using Gemini API
 * spec_ref: 007-mvp-intent-driven/contracts/crew-ui.md
 * complexity_budget: 500
 * migrations_touched: []
 * state_machine: {
 *   states: ['loading', 'job_select', 'camera_active', 'verifying', 'completed'],
 *   transitions: [
 *     'loading->job_select: jobsLoaded()',
 *     'job_select->camera_active: selectJob()',
 *     'camera_active->verifying: captureImage()',
 *     'verifying->camera_active: continueVerifying()',
 *     'verifying->completed: allItemsVerified()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "verify": "$0.003-0.005 per frame (Gemini/GPT-4)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/domains/vision/services'],
 *   external: ['react', 'next/navigation', 'react-dom'],
 *   supabase: []
 * }
 * exports: ['default']
 * voice_considerations: Voice confirmation for load verification
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/crew-job-load.test.ts'
 * }
 * tasks: [
 *   'Create job selection interface',
 *   'Implement camera capture with Gemini API',
 *   'Real-time equipment detection',
 *   'Save verification results to job'
 * ]
 */

'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';

const VLM_ERROR_COOLDOWN_MS = 5000;
const VLM_TIMEOUT_COOLDOWN_MS = 3500;
const TARGET_IMAGE_SIZE = 512; // Optimal for VLM performance - reduces latency by ~27%
const JPEG_QUALITY = 0.7; // Balanced quality/speed - smaller files = faster upload

interface Job {
  id: string;
  customer_name: string;
  property_address: string;
  scheduled_time: string;
  status: string;
  kit_items: string[];
  verified_items: string[];
}

interface RequiredItem {
  id: string;
  name: string;
  icon?: string;
  checked: boolean;
  confidence?: number; // VLM match confidence (0-1)
  note?: string;
  source?: 'table' | 'jsonb'; // Item source from API _meta
}

interface Detection {
  name: string;
  status: 'present' | 'missing' | 'uncertain';
  confidence?: number;
  note?: string;
}

function CrewJobLoadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>('Waiting to start...');
  const [requiredItems, setRequiredItems] = useState<RequiredItem[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editableItems, setEditableItems] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<'job_select' | 'camera'>('job_select');
  const [itemMeta, setItemMeta] = useState<{table: number; jsonb: number} | null>(null);
  const [jobLoadV2Enabled, setJobLoadV2Enabled] = useState<boolean | null>(null); // null = loading
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const analysisQueue = useRef<Set<number>>(new Set());
  const sessionStartTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const isAnalyzingRef = useRef(false);
  const lastDetectionsRef = useRef<Detection[]>([]);

  // Initialize job items when selected
  useEffect(() => {
    if (selectedJob) {
      const items = selectedJob.kit_items.map((item, index) => ({
        id: `item-${index}`,
        name: item,
        checked: selectedJob.verified_items?.includes(item) || false
      }));
      setRequiredItems(items);
      setEditableItems(items.map(item => item.name));
    }
  }, [selectedJob]);

  // Check feature flag on mount
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const response = await fetch('/api/features/job-load-v2');
        if (response.ok) {
          const data = await response.json();
          setJobLoadV2Enabled(data.enabled);
          console.log('[FeatureFlag] Job load v2 enabled:', data.enabled);
        } else {
          // If endpoint fails, default to false
          setJobLoadV2Enabled(false);
          console.warn('[FeatureFlag] Failed to check job load v2 feature, defaulting to false');
        }
      } catch (err) {
        console.error('[FeatureFlag] Error checking job load v2:', err);
        setJobLoadV2Enabled(false);
      }
    };

    checkFeatureFlag();
  }, []);

  // Load jobs on mount
  useEffect(() => {
    setMounted(true);
    loadJobs();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  // Auto-select job from query parameter
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId && jobs.length > 0 && !selectedJob) {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        console.log('[JobLoad] Auto-selecting job from query parameter:', jobId);
        selectJob(job);
      }
    }
  }, [jobs, selectedJob, searchParams]);

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/crew/jobs/today');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      // Load actual equipment for each job from the database
      const jobsWithKits = await Promise.all((data.jobs || []).map(async (job: any) => {
        try {
          // Fetch the equipment list for this job
          const equipmentResponse = await fetch(`/api/crew/jobs/${job.id}/equipment`);
          
          if (equipmentResponse.ok) {
            const equipmentData = await equipmentResponse.json();
            const equipment = equipmentData.equipment || [];
            const meta = equipmentData._meta;

            // Log metadata for debugging
            if (meta) {
              console.log(`[Equipment] Job ${job.id} metadata:`, {
                total: meta.total,
                table_items: meta.sources?.table || 0,
                jsonb_items: meta.sources?.jsonb || 0
              });
            }

            return {
              ...job,
              kit_items: equipment.map((item: any) => item.name),
              verified_items: equipment.filter((item: any) => item.checked).map((item: any) => item.name),
              _meta: meta
            };
          } else {
            // Fallback to default items if equipment fetch fails
            console.warn(`Failed to load equipment for job ${job.id}, using defaults`);
            return {
              ...job,
              kit_items: ['Lawn Mower', 'String Trimmer', 'Leaf Blower', 'Safety Gear', 'Fuel Can', 'Hand Tools', 'Safety Cones', 'First Aid Kit'],
              verified_items: []
            };
          }
        } catch (err) {
          console.error(`Error loading equipment for job ${job.id}:`, err);
          // Fallback to default items
          return {
            ...job,
            kit_items: ['Lawn Mower', 'String Trimmer', 'Leaf Blower', 'Safety Gear', 'Fuel Can', 'Hand Tools', 'Safety Cones', 'First Aid Kit'],
            verified_items: []
          };
        }
      }));

      setJobs(jobsWithKits);
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setJobs([]);
    }
  };

  const selectJob = (job: Job) => {
    setSelectedJob(job);

    // Check if job load v2 is enabled
    if (jobLoadV2Enabled === false) {
      // Feature not enabled - show alert and don't switch to camera
      alert('AI-powered load verification is not available for your organization. Please contact your administrator to enable this feature.');
      return;
    }

    // Populate itemMeta from job metadata
    if ((job as any)._meta?.sources) {
      const meta = (job as any)._meta.sources;
      setItemMeta({
        table: meta.table || 0,
        jsonb: meta.jsonb || 0
      });
      console.log('[Equipment] Populated itemMeta state:', {
        table: meta.table || 0,
        jsonb: meta.jsonb || 0
      });
    } else {
      setItemMeta(null);
    }

    // Initialize required items from job equipment
    const icons = ['🪜', '🪔', '🌳', '🛡️', '⛽', '🔧', '🚧', '🎲', '🚨', '💊', '💧', '🌿'];
    const jobRequiredItems = (job.kit_items || []).map((item, index) => ({
      id: (index + 1).toString(),
      name: item,
      icon: icons[index] || '📦',
      checked: job.verified_items?.includes(item) || false,
      detectedBy: undefined
    }));
    setRequiredItems(jobRequiredItems);
    setEditableItems(job.kit_items || []);
    setView('camera');
  };

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
    const finalCost = (frameCount.current * 0.004).toFixed(3);
    console.log(`[VLM] 📊 Session ended: ${frameCount.current} frames in ${elapsed.toFixed(1)}s, Est. cost: $${finalCost}`);
    
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    analysisQueue.current.clear();
  };

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const { videoWidth, videoHeight } = video;

    if (!videoWidth || !videoHeight) {
      console.warn('[VLM] Video dimensions not ready for capture');
      return null;
    }

    const squareSide = Math.min(videoWidth, videoHeight);
    const sx = (videoWidth - squareSide) / 2;
    const sy = (videoHeight - squareSide) / 2;

    canvas.width = TARGET_IMAGE_SIZE;
    canvas.height = TARGET_IMAGE_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
      video,
      sx,
      sy,
      squareSide,
      squareSide,
      0,
      0,
      TARGET_IMAGE_SIZE,
      TARGET_IMAGE_SIZE
    );

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  };

  const analyzeFrame = async () => {
    const frameData = captureFrame();
    if (!frameData) {
      console.error('[VLM] Failed to capture frame - video or canvas not ready');
      return;
    }

    // Generate unique frame ID for tracking
    const frameId = Date.now();
    
    // Check if we have too many concurrent requests (limit to 2 for faster individual responses)
    if (analysisQueue.current.size >= 2) {
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
      const uncheckedItems = requiredItems.filter(item => !item.checked);

      // If all items found, stop analysis and camera
      if (uncheckedItems.length === 0) {
        console.log('[VLM] ✅ All items detected! Stopping analysis and camera...');
        setDetectionStatus('✅ LIST COMPLETED!');
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
          cooldownTimeoutRef.current = null;
        }

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
      const estimatedCost = (frameCount.current * 0.0001).toFixed(4);

      setDetectionStatus(`🔍 Analyzing (${uncheckedItems.length} remaining, ${analysisQueue.current.size} frames processing, ~$${estimatedCost})...`);
      console.log(`[VLM] Unchecked items remaining (${uncheckedItems.length}):`, expectedItems);
      console.log(`[VLM] Already detected (${requiredItems.length - uncheckedItems.length}):`, requiredItems.filter(item => item.checked).map(item => item.name));

      // Call VLM API
      const requestStart = performance.now();
      const verifiedItems = requiredItems.filter(item => item.checked).map(item => item.name);
      const frameNumber = frameCount.current;

      const priorDetections =
        lastDetectionsRef.current.length > 0
          ? lastDetectionsRef.current
          : [];

      const response = await fetch('/api/vision/vlm-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: frameData,
          remainingItems: expectedItems,
          verifiedItems,
          priorDetections,
          frameNumber,
          lightingHint: 'unknown',
        }),
      });
      const requestDuration = performance.now() - requestStart;

      console.log(`[VLM] Frame #${frameId} API Response: ${response.status} ${response.statusText} (${requestDuration.toFixed(0)}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[VLM] Frame #${frameId} API Error:`, errorText);
        const apiError = new Error(
          `API error: ${response.status} ${response.statusText || ''}`.trim()
        );
        (apiError as any).status = response.status;
        (apiError as any).details = errorText;
        throw apiError;
      }

      const result = await response.json();
      const detectedItems: Detection[] = Array.isArray(result.items) ? result.items : [];
      lastDetectionsRef.current = detectedItems;

      console.log(`[VLM] Frame #${frameId} Success - Checklist:`, {
        count: detectedItems.length,
        items: detectedItems,
        provider: result.provider,
        model: result.modelVersion,
        processingTimeMs: result.processingTimeMs,
        estimatedCost: result.estimatedCost
      });

      const presentItems = detectedItems.filter(d => d.status === 'present');
      const uncertainItems = detectedItems.filter(d => d.status === 'uncertain');
      const missingItems = detectedItems.filter(d => d.status === 'missing');
      const timeMs = result.processingTimeMs || 0;

      const formatDetectionLine = (items: Detection[], emoji: string) =>
        items.length > 0
          ? `${emoji} ${items
              .map(item => {
                const confidence = typeof item.confidence === 'number'
                  ? `${Math.round(item.confidence * 100)}%`
                  : '—';
                return `${item.name} (${confidence})`;
              })
              .join(', ')}`
          : null;

      const statusLines = [
        formatDetectionLine(presentItems, '✅'),
        formatDetectionLine(uncertainItems, '🤔'),
        formatDetectionLine(missingItems, '❌'),
      ].filter(Boolean);

      setDetectionStatus(
        statusLines.length > 0
          ? `⚡ Gemini Flash (${timeMs}ms) · ${statusLines.join(' · ')}`
          : `⚡ Gemini Flash (${timeMs}ms) · No items visible`
      );

      setDetections(detectedItems);

      if (detectedItems.length === 0) {
        console.log(`[VLM] Frame #${frameId} - No checklist matches returned`);
      }

      // Auto-check matching items when Gemini marks them present with confidence ≥ 0.6
      setRequiredItems(prev => {
        let hasChanges = false;
        const updated = prev.map(item => {
          if (item.checked) return item;

          const match = detectedItems.find(d =>
            d.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );

          if (match && match.status === 'present' && (match.confidence ?? 0) >= 0.6) {
            console.log(`[VLM] Present detected: "${match.name}" → "${item.name}" (confidence: ${Math.round((match.confidence ?? 0) * 100)}%)`);
            hasChanges = true;
            return {
              ...item,
              checked: true,
              confidence: match.confidence,
              note: match.note,
            };
          }

          return item;
        });

        if (!hasChanges) return prev;

        const sorted = updated.sort((a, b) => {
          if (a.checked === b.checked) return 0;
          return a.checked ? 1 : -1;
        });

        setShowFlash(true);
        playBeep();
        setTimeout(() => setShowFlash(false), 300);

        return sorted;
      });
    } catch (error: any) {
      console.error(`[VLM] Frame #${frameId} Detection error:`, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        status: error?.status,
        details: error?.details
      });

      setDetections([]);
      lastDetectionsRef.current = [];

      const statusCode = typeof error?.status === 'number' ? error.status : undefined;
      const message: string = error?.message || 'Unknown error';
      const lowered = message.toLowerCase();
      const isTimeout = lowered.includes('timed out') || statusCode === 504;
      const cooldownMs = isTimeout ? VLM_TIMEOUT_COOLDOWN_MS : VLM_ERROR_COOLDOWN_MS;

      setDetectionStatus(
        isTimeout
          ? `⏳ Vision service timed out (Frame ${frameId}). Cooling down for ${(cooldownMs / 1000).toFixed(1)}s...`
          : `🛑 Vision error (${message}). Cooling down ${(cooldownMs / 1000).toFixed(1)}s...`
      );

      // Stop interval to prevent spamming the API
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }

      analysisQueue.current.clear();
      setIsAnalyzing(false);
      isAnalyzingRef.current = false;

      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }

      cooldownTimeoutRef.current = setTimeout(() => {
        // Skip auto-restart if another analysis already running or no stream available
        if (isAnalyzingRef.current || analysisIntervalRef.current || !stream) {
          console.log('[VLM] Cooldown complete, skipping restart (analysis already active or camera stopped).');
          return;
        }

        console.log(`[VLM] Cooldown complete after ${cooldownMs}ms. Restarting analysis...`);
        void startAnalysis();
      }, cooldownMs);
    } finally {
      // Remove from queue when done
      analysisQueue.current.delete(frameId);
      console.log(`[VLM] Frame #${frameId} completed. ${analysisQueue.current.size} still processing.`);
    }
  };

  const startAnalysis = async () => {
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }

    isAnalyzingRef.current = true;
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

    // Set aggressive capture interval: 333ms = 3 fps
    // With concurrency limit of 2, some frames may be skipped when API is slow
    // Cost: ~$0.0001 per frame, max ~60 frames in 20 seconds = $0.006 max (many skipped)
    analysisIntervalRef.current = setInterval(() => {
      // Check 20-second safety limit
      const elapsed = (Date.now() - sessionStartTime.current) / 1000;
      if (elapsed >= 20) {
        console.log(`[VLM] 🔒 20-second safety limit reached. Stopping analysis. Frames sent: ${frameCount.current}, Est. cost: $${(frameCount.current * 0.0001).toFixed(4)}`);
        setDetectionStatus(`🔒 20s limit reached (${frameCount.current} frames, ~$${(frameCount.current * 0.0001).toFixed(4)}) - Press START to restart`);

        // Stop the analysis interval but keep camera running for restart
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
          cooldownTimeoutRef.current = null;
        }
        if (analysisIntervalRef.current) {
          clearInterval(analysisIntervalRef.current);
          analysisIntervalRef.current = null;
        }
        analysisQueue.current.clear();
        return;
      }

      analyzeFrame();
    }, 333); // 3 fps for more responsive detection
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
      completeVerification();
    } else if (stream && !isAnalyzing) {
      // Camera is running but analysis stopped (timeout) - restart analysis
      console.log('[VLM] Restarting analysis after timeout...');
      startAnalysis();
    }
  };

  const handleStop = () => {
    stopCamera();
  };

  const completeVerification = async () => {
    if (!selectedJob) return;

    try {
      const verifiedItems = requiredItems.filter(item => item.checked).map(item => item.name);

      // Save verification to job
      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/verify-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified_items: verifiedItems,
          verification_time: new Date().toISOString(),
          verification_method: 'camera_ai'
        })
      });

      if (!response.ok) throw new Error('Failed to save verification');

      // Navigate back to dashboard
      router.push('/crew');
    } catch (err) {
      console.error('Failed to complete verification:', err);
    }
  };

  const toggleRequiredItem = async (id: string) => {
    // Update local state first for immediate UI feedback
    setRequiredItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );

    // Save the updated list to the database
    if (selectedJob) {
      try {
        // Get the updated list with the toggled item
        const updatedList = requiredItems.map(item =>
          item.id === id ? { ...item, checked: !item.checked } : item
        );
        
        // Convert to the format expected by the API
        const updatedEquipment = updatedList.map(item => ({
          name: item.name,
          checked: item.checked,
          icon: item.icon,
          category: item.name.toLowerCase().includes('mower') || item.name.toLowerCase().includes('trimmer') || item.name.toLowerCase().includes('blower') || item.name.toLowerCase().includes('edger') ? 'primary' :
                    item.name.toLowerCase().includes('safety') || item.name.toLowerCase().includes('glasses') || item.name.toLowerCase().includes('protection') || item.name.toLowerCase().includes('first aid') ? 'safety' :
                    item.name.toLowerCase().includes('gas') || item.name.toLowerCase().includes('oil') || item.name.toLowerCase().includes('fuel') || item.name.toLowerCase().includes('water') || item.name.toLowerCase().includes('tools') ? 'support' : 'materials'
        }));

        const response = await fetch(`/api/crew/jobs/${selectedJob.id}/equipment`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            equipment: updatedEquipment
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save required item');
        }

        console.log('[RequiredItems] Saved item toggle to database:', updatedEquipment.find(eq => eq.name === requiredItems.find(item => item.id === id)?.name));
      } catch (err) {
        console.error('Failed to save required item:', err);
        // Revert the local state change if the save failed
        setRequiredItems(prev =>
          prev.map(item =>
            item.id === id ? { ...item, checked: !item.checked } : item
          )
        );
        alert('Failed to save required item. Please try again.');
      }
    }
  };

  const openSettings = () => {
    setEditableItems(requiredItems.map(item => item.name));
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  const saveSettings = async () => {
    if (!selectedJob) {
      setShowSettings(false);
      return;
    }

    try {
      const icons = ['🪜', '🪔', '🌳', '🛡️', '⛽', '🔧', '🚧', '🎲']; // Default icons

      // Preserve checked status from current list
      const checkedItems = new Set(requiredItems.filter(item => item.checked).map(item => item.name));

      const updatedList = editableItems
        .filter(name => name.trim()) // Remove empty items
        .map((name, index) => ({
          id: (index + 1).toString(),
          name: name.trim(),
          icon: icons[index] || '📦',
          checked: checkedItems.has(name.trim()),
          detectedBy: undefined
        }));

      setRequiredItems(updatedList);


      // Update the equipment list in the database
      const updatedEquipment = updatedList.map(item => ({
        name: item.name,
        checked: item.checked,
        icon: item.icon,
        category: item.name.toLowerCase().includes('mower') || item.name.toLowerCase().includes('trimmer') || item.name.toLowerCase().includes('blower') || item.name.toLowerCase().includes('edger') ? 'primary' :
                  item.name.toLowerCase().includes('safety') || item.name.toLowerCase().includes('glasses') || item.name.toLowerCase().includes('protection') || item.name.toLowerCase().includes('first aid') ? 'safety' :
                  item.name.toLowerCase().includes('gas') || item.name.toLowerCase().includes('oil') || item.name.toLowerCase().includes('fuel') || item.name.toLowerCase().includes('water') || item.name.toLowerCase().includes('tools') ? 'support' : 'materials'
      }));

      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/equipment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          equipment: updatedEquipment
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save equipment list');
      }

      // Update the job in the local state
      const updatedJob = {
        ...selectedJob,
        kit_items: updatedList.map(item => item.name)
      };
      setJobs(jobs.map(j => j.id === selectedJob.id ? updatedJob : j));
      setSelectedJob(updatedJob);

      setShowSettings(false);
      console.log('[Settings] Saved required items to database:', updatedEquipment);
    } catch (err) {
      console.error('Failed to save equipment changes:', err);
      alert('Failed to save changes. Please try again.');
    }
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

  // Watch for all items being checked
  useEffect(() => {
    const allChecked = requiredItems.every(item => item.checked);
    if (allChecked && requiredItems.length > 0) {
      console.log('[COMPLETION] All items checked! Showing confetti...');

      // Always play success sound and show confetti when all items completed
      playSuccessSound();
      setShowConfetti(true);

      // Stop confetti after 8 seconds
      setTimeout(() => setShowConfetti(false), 8000);

      // If we're analyzing, stop the camera and detection
      if (isAnalyzing) {
        console.log('[AUTO-STOP] Stopping vision detection...');
        setDetectionStatus('✅ LIST COMPLETED!');
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;

        if (cooldownTimeoutRef.current) {
          clearTimeout(cooldownTimeoutRef.current);
          cooldownTimeoutRef.current = null;
        }

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
    }
  }, [requiredItems, isAnalyzing, stream]);

  const allChecked = requiredItems.every(item => item.checked);

  // Job selection view
  if (view === 'job_select') {
    return (
      <>
        <style jsx global>{`
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #000;
            color: white;
          }

          .job-select-screen {
            width: 100vw;
            height: 100vh;
            background: #000;
            display: flex;
            flex-direction: column;
            padding: 10px;
            gap: 8px;
          }

          .header-bar {
            background: #FFD700;
            border-radius: 12px;
            padding: 12px 20px;
            text-align: center;
          }

          .header-title {
            font-size: 24px;
            font-weight: bold;
            color: #000;
          }

          .jobs-container {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
          }

          .job-card {
            background: rgba(0, 100, 255, 0.1);
            border: 2px solid #0066FF;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s;
          }

          .job-card:hover {
            background: rgba(0, 100, 255, 0.2);
            transform: scale(1.02);
          }

          .job-title {
            font-size: 18px;
            font-weight: bold;
            color: #FFD700;
            margin-bottom: 8px;
          }

          .job-detail {
            font-size: 14px;
            color: #ddd;
            margin-bottom: 4px;
          }

          .job-items {
            font-size: 14px;
            color: #4169e1;
            margin-top: 8px;
          }
        `}</style>

        <div className="job-select-screen">
          <div className="header-bar">
            <div className="header-title">Select Job for Load Verification</div>
          </div>

          <div className="jobs-container">
            {jobs.map((job) => (
              <div key={job.id} className="job-card" onClick={() => selectJob(job)}>
                <div className="job-title">{job.customer_name}</div>
                <div className="job-detail">📍 {job.property_address}</div>
                <div className="job-detail">🕰️ {job.scheduled_time}</div>
                <div className="job-items">📦 {job.kit_items.length} items required</div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Camera view
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
          flex: 0 0 auto;
          border: 3px solid #FFC107;
          border-radius: 12px;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          width: 100%;
          aspect-ratio: 1;
        }

        .video-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .scanning-guide {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 1;
        }

        .scanning-corners {
          position: absolute;
          top: 10%;
          left: 10%;
          right: 10%;
          bottom: 10%;
        }

        .corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border: 3px solid #FFC107;
        }

        .corner-tl {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
          border-radius: 8px 0 0 0;
        }

        .corner-tr {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
          border-radius: 0 8px 0 0;
        }

        .corner-bl {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
          border-radius: 0 0 0 8px;
        }

        .corner-br {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
          border-radius: 0 0 8px 0;
        }

        .scanning-line {
          position: absolute;
          top: 0;
          left: 10%;
          right: 10%;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            #FFC107 20%,
            #FFC107 80%,
            transparent 100%
          );
          box-shadow: 0 0 8px rgba(255, 193, 7, 0.6);
          animation: scan 1.5s ease-in-out infinite;
        }

        @keyframes scan {
          0% {
            top: 10%;
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 90%;
            opacity: 0.3;
          }
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

        .detection-breakdown {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #1a1a1a;
          text-align: left;
        }

        .detection-breakdown span {
          display: block;
          line-height: 1.3;
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

        .required-items-title {
          color: #0066FF;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
          padding: 0 15px;
        }

        .required-items-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .required-item {
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

        .required-item:hover {
          background: rgba(0, 100, 255, 0.2);
          transform: scale(1.02);
        }

        .required-item:active {
          transform: scale(0.98);
        }

        .required-item.checked {
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

        .required-item.checked .item-checkbox {
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
            transform: translateY(-80vh) translateX(15vw) rotate(90deg) scale(1);
          }
          20% {
            transform: translateY(-60vh) translateX(-12vw) rotate(180deg) scale(1);
          }
          30% {
            transform: translateY(-40vh) translateX(20vw) rotate(270deg) scale(1);
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(-18vw) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes confetti-fall-2 {
          0% {
            transform: translateY(-100vh) translateX(0) rotate(0deg) scale(0);
            opacity: 1;
          }
          10% {
            transform: translateY(-80vh) translateX(-18vw) rotate(-90deg) scale(1);
          }
          25% {
            transform: translateY(-50vh) translateX(22vw) rotate(-180deg) scale(1);
          }
          40% {
            transform: translateY(-20vh) translateX(-15vw) rotate(-270deg) scale(1);
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(25vw) rotate(-630deg) scale(0.5);
            opacity: 0;
          }
        }

        @keyframes confetti-fall-3 {
          0% {
            transform: translateY(-100vh) translateX(0) rotate(0deg) scale(0);
            opacity: 1;
          }
          15% {
            transform: translateY(-70vh) translateX(28vw) rotate(120deg) scale(1);
          }
          35% {
            transform: translateY(-35vh) translateX(-20vw) rotate(240deg) scale(1);
          }
          55% {
            transform: translateY(0vh) translateX(16vw) rotate(360deg) scale(1);
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(-22vw) rotate(540deg) scale(0.3);
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
          <div className="company-name">{selectedJob?.customer_name || 'Evergold Landscaping'}</div>
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

              {/* Scanning guide overlay - shows active detection area */}
              {isAnalyzing && (
                <div className="scanning-guide">
                  <div className="scanning-corners">
                    <div className="corner corner-tl"></div>
                    <div className="corner corner-tr"></div>
                    <div className="corner corner-bl"></div>
                    <div className="corner corner-br"></div>
                  </div>
                  <div className="scanning-line"></div>
                </div>
              )}

              {(isAnalyzing || detections.length > 0) && (
                <div className="detection-overlay">
                  <div className="detection-text">{detectionStatus}</div>
                  {detections.length > 0 && (
                    <div className="detection-breakdown">
                      {detections.map((detection, index) => {
                        const emoji =
                          detection.status === 'present'
                            ? '✅'
                            : detection.status === 'uncertain'
                              ? '🤔'
                              : '❌';
                        const confidence =
                          typeof detection.confidence === 'number'
                            ? ` (${Math.round(detection.confidence * 100)}%)`
                            : '';
                        const note = detection.note ? ` · ${detection.note}` : '';
                        return (
                          <span key={`${detection.name}-${index}`}>
                            {emoji} {detection.name}
                            {confidence}
                            {note}
                          </span>
                        );
                      })}
                    </div>
                  )}
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
                  }}>All {requiredItems.length} items verified</div>
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
            <div className="required-items-title">Required Tools & Materials:</div>
            <div className="required-items-grid">
              {requiredItems.map((item, index) => {
                const icons = ['🪜', '🪔', '🌳', '🛡️', '⛽', '🔧', '🚧', '🎲'];
                return (
                  <div
                    key={item.id}
                    className={`required-item ${item.checked ? 'checked' : ''}`}
                    onClick={() => toggleRequiredItem(item.id)}
                  >
                    <div className="item-checkbox">
                      {item.checked && <span className="checkmark">✓</span>}
                    </div>
                    <div className="item-content">
                      <div className="item-icon">{icons[index] || '📦'}</div>
                      <div className="item-name">{item.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="container-4">
          <div
            className={`button-half button-yes ${stream && isAnalyzing && !allChecked ? 'disabled' : ''}`}
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
          zIndex: 99999,
          overflow: 'hidden'
        }}>
          {[...Array(200)].map((_, i) => (
            <div
              key={i}
              className={`confetti-${(i % 6) + 1}`}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
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
            <div className="modal-header">Edit Required Items</div>
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
// Wrapper component with Suspense boundary for useSearchParams()
export default function CrewJobLoadPage() {
  return (
    <Suspense fallback={
      <div style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FFD700"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>📷</div>
          <div>Loading job load screen...</div>
        </div>
      </div>
    }>
      <CrewJobLoadPageContent />
    </Suspense>
  );
}
