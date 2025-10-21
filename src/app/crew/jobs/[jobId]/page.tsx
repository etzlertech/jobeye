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
  Image as ImageIcon
} from 'lucide-react';
import { ButtonLimiter, useButtonActions } from '@/components/ui/ButtonLimiter';
import { CameraCapture } from '@/components/camera/CameraCapture';
import { VoiceCommandButton } from '@/components/voice/VoiceCommandButton';
import { TenantBadge } from '@/components/tenant';
import { TaskList } from '@/components/tasks';

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

  const handleVoiceCommand = async (transcript: string) => {
    try {
      const response = await fetch('/api/crew/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: {
            currentPage: 'job_detail',
            jobId: job?.id,
            jobStatus: job?.status
          }
        })
      });

      const result = await response.json();
      
      // Handle voice actions
      if (result.response.actions) {
        for (const action of result.response.actions) {
          if (action.type === 'start_job') {
            handleStartJob();
          } else if (action.type === 'complete_job') {
            handleCompleteJob();
          } else if (action.type === 'take_photo') {
            setPhotoType('progress');
            setShowCamera(true);
          } else if (action.type === 'play_voice' && job?.voiceInstructionsUrl) {
            toggleVoiceInstructions();
          }
        }
      }
    } catch (error) {
      console.error('Voice command error:', error);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 mb-2">Failed to load job</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Go Back
          </button>
        </div>
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
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{job.customerName}</h1>
              <p className="text-sm text-gray-600">{job.propertyAddress}</p>
            </div>
            <div className="flex items-center gap-3">
              <TenantBadge />
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                job.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                job.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {job.status.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Job Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">{job.customerName}</p>
                      <p className="text-sm text-gray-600">{job.customerPhone}</p>
                    </div>
                    <button
                      onClick={() => window.open(`tel:${job.customerPhone}`)}
                      className="ml-auto p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{job.propertyAddress}</p>
                      <p className="text-sm text-gray-600 capitalize">{job.propertyType}</p>
                    </div>
                    <button
                      onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(job.propertyAddress)}`)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatTime(job.scheduledTime)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Est. {formatDuration(job.estimatedDuration)}
                      </p>
                    </div>
                  </div>

                  {job.templateName && (
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900">{job.templateName}</p>
                        <p className="text-sm text-gray-600">Job template</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            {(job.specialInstructions || job.voiceInstructions) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructions</h2>
                
                {job.voiceInstructions && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-blue-900">Voice Instructions from Supervisor</h3>
                      <div className="flex items-center gap-2">
                        {isPlayingVoice ? (
                          <Volume2 className="w-5 h-5 text-blue-600" />
                        ) : (
                          <VolumeX className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                    <p className="text-blue-800 text-sm mb-3">{job.voiceInstructions}</p>
                    {job.voiceInstructionsUrl && (
                      <button
                        onClick={toggleVoiceInstructions}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {isPlayingVoice ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isPlayingVoice ? 'Stop' : 'Play'} Voice
                      </button>
                    )}
                  </div>
                )}

                {job.specialInstructions && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Special Instructions</h3>
                    <p className="text-gray-700">{job.specialInstructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Equipment */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Required Equipment</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  job.loadVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {job.loadVerified ? 'Verified' : 'Not Verified'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {job.requiredEquipment.map(equipment => (
                  <div
                    key={equipment.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      equipment.verified 
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-orange-200 bg-orange-50'
                    }`}
                  >
                    <Package className={`w-5 h-5 ${
                      equipment.verified ? 'text-emerald-600' : 'text-orange-600'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{equipment.name}</p>
                      <p className="text-sm text-gray-600 capitalize">{equipment.category}</p>
                    </div>
                    {equipment.verified && (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                ))}
              </div>

              {!job.loadVerified && (
                <div className="mt-4">
                  <button
                    onClick={() => router.push(`/crew/job-load?jobId=${jobId}`)}
                    className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Load Items for Job
                  </button>
                </div>
              )}
            </div>

            {/* Task List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Tasks</h2>
              <TaskList
                jobId={jobId}
                editable={job.status === 'in_progress'}
                onTaskComplete={handleTaskComplete}
              />
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {photos.map(photo => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.thumbnailUrl}
                        alt={`${photo.type} photo`}
                        className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90"
                        onClick={() => window.open(photo.url, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                        photo.type === 'start' ? 'bg-green-100 text-green-800' :
                        photo.type === 'completion' ? 'bg-blue-100 text-blue-800' :
                        photo.type === 'issue' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {photo.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

            {/* Voice Assistant */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Assistant</h3>
              <div className="text-center">
                <VoiceCommandButton
                  onTranscript={handleVoiceCommand}
                  size="lg"
                  className="mx-auto"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Try: "Start job", "Take photo", "Play voice"
                </p>
              </div>
            </div>

            {/* Job Progress */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    job.status !== 'assigned' ? 'bg-emerald-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">Job started</span>
                  {job.actualStartTime && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {formatTime(job.actualStartTime)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    photos.some(p => p.type === 'start') ? 'bg-emerald-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">Start photo</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    job.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-700">Job completed</span>
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
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Elapsed</h3>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {Math.floor((Date.now() - new Date(job.actualStartTime).getTime()) / 60000)}m
                  </p>
                  <p className="text-sm text-gray-600">
                    Started at {formatTime(job.actualStartTime)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}