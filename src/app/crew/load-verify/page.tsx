/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/crew/load-verify/page.tsx
 * phase: 3
 * domain: crew
 * purpose: Load verification page with camera-based equipment detection
 * spec_ref: 007-mvp-intent-driven/contracts/crew-ui.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['job_selection', 'camera_active', 'detection_running', 'results_review', 'verification_complete'],
 *   transitions: [
 *     'job_selection->camera_active: selectJob()',
 *     'camera_active->detection_running: capturePhoto()',
 *     'detection_running->results_review: detectionComplete()',
 *     'results_review->camera_active: retakePhoto()',
 *     'results_review->verification_complete: confirmVerification()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "visionDetection": "$0.03-0.05 per photo (VLM)",
 *   "localYOLO": "$0.00 (local inference)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/camera/CameraCapture',
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/ui/ItemChecklist',
 *     '@/domains/crew/services/crew-workflow.service'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['jobs', 'equipment']
 * }
 * exports: ['default']
 * voice_considerations: Voice commands for hands-free verification workflow
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/crew-load-verification-flow.test.ts'
 * }
 * tasks: [
 *   'Create job selection interface',
 *   'Implement camera-based equipment detection',
 *   'Show verification results with confidence scores',
 *   'Allow manual equipment checklist override'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCw,
  Play,
  X,
  Eye,
  RotateCcw,
  Brain,
  Zap,
  Clock,
  Shield
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { ItemChecklist } from '@/components/ui/ItemChecklist';

interface Job {
  id: string;
  customerName: string;
  propertyAddress: string;
  scheduledTime: string;
  status: string;
  requiredEquipment: Array<{
    id: string;
    name: string;
    category: string;
    required: boolean;
  }>;
  loadVerified: boolean;
}

interface DetectionResult {
  id: string;
  name: string;
  confidence: number;
  detected: boolean;
  category: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface VerificationResult {
  verified: boolean;
  method: 'ai_vision' | 'manual' | 'hybrid';
  confidence: number;
  detectedItems: DetectionResult[];
  missingItems: string[];
  verifiedItems: string[];
  photoUrl?: string;
  processingTime: number;
  cost: number;
}

export default function CrewLoadVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams?.get('jobId');
  const { actions, addAction, clearActions } = useButtonActions();

  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(preselectedJobId);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationStep, setVerificationStep] = useState<'job_selection' | 'camera' | 'processing' | 'results' | 'manual'>('job_selection');
  
  // Camera and detection state
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  
  // Manual verification state
  const [manualItems, setManualItems] = useState<Record<string, boolean>>({});
  const [showManualMode, setShowManualMode] = useState(false);

  // Setup button actions
  useEffect(() => {
    clearActions();

    if (verificationStep === 'job_selection') {
      addAction({
        id: 'back',
        label: 'Back',
        priority: 'medium',
        icon: ArrowLeft,
        onClick: () => router.back(),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      if (selectedJob) {
        addAction({
          id: 'start-verification',
          label: 'Start Verification',
          priority: 'critical',
          icon: Camera,
          onClick: () => {
            setVerificationStep('camera');
            setShowCamera(true);
          },
          className: 'bg-emerald-600 text-white hover:bg-emerald-700'
        });

        addAction({
          id: 'manual-mode',
          label: 'Manual Check',
          priority: 'high',
          icon: CheckCircle,
          onClick: () => {
            setVerificationStep('manual');
            setShowManualMode(true);
          },
          className: 'bg-blue-600 text-white hover:bg-blue-700'
        });
      }
    } else if (verificationStep === 'camera') {
      addAction({
        id: 'cancel-camera',
        label: 'Cancel',
        priority: 'high',
        icon: X,
        onClick: () => {
          setShowCamera(false);
          setVerificationStep('job_selection');
        },
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else if (verificationStep === 'results') {
      addAction({
        id: 'retake-photo',
        label: 'Retake',
        priority: 'high',
        icon: RotateCcw,
        onClick: () => {
          setVerificationStep('camera');
          setShowCamera(true);
          setVerificationResult(null);
          setCapturedImage(null);
        },
        className: 'bg-orange-600 text-white hover:bg-orange-700'
      });

      addAction({
        id: 'manual-override',
        label: 'Manual Check',
        priority: 'high',
        icon: Eye,
        onClick: () => {
          setVerificationStep('manual');
          setShowManualMode(true);
        },
        className: 'bg-blue-600 text-white hover:bg-blue-700'
      });

      addAction({
        id: 'confirm-verification',
        label: 'Confirm',
        priority: 'critical',
        icon: CheckCircle,
        onClick: handleConfirmVerification,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700',
        disabled: !verificationResult?.verified
      });
    } else if (verificationStep === 'manual') {
      addAction({
        id: 'back-to-results',
        label: 'Back',
        priority: 'high',
        icon: ArrowLeft,
        onClick: () => {
          setShowManualMode(false);
          setVerificationStep(verificationResult ? 'results' : 'job_selection');
        },
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });

      addAction({
        id: 'confirm-manual',
        label: 'Confirm Manual',
        priority: 'critical',
        icon: CheckCircle,
        onClick: handleManualVerification,
        className: 'bg-emerald-600 text-white hover:bg-emerald-700'
      });
    }
  }, [verificationStep, selectedJob, verificationResult, clearActions, addAction]);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  // Auto-select job if provided in URL
  useEffect(() => {
    if (preselectedJobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === preselectedJobId);
      if (job) {
        setSelectedJob(job);
        setSelectedJobId(job.id);
      }
    }
  }, [preselectedJobId, jobs]);

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/crew/jobs');
      const data = await response.json();
      
      // Filter to only unverified jobs
      const unverifiedJobs = (data.jobs || []).filter((job: Job) => !job.loadVerified);
      setJobs(unverifiedJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
    setSelectedJobId(job.id);
    
    // Initialize manual items state
    const initialState: Record<string, boolean> = {};
    job.requiredEquipment.forEach(item => {
      initialState[item.id] = false;
    });
    setManualItems(initialState);
  };

  const handleCameraCapture = async (imageBlob: Blob, imageUrl: string) => {
    if (!selectedJob) return;

    setIsProcessing(true);
    setVerificationStep('processing');
    setCapturedImage(imageUrl);

    try {
      const startTime = Date.now();
      
      // Call load verification API
      const formData = new FormData();
      formData.append('photo', imageBlob, 'load-verification.jpg');
      formData.append('jobId', selectedJob.id);

      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/load-verify`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        const processingTime = Date.now() - startTime;
        
        // Transform API result to our interface
        const verificationResult: VerificationResult = {
          verified: result.verification.verified,
          method: result.verification.method,
          confidence: result.verification.confidence || 0,
          detectedItems: result.verification.detectedItems?.map((item: any) => ({
            id: item.id || item.name,
            name: item.name,
            confidence: item.confidence || 0,
            detected: true,
            category: item.category || 'equipment',
            bbox: item.bbox
          })) || [],
          missingItems: result.verification.missingItems || [],
          verifiedItems: result.verification.verifiedItems || [],
          photoUrl: result.verification.photoUrl,
          processingTime,
          cost: result.verification.cost || 0
        };

        setVerificationResult(verificationResult);
        setVerificationStep('results');
        setShowCamera(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setVerificationStep('camera');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!verificationResult || !selectedJob) return;

    try {
      // Mark job as verified
      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/verify-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: verificationResult.verified,
          method: verificationResult.method,
          detectedItems: verificationResult.detectedItems,
          missingItems: verificationResult.missingItems
        })
      });

      if (response.ok) {
        router.push('/crew');
      }
    } catch (error) {
      console.error('Failed to confirm verification:', error);
    }
  };

  const handleManualVerification = async () => {
    if (!selectedJob) return;

    const verifiedItems = Object.entries(manualItems)
      .filter(([_, checked]) => checked)
      .map(([itemId, _]) => {
        const item = selectedJob.requiredEquipment.find(eq => eq.id === itemId);
        return item?.name || itemId;
      });

    const missingItems = selectedJob.requiredEquipment
      .filter(item => !manualItems[item.id])
      .map(item => item.name);

    try {
      const response = await fetch(`/api/crew/jobs/${selectedJob.id}/verify-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: missingItems.length === 0,
          method: 'manual',
          verifiedItems,
          missingItems
        })
      });

      if (response.ok) {
        router.push('/crew');
      }
    } catch (error) {
      console.error('Failed to save manual verification:', error);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading jobs...</p>
        </div>
      </div>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <div className="min-h-screen bg-black">
        <CameraCapture
          onCapture={handleCameraCapture}
          maxFps={1}
          showIntentOverlay={false}
          className="h-screen"
        />
        
        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <Brain className="w-12 h-12 animate-pulse mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Analyzing Equipment...</p>
              <p className="text-sm text-gray-300">Using AI vision to detect items</p>
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {!isProcessing && (
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black to-transparent">
            <div className="text-center text-white">
              <Package className="w-8 h-8 mx-auto mb-2" />
              <p className="text-lg font-medium">Position Equipment in Frame</p>
              <p className="text-sm text-gray-300">Ensure all items are clearly visible</p>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <ButtonLimiter
            actions={actions}
            maxVisibleButtons={4}
            showVoiceButton={false}
            className="justify-center"
          />
        </div>
      </div>
    );
  }

  // Manual verification mode
  if (showManualMode && selectedJob) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-16">
              <h1 className="text-xl font-bold text-gray-900">Manual Equipment Check</h1>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{selectedJob.customerName}</h2>
              <p className="text-gray-600">{selectedJob.propertyAddress}</p>
              <p className="text-sm text-gray-500">Scheduled: {formatTime(selectedJob.scheduledTime)}</p>
            </div>

            <ItemChecklist
              items={selectedJob.requiredEquipment.map(item => ({
                id: item.id,
                name: item.name,
                category: item.category,
                required: item.required,
                checked: manualItems[item.id] || false
              }))}
              onChange={(itemId, checked) => {
                setManualItems(prev => ({
                  ...prev,
                  [itemId]: checked
                }));
              }}
              title="Check off items as you verify them:"
            />

            <div className="mt-6">
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                className="justify-center"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verification results view
  if (verificationStep === 'results' && verificationResult && selectedJob) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-16">
              <h1 className="text-xl font-bold text-gray-900">Verification Results</h1>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                verificationResult.verified 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {verificationResult.verified ? 'Load Complete' : 'Items Missing'}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Results */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo */}
              {capturedImage && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Captured Image</h2>
                  <img
                    src={capturedImage}
                    alt="Equipment verification"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Detection Results */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Detection Results</h2>
                
                <div className="space-y-3">
                  {/* Detected Items */}
                  {verificationResult.detectedItems.length > 0 && (
                    <div>
                      <h3 className="font-medium text-emerald-800 mb-2">Detected Items</h3>
                      <div className="space-y-2">
                        {verificationResult.detectedItems.map((item, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-600">
                                Confidence: {Math.round(item.confidence * 100)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Items */}
                  {verificationResult.missingItems.length > 0 && (
                    <div>
                      <h3 className="font-medium text-red-800 mb-2">Missing Items</h3>
                      <div className="space-y-2">
                        {verificationResult.missingItems.map((item, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="font-medium text-gray-900">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
                <ButtonLimiter
                  actions={actions}
                  maxVisibleButtons={4}
                  showVoiceButton={false}
                  layout="grid"
                  className="w-full"
                />
              </div>

              {/* Verification Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Stats</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Method</p>
                      <p className="font-medium capitalize">{verificationResult.method.replace('_', ' ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-600">Processing Time</p>
                      <p className="font-medium">{verificationResult.processingTime}ms</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-sm text-gray-600">Overall Confidence</p>
                      <p className="font-medium">{Math.round(verificationResult.confidence * 100)}%</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Cost</p>
                      <p className="font-medium">${verificationResult.cost.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">{selectedJob.customerName}</p>
                  <p className="text-sm text-gray-600">{selectedJob.propertyAddress}</p>
                  <p className="text-sm text-gray-600">Time: {formatTime(selectedJob.scheduledTime)}</p>
                  <p className="text-sm text-gray-600">
                    Equipment: {selectedJob.requiredEquipment.length} items
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main job selection view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Load Verification</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Job Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Select Job to Verify ({jobs.length})
                </h2>
              </div>
              <div className="p-6">
                {jobs.length > 0 ? (
                  <div className="space-y-4">
                    {jobs.map(job => (
                      <div
                        key={job.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedJobId === job.id
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleJobSelect(job)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{job.customerName}</h3>
                            <p className="text-sm text-gray-600 mt-1">{job.propertyAddress}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>Time: {formatTime(job.scheduledTime)}</span>
                              <span>Equipment: {job.requiredEquipment.length} items</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-orange-600" />
                            <span className="text-sm text-orange-800 font-medium">Unverified</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                    <p className="text-gray-500">All jobs have verified loads</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <ButtonLimiter
                actions={actions}
                maxVisibleButtons={4}
                showVoiceButton={false}
                layout="grid"
                className="w-full"
              />
            </div>

            {/* Selected Job Details */}
            {selectedJob && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Equipment</h3>
                <div className="space-y-2">
                  {selectedJob.requiredEquipment.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <Package className="w-4 h-4 text-gray-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-600 capitalize">{item.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>1. Select a job to verify</li>
                <li>2. Use camera for AI detection</li>
                <li>3. Or manually check items</li>
                <li>4. Confirm verification</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}