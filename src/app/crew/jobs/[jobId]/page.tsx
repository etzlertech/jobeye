/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/crew/jobs/[jobId]/page.tsx
 * phase: 3
 * domain: crew
 * purpose: Job detail page with voice instructions playback and progress tracking
 * spec_ref: 007-mvp-intent-driven/contracts/crew-ui.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['loading', 'job_view', 'voice_playing', 'photo_capture', 'completing'],
 *   transitions: [
 *     'loading->job_view: jobLoaded()',
 *     'job_view->voice_playing: playVoiceInstructions()',
 *     'job_view->photo_capture: takePhoto()',
 *     'job_view->completing: markComplete()',
 *     'voice_playing->job_view: voiceFinished()',
 *     'photo_capture->job_view: photoCaptured()',
 *     'completing->job_view: completed()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "voicePlayback": "$0.00 (audio playback only)",
 *   "photoUpload": "$0.01 (storage only)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/components/ui/ButtonLimiter',
 *     '@/components/camera/CameraCapture',
 *     '@/components/voice/VoiceCommandButton',
 *     '@/domains/crew/services/crew-workflow.service'
 *   ],
 *   external: ['react', 'next/navigation'],
 *   supabase: ['jobs', 'job_photos']
 * }
 * exports: ['default']
 * voice_considerations: Voice instructions from supervisor played back to crew
 * test_requirements: {
 *   coverage: 85,
 *   e2e_tests: 'tests/e2e/crew-job-detail-flow.test.ts'
 * }
 * tasks: [
 *   'Display job details with customer/property info',
 *   'Add voice instruction playback',
 *   'Implement photo capture for start/completion',
 *   'Create job completion workflow with validation'
 * ]
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MobileNavigation } from '@/components/navigation/MobileNavigation';
import {
  ArrowLeft,
  Play,
  Pause,
  Camera,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Package,
  FileText,
  VolumeX,
  Volume2,
  RotateCcw,
  AlertTriangle,
  Phone,
  Navigation,
  Wrench,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';
import { TenantBadge } from '@/components/tenant';
import { TaskList } from '@/components/tasks';
import { useVoiceCommand } from '@/hooks/use-voice-command';
import { VoiceFloatingButton } from '@/components/voice/VoiceFloatingButton';
import { VoiceConfirmationModal } from '@/components/voice/VoiceConfirmationModal';
import { VoiceClarificationFlow } from '@/components/voice/VoiceClarificationFlow';
import toast from 'react-hot-toast';

interface JobDetail {
  id: string;
  customerName: string;
  customerPhone: string;
  propertyAddress: string;
  propertyType: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'on_hold';
  templateName?: string;
  specialInstructions?: string;
  voiceInstructions?: string;
  voiceInstructionsUrl?: string;
  estimatedDuration: number;
  actualStartTime?: string;
  actualEndTime?: string;
  startPhotoUrl?: string;
  completionPhotoUrl?: string;
  requiredEquipment: Array<{
    id: string;
    name: string;
    category: string;
    verified: boolean;
  }>;
  loadVerified: boolean;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

interface JobPhoto {
  id: string;
  type: 'start' | 'progress' | 'completion' | 'issue';
  url: string;
  thumbnailUrl: string;
  timestamp: string;
  description?: string;
}

export default function CrewJobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.jobId as string;
  const { actions, addAction, clearActions } = useButtonActions();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [photoType, setPhotoType] = useState<'start' | 'completion' | 'progress' | 'issue'>('progress');

  // Progress state
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Voice command integration
  const voiceCommand = useVoiceCommand({
    context: {
      role: 'crew',
      currentPage: 'job-detail',
      activeJobId: jobId,
    },
    onSuccess: (result) => {
      // Refresh job data
      loadJobDetail();
      if (voiceCommand.successMessage) {
        toast.success(voiceCommand.successMessage, {
          duration: 4000,
          icon: '✅',
        });
      }
    },
    onError: (error) => {
      toast.error(error.message, {
        duration: 5000,
        icon: '❌',
      });
    },
  });

  // Setup button actions
  useEffect(() => {
    clearActions();

    if (!job) return;

    if (showCamera) {
      addAction({
        id: 'cancel-camera',
        label: 'Cancel',
        priority: 'high',
        icon: ArrowLeft,
        onClick: () => setShowCamera(false),
        className: 'bg-gray-600 text-white hover:bg-gray-700'
      });
    } else {
      if (job.status === 'assigned') {
        addAction({
          id: 'start-job',
          label: 'Start Job',
          priority: 'critical',
          icon: Play,
          onClick: handleStartJob,
          className: 'bg-emerald-600 text-white hover:bg-emerald-700',
          disabled: isStarting
        });
      } else if (job.status === 'in_progress') {
        addAction({
          id: 'complete-job',
          label: 'Complete',
          priority: 'critical',
          icon: CheckCircle,
          onClick: handleCompleteJob,
          className: 'bg-blue-600 text-white hover:bg-blue-700',
          disabled: isCompleting
        });
      }

      addAction({
        id: 'take-photo',
        label: 'Take Photo',
        priority: 'high',
        icon: Camera,
        onClick: () => {
          setPhotoType(job.status === 'assigned' ? 'start' : 'progress');
          setShowCamera(true);
        },
        className: 'bg-purple-600 text-white hover:bg-purple-700'
      });

      if (job.voiceInstructionsUrl) {
        addAction({
          id: 'play-voice',
          label: isPlayingVoice ? 'Stop Voice' : 'Play Voice',
          priority: 'high',
          icon: isPlayingVoice ? Pause : Play,
          onClick: toggleVoiceInstructions,
          className: 'bg-blue-600 text-white hover:bg-blue-700'
        });
      }

      addAction({
        id: 'report-issue',
        label: 'Report Issue',
        priority: 'medium',
        icon: Wrench,
        onClick: () => router.push(`/crew/maintenance/report?jobId=${jobId}`),
        className: 'bg-orange-600 text-white hover:bg-orange-700'
      });
    }
  }, [job, showCamera, isPlayingVoice, isStarting, isCompleting, clearActions, addAction]);

  // Load job details
  const loadJobDetail = useCallback(async () => {
    if (!jobId) return;

    try {
      const [jobRes, photosRes] = await Promise.all([
        fetch(`/api/crew/jobs/${jobId}`),
        fetch(`/api/crew/jobs/${jobId}/photos`)
      ]);

      if (!jobRes.ok) {
        throw new Error('Job not found');
      }

      const [jobData, photosData] = await Promise.all([
        jobRes.json(),
        photosRes.json()
      ]);

      setJob(jobData.job);
      setPhotos(photosData.photos || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load job');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJobDetail();
  }, [loadJobDetail]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  const handleStartJob = async () => {
    if (!job) return;

    setIsStarting(true);

    try {
      const response = await fetch(`/api/crew/jobs/${jobId}/start`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setJob(prev => prev ? {
          ...prev,
          status: 'in_progress',
          actualStartTime: new Date().toISOString()
        } : null);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to start job');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!job) return;

    // Check if completion photo is required and missing
    const hasCompletionPhoto = photos.some(p => p.type === 'completion');
    if (!hasCompletionPhoto) {
      setPhotoType('completion');
      setShowCamera(true);
      return;
    }

    setIsCompleting(true);

    try {
      const response = await fetch(`/api/crew/jobs/${jobId}/complete`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setJob(prev => prev ? {
          ...prev,
          status: 'completed',
          actualEndTime: new Date().toISOString()
        } : null);

        // Navigate back to dashboard after completion
        setTimeout(() => router.push('/crew'), 2000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to complete job');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'complete',
          completed_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.message || 'Failed to complete task');
      }
    } catch (error) {
      setError('Failed to complete task');
      console.error('Task completion error:', error);
    }
  };

  const toggleVoiceInstructions = () => {
    if (!job?.voiceInstructionsUrl) return;

    if (isPlayingVoice) {
      audioElement?.pause();
      setIsPlayingVoice(false);
    } else {
      if (audioElement) {
        audioElement.play();
      } else {
        const audio = new Audio(job.voiceInstructionsUrl);
        audio.addEventListener('ended', () => setIsPlayingVoice(false));
        audio.addEventListener('error', () => {
          setError('Failed to play voice instructions');
          setIsPlayingVoice(false);
        });
        audio.play();
        setAudioElement(audio);
      }
      setIsPlayingVoice(true);
    }
  };

  const handlePhotoCapture = async (imageBlob: Blob, imageUrl: string) => {
    try {
      const formData = new FormData();
      formData.append('photo', imageBlob, `${photoType}-${Date.now()}.jpg`);
      formData.append('type', photoType);
      formData.append('jobId', jobId);

      const response = await fetch(`/api/crew/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        const newPhoto: JobPhoto = {
          id: result.photo.id,
          type: photoType,
          url: result.photo.url,
          thumbnailUrl: result.photo.thumbnailUrl,
          timestamp: new Date().toISOString(),
          description: result.photo.description
        };

        setPhotos(prev => [...prev, newPhoto]);
        setShowCamera(false);

        // If this was a completion photo, trigger job completion
        if (photoType === 'completion') {
          handleCompleteJob();
        }
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to save photo');
    }
  };


  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="mobile-container">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
            <p className="text-gray-400 text-lg">Loading job...</p>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
        `}</style>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mobile-container">
        <MobileNavigation
          currentRole="crew"
          onLogout={() => router.push('/')}
        />
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white text-lg mb-2">Failed to load job</p>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="btn-primary"
            >
              Go Back
            </button>
          </div>
        </div>
        <style jsx>{`
          .mobile-container {
            width: 100%;
            max-width: 375px;
            height: 100vh;
            max-height: 812px;
            margin: 0 auto;
            background: #000;
            color: white;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .btn-primary {
            padding: 0.75rem 1.5rem;
            background: #FFD700;
            color: #000;
            font-weight: 600;
            border-radius: 0.5rem;
            border: none;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <div className="min-h-screen bg-black">
        <CameraCapture
          onCapture={handlePhotoCapture}
          maxFps={1}
          showIntentOverlay={false}
          className="h-screen"
        />

        {/* Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
          <div className="text-center mb-4">
            <p className="text-white text-sm">
              {photoType === 'start' && 'Take a photo before starting work'}
              {photoType === 'completion' && 'Take a completion photo'}
              {photoType === 'progress' && 'Take a progress photo'}
              {photoType === 'issue' && 'Document the issue'}
            </p>
          </div>
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in_progress': return '#3b82f6';
      case 'assigned': return '#FFD700';
      default: return '#6b7280';
    }
  };

  return (
    <div className="mobile-container">
      {/* Mobile Navigation */}
      <MobileNavigation
        currentRole="crew"
        onLogout={() => router.push('/')}
      />

      {/* Header */}
      <div className="header-bar">
        <div>
          <h1 className="text-xl font-semibold">{job.customerName}</h1>
          <p className="text-xs text-gray-500">{job.propertyAddress}</p>
        </div>
        <span
          className="status-badge"
          style={{
            background: `${getStatusColor(job.status)}20`,
            color: getStatusColor(job.status),
            border: `1px solid ${getStatusColor(job.status)}40`
          }}
        >
          {job.status.replace('_', ' ')}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Job Overview */}
        <div className="detail-section">
          <h2 className="detail-section-title">Job Overview</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium text-white">{job.customerName}</p>
                <p className="text-sm text-gray-500">{job.customerPhone}</p>
              </div>
              <button
                onClick={() => window.open(`tel:${job.customerPhone}`)}
                className="icon-button"
              >
                <Phone className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-white">{job.propertyAddress}</p>
                <p className="text-sm text-gray-500 capitalize">{job.propertyType}</p>
              </div>
              <button
                onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(job.propertyAddress)}`)}
                className="icon-button"
              >
                <Navigation className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-medium text-white">
                  {formatTime(job.scheduledTime)}
                </p>
                <p className="text-sm text-gray-500">
                  Est. {formatDuration(job.estimatedDuration)}
                </p>
              </div>
            </div>

            {job.templateName && (
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-white">{job.templateName}</p>
                  <p className="text-sm text-gray-500">Job template</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {(job.specialInstructions || job.voiceInstructions) && (
          <div className="detail-section">
            <h2 className="detail-section-title">Instructions</h2>

            {job.voiceInstructions && (
              <div className="mb-4 p-3 bg-blue-900 bg-opacity-20 rounded-lg border border-blue-500 border-opacity-30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-blue-300 text-sm">Voice Instructions</h3>
                  {isPlayingVoice ? (
                    <Volume2 className="w-4 h-4 text-blue-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <p className="text-blue-200 text-sm mb-3">{job.voiceInstructions}</p>
                {job.voiceInstructionsUrl && (
                  <button
                    onClick={toggleVoiceInstructions}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    {isPlayingVoice ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlayingVoice ? 'Stop' : 'Play'} Voice
                  </button>
                )}
              </div>
            )}

            {job.specialInstructions && (
              <div className="p-3 bg-gray-800 bg-opacity-50 rounded-lg">
                <h3 className="font-medium text-gray-300 mb-2 text-sm">Special Instructions</h3>
                <p className="text-gray-400 text-sm">{job.specialInstructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Equipment */}
        <div className="detail-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="detail-section-title" style={{ margin: 0 }}>Required Equipment</h2>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              job.loadVerified ? 'bg-emerald-900 bg-opacity-30 text-emerald-400' : 'bg-orange-900 bg-opacity-30 text-orange-400'
            }`}>
              {job.loadVerified ? 'Verified' : 'Not Verified'}
            </div>
          </div>

          {!job.loadVerified && (
            <div className="mb-4">
              <button
                onClick={() => router.push(`/crew/job-load?jobId=${jobId}`)}
                className="btn-primary w-full"
              >
                Load Items for Job
              </button>
            </div>
          )}

          <div className="space-y-2">
            {job.requiredEquipment.map(equipment => (
              <div
                key={equipment.id}
                className={`item-card ${
                  equipment.verified
                    ? 'border-emerald-500 border-opacity-30 bg-emerald-900 bg-opacity-10'
                    : 'border-orange-500 border-opacity-30 bg-orange-900 bg-opacity-10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="item-thumbnail">
                    {equipment.thumbnailUrl ? (
                      <img
                        src={equipment.thumbnailUrl}
                        alt={equipment.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className={`w-5 h-5 ${
                        equipment.verified ? 'text-emerald-400' : 'text-orange-400'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white">{equipment.name}</h4>
                    <p className="text-xs text-gray-500 capitalize">{equipment.category}</p>
                  </div>
                  {equipment.verified && (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task List */}
        <div className="detail-section">
          <h2 className="detail-section-title">Job Tasks</h2>
          <TaskList
            jobId={jobId}
            editable={job.status === 'in_progress'}
            onTaskComplete={handleTaskComplete}
          />
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="detail-section">
            <h2 className="detail-section-title">Photos</h2>

            <div className="grid grid-cols-2 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.thumbnailUrl}
                    alt={`${photo.type} photo`}
                    className="w-full h-24 object-cover rounded-lg cursor-pointer"
                    onClick={() => window.open(photo.url, '_blank')}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                    photo.type === 'start' ? 'bg-green-900 bg-opacity-80 text-green-300' :
                    photo.type === 'completion' ? 'bg-blue-900 bg-opacity-80 text-blue-300' :
                    photo.type === 'issue' ? 'bg-red-900 bg-opacity-80 text-red-300' :
                    'bg-gray-900 bg-opacity-80 text-gray-300'
                  }`}>
                    {photo.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Tracker */}
        <div className="detail-section">
          <h2 className="detail-section-title">Progress</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                job.status !== 'assigned' ? 'bg-emerald-500' : 'bg-gray-600'
              }`} />
              <span className="text-sm text-gray-300">Job started</span>
              {job.actualStartTime && (
                <span className="text-xs text-gray-500 ml-auto">
                  {formatTime(job.actualStartTime)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                photos.some(p => p.type === 'start') ? 'bg-emerald-500' : 'bg-gray-600'
              }`} />
              <span className="text-sm text-gray-300">Start photo</span>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                job.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-600'
              }`} />
              <span className="text-sm text-gray-300">Job completed</span>
              {job.actualEndTime && (
                <span className="text-xs text-gray-500 ml-auto">
                  {formatTime(job.actualEndTime)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Timer */}
        {job.status === 'in_progress' && job.actualStartTime && (
          <div className="detail-section text-center">
            <h2 className="detail-section-title">Time Elapsed</h2>
            <p className="text-2xl font-bold text-emerald-400 mb-1">
              {Math.floor((Date.now() - new Date(job.actualStartTime).getTime()) / 60000)}m
            </p>
            <p className="text-sm text-gray-500">
              Started at {formatTime(job.actualStartTime)}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="bottom-actions">
        <ButtonLimiter
          actions={actions}
          maxVisibleButtons={4}
          showVoiceButton={false}
          layout="grid"
          className="w-full"
        />
      </div>

      {/* Voice Components */}
      <VoiceFloatingButton
        onTranscript={voiceCommand.processVoiceCommand}
        isProcessing={voiceCommand.isProcessing}
      />

      {voiceCommand.showClarification && voiceCommand.currentIntent && (
        <VoiceClarificationFlow
          isOpen={voiceCommand.showClarification}
          intentResult={voiceCommand.currentIntent}
          onClarify={voiceCommand.handleClarify}
          onCancel={voiceCommand.handleCancel}
        />
      )}

      {voiceCommand.showConfirmation && voiceCommand.currentIntent && (
        <VoiceConfirmationModal
          isOpen={voiceCommand.showConfirmation}
          intent={voiceCommand.currentIntent}
          onConfirm={voiceCommand.handleConfirm}
          onCancel={voiceCommand.handleCancel}
        />
      )}

      <style jsx>{`
        .mobile-container {
          width: 100%;
          max-width: 375px;
          height: 100vh;
          max-height: 812px;
          margin: 0 auto;
          background: #000;
          color: white;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 0.5rem;
          box-sizing: border-box;
        }

        .header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #333;
          background: rgba(0, 0, 0, 0.9);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 0.375rem;
          text-transform: capitalize;
        }

        .detail-section {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.75rem;
        }

        .detail-section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFD700;
          margin: 0 0 0.75rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .icon-button {
          padding: 0.5rem;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .icon-button:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .bottom-actions {
          padding: 1rem;
          background: rgba(0, 0, 0, 0.9);
          border-top: 1px solid #333;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1rem;
          background: #FFD700;
          color: #000;
          font-weight: 600;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #FFC700;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .item-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 0.5rem;
          padding: 0.75rem;
          transition: all 0.2s;
        }

        .item-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 215, 0, 0.4);
        }

        .item-thumbnail {
          width: 2.5rem;
          height: 2.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 0.375rem;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .space-y-4 > * + * {
          margin-top: 1rem;
        }

        .space-y-3 > * + * {
          margin-top: 0.75rem;
        }

        .space-y-2 > * + * {
          margin-top: 0.5rem;
        }

        .grid {
          display: grid;
        }

        .grid-cols-2 {
          grid-template-columns: repeat(2, 1fr);
        }

        .gap-3 {
          gap: 0.75rem;
        }

        .flex {
          display: flex;
        }

        .flex-1 {
          flex: 1;
        }

        .items-center {
          align-items: center;
        }

        .items-start {
          align-items: flex-start;
        }

        .justify-center {
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
