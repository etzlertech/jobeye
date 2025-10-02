/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /tests/integration/mvp-pages.test.tsx
 * phase: 3
 * domain: testing
 * purpose: Integration tests for MVP Intent-Driven Mobile App pages
 * spec_ref: 007-mvp-intent-driven/contracts/mvp-integration-tests.md
 * complexity_budget: 400
 * migrations_touched: []
 * state_machine: {
 *   states: ['setup', 'testing', 'cleanup', 'complete'],
 *   transitions: [
 *     'setup->testing: testsStarted()',
 *     'testing->cleanup: testsFinished()',
 *     'cleanup->complete: cleanupDone()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "testSuite": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/app/supervisor/jobs/create/page',
 *     '@/app/crew/page',
 *     '@/app/crew/jobs/[jobId]/page',
 *     '@/app/crew/load-verify/page',
 *     '@/app/admin/page'
 *   ],
 *   external: ['jest', '@testing-library/react', '@testing-library/jest-dom'],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Test voice recording, playback, and command processing
 * test_requirements: {
 *   coverage: 90,
 *   scenarios: ['role-based access', 'voice interactions', 'camera workflows', 'offline sync']
 * }
 * tasks: [
 *   'Test supervisor job creation with voice instructions',
 *   'Test crew dashboard job management',
 *   'Test crew job detail with voice playback',
 *   'Test load verification with AI vision'
 * ]
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

// Import pages to test
import SupervisorJobCreatePage from '@/app/supervisor/jobs/create/page';
import CrewDashboardPage from '@/app/crew/page';
import CrewJobDetailPage from '@/app/crew/jobs/[jobId]/page';
import CrewLoadVerifyPage from '@/app/crew/load-verify/page';
import AdminDashboardPage from '@/app/admin/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn()
  }))
}));

// Mock voice processor
jest.mock('@/lib/voice/voice-processor', () => ({
  voiceProcessor: {
    startListening: jest.fn(),
    stopListening: jest.fn(),
    speak: jest.fn(),
    getStatus: jest.fn(() => ({
      isListening: false,
      isProcessing: false,
      isSpeaking: false,
      isSupported: true
    })),
    onVoiceResult: jest.fn(() => () => {}),
    onCommandProcessed: jest.fn(() => () => {})
  }
}));

// Mock offline database
jest.mock('@/lib/offline/offline-db', () => ({
  offlineDB: {
    initialize: jest.fn(),
    storeVoiceRecording: jest.fn(),
    storeImageData: jest.fn()
  }
}));

// Mock camera component
jest.mock('@/components/camera/CameraCapture', () => {
  return function MockCameraCapture({ onCapture, onClose }: any) {
    return (
      <div data-testid="camera-capture">
        <button onClick={() => onCapture(new Blob(), 'test-image-url')}>
          Capture Photo
        </button>
        <button onClick={onClose}>Close Camera</button>
      </div>
    );
  };
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Web APIs
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    })
  }
});

Object.defineProperty(global, 'MediaRecorder', {
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    ondataavailable: jest.fn(),
    state: 'inactive',
    stream: {
      getTracks: () => [{ stop: jest.fn() }]
    }
  }))
});

describe('MVP Pages Integration Tests', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  describe('Supervisor Job Creation Page', () => {
    it('should render job creation form with voice recording capability', () => {
      render(<SupervisorJobCreatePage />);
      
      expect(screen.getByText('Create New Job')).toBeInTheDocument();
      expect(screen.getByText('Record Voice Instructions')).toBeInTheDocument();
      expect(screen.getByTestId('voice-recording-section')).toBeInTheDocument();
    });

    it('should handle voice recording workflow', async () => {
      render(<SupervisorJobCreatePage />);
      
      const recordButton = screen.getByRole('button', { name: /start recording/i });
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
      });
      
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      fireEvent.click(stopButton);
      
      await waitFor(() => {
        expect(screen.getByText('Voice instructions recorded')).toBeInTheDocument();
      });
    });

    it('should progress through equipment assignment steps', async () => {
      render(<SupervisorJobCreatePage />);
      
      // Fill job details
      const titleInput = screen.getByPlaceholderText('Job title...');
      fireEvent.change(titleInput, { target: { value: 'Test Lawn Maintenance' } });
      
      // Proceed to equipment selection
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Equipment Assignment')).toBeInTheDocument();
      });
    });

    it('should handle job creation submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          job: { id: 'job-123', title: 'Test Job' }
        })
      });

      render(<SupervisorJobCreatePage />);
      
      // Fill required fields and submit
      const titleInput = screen.getByPlaceholderText('Job title...');
      fireEvent.change(titleInput, { target: { value: 'Test Job' } });
      
      const createButton = screen.getByRole('button', { name: /create job/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/supervisor/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test Job')
        });
      });
    });

    it('should respect 4-button limit constraint', () => {
      render(<SupervisorJobCreatePage />);
      
      const buttonLimiter = screen.getByTestId('button-limiter');
      const buttons = buttonLimiter.querySelectorAll('button');
      
      expect(buttons.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Crew Dashboard Page', () => {
    const mockJobs = [
      {
        id: 'job-1',
        title: 'Morning Lawn Care',
        status: 'assigned',
        location: '123 Main St',
        estimatedDuration: 120,
        priority: 'high'
      },
      {
        id: 'job-2', 
        title: 'Afternoon Maintenance',
        status: 'in_progress',
        location: '456 Oak Ave',
        estimatedDuration: 90,
        priority: 'medium'
      }
    ];

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobs: mockJobs })
      });
    });

    it('should display assigned jobs for crew member', async () => {
      render(<CrewDashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Morning Lawn Care')).toBeInTheDocument();
        expect(screen.getByText('Afternoon Maintenance')).toBeInTheDocument();
      });
    });

    it('should handle job status updates', async () => {
      render(<CrewDashboardPage />);
      
      await waitFor(() => {
        const startButton = screen.getByRole('button', { name: /start.*morning lawn care/i });
        fireEvent.click(startButton);
      });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/crew/jobs/job-1/start', {
        method: 'POST'
      });
    });

    it('should navigate to job details when job is clicked', async () => {
      render(<CrewDashboardPage />);
      
      await waitFor(() => {
        const jobCard = screen.getByText('Morning Lawn Care').closest('div');
        fireEvent.click(jobCard!);
      });
      
      expect(mockRouter.push).toHaveBeenCalledWith('/crew/jobs/job-1');
    });

    it('should show quick action buttons with voice support', async () => {
      render(<CrewDashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /verify load/i })).toBeInTheDocument();
        expect(screen.getByTestId('voice-command-button')).toBeInTheDocument();
      });
    });
  });

  describe('Crew Job Detail Page', () => {
    const mockJobId = 'job-123';
    const mockJob = {
      id: mockJobId,
      title: 'Property Maintenance',
      description: 'Complete lawn care and landscaping',
      status: 'in_progress',
      location: '789 Pine St',
      voiceInstructionsUrl: '/audio/instructions-123.mp3',
      equipment: ['mower', 'trimmer', 'blower'],
      photos: []
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ job: mockJob })
      });
    });

    it('should load and display job details', async () => {
      render(<CrewJobDetailPage params={{ jobId: mockJobId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('Property Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Complete lawn care and landscaping')).toBeInTheDocument();
        expect(screen.getByText('789 Pine St')).toBeInTheDocument();
      });
    });

    it('should handle voice instructions playback', async () => {
      // Mock Audio API
      const mockAudio = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        addEventListener: jest.fn()
      };
      (global as any).Audio = jest.fn(() => mockAudio);

      render(<CrewJobDetailPage params={{ jobId: mockJobId }} />);
      
      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /play voice instructions/i });
        fireEvent.click(playButton);
      });
      
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should handle photo capture workflow', async () => {
      render(<CrewJobDetailPage params={{ jobId: mockJobId }} />);
      
      await waitFor(() => {
        const photoButton = screen.getByRole('button', { name: /take photo/i });
        fireEvent.click(photoButton);
      });
      
      expect(screen.getByTestId('camera-capture')).toBeInTheDocument();
      
      const captureButton = screen.getByText('Capture Photo');
      fireEvent.click(captureButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/crew/jobs/${mockJobId}/photos`, {
          method: 'POST',
          body: expect.any(FormData)
        });
      });
    });

    it('should handle job completion', async () => {
      render(<CrewJobDetailPage params={{ jobId: mockJobId }} />);
      
      await waitFor(() => {
        const completeButton = screen.getByRole('button', { name: /complete job/i });
        fireEvent.click(completeButton);
      });
      
      expect(mockFetch).toHaveBeenCalledWith(`/api/crew/jobs/${mockJobId}/complete`, {
        method: 'POST'
      });
    });

    it('should show job progress indicators', async () => {
      render(<CrewJobDetailPage params={{ jobId: mockJobId }} />);
      
      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument();
        expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Crew Load Verification Page', () => {
    const mockJobs = [
      {
        id: 'job-1',
        title: 'Morning Route',
        status: 'assigned',
        equipment: ['mower', 'trimmer', 'blower']
      }
    ];

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ jobs: mockJobs })
      });
    });

    it('should display job selection for load verification', async () => {
      render(<CrewLoadVerifyPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Select Job for Load Verification')).toBeInTheDocument();
        expect(screen.getByText('Morning Route')).toBeInTheDocument();
      });
    });

    it('should handle AI vision verification workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verified: true,
          detectedItems: ['mower', 'trimmer', 'blower'],
          missingItems: [],
          confidence: 0.95
        })
      });

      render(<CrewLoadVerifyPage />);
      
      // Select job
      await waitFor(() => {
        const jobCard = screen.getByText('Morning Route');
        fireEvent.click(jobCard);
      });
      
      // Take verification photo
      const cameraButton = screen.getByRole('button', { name: /take verification photo/i });
      fireEvent.click(cameraButton);
      
      const captureButton = screen.getByText('Capture Photo');
      fireEvent.click(captureButton);
      
      await waitFor(() => {
        expect(screen.getByText('Load Verified Successfully')).toBeInTheDocument();
        expect(screen.getByText('All required equipment detected')).toBeInTheDocument();
      });
    });

    it('should handle missing equipment detection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          verified: false,
          detectedItems: ['mower', 'trimmer'],
          missingItems: ['blower'],
          confidence: 0.85
        })
      });

      render(<CrewLoadVerifyPage />);
      
      // Go through verification workflow
      await waitFor(() => {
        const jobCard = screen.getByText('Morning Route');
        fireEvent.click(jobCard);
      });
      
      const cameraButton = screen.getByRole('button', { name: /take verification photo/i });
      fireEvent.click(cameraButton);
      
      const captureButton = screen.getByText('Capture Photo');
      fireEvent.click(captureButton);
      
      await waitFor(() => {
        expect(screen.getByText('Missing Equipment Detected')).toBeInTheDocument();
        expect(screen.getByText('blower')).toBeInTheDocument();
      });
    });

    it('should allow manual override for verification', async () => {
      render(<CrewLoadVerifyPage />);
      
      await waitFor(() => {
        const manualButton = screen.getByRole('button', { name: /manual verification/i });
        fireEvent.click(manualButton);
      });
      
      expect(screen.getByText('Manual Equipment Check')).toBeInTheDocument();
      
      // Check off equipment
      const mowerCheckbox = screen.getByRole('checkbox', { name: /mower/i });
      fireEvent.click(mowerCheckbox);
      
      const confirmButton = screen.getByRole('button', { name: /confirm load/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/crew/verify-load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('manual')
        });
      });
    });
  });

  describe('Admin Dashboard Page', () => {
    const mockUsers = [
      { id: 'user-1', email: 'crew@test.com', fullName: 'John Crew', role: 'crew', companyName: 'Test Co' },
      { id: 'user-2', email: 'super@test.com', fullName: 'Jane Super', role: 'supervisor', companyName: 'Test Co' }
    ];

    const mockCompanies = [
      { id: 'comp-1', name: 'Test Company', userCount: 5, activeJobs: 3, monthlySpend: 299 }
    ];

    const mockStats = {
      totalUsers: 10,
      totalCompanies: 2,
      activeJobs: 15,
      monthlyRevenue: 5980,
      systemHealth: 'healthy'
    };

    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ companies: mockCompanies })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ stats: mockStats })
        });
    });

    it('should display system overview with statistics', async () => {
      render(<AdminDashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument(); // Total users
        expect(screen.getByText('2')).toBeInTheDocument(); // Total companies
        expect(screen.getByText('15')).toBeInTheDocument(); // Active jobs
        expect(screen.getByText('$5,980.00')).toBeInTheDocument(); // Monthly revenue
      });
    });

    it('should handle user management operations', async () => {
      render(<AdminDashboardPage />);
      
      // Switch to users tab
      await waitFor(() => {
        const usersTab = screen.getByRole('button', { name: /users/i });
        fireEvent.click(usersTab);
      });
      
      expect(screen.getByText('crew@test.com')).toBeInTheDocument();
      expect(screen.getByText('super@test.com')).toBeInTheDocument();
    });

    it('should handle user creation workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { id: 'new-user', email: 'new@test.com', role: 'crew' }
        })
      });

      render(<AdminDashboardPage />);
      
      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add user/i });
        fireEvent.click(addButton);
      });
      
      // Fill user form
      const emailInput = screen.getByPlaceholderText('user@company.com');
      fireEvent.change(emailInput, { target: { value: 'new@test.com' } });
      
      const nameInput = screen.getByPlaceholderText('John Smith');
      fireEvent.change(nameInput, { target: { value: 'New User' } });
      
      const createButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('new@test.com')
        });
      });
    });

    it('should handle role updates', async () => {
      render(<AdminDashboardPage />);
      
      await waitFor(() => {
        const usersTab = screen.getByRole('button', { name: /users/i });
        fireEvent.click(usersTab);
      });
      
      await waitFor(() => {
        const roleSelect = screen.getAllByDisplayValue('crew')[0];
        fireEvent.change(roleSelect, { target: { value: 'supervisor' } });
      });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/user-1/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'supervisor' })
      });
    });

    it('should display system health status', async () => {
      render(<AdminDashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText('System healthy')).toBeInTheDocument();
        expect(screen.getByText('Database: Healthy')).toBeInTheDocument();
        expect(screen.getByText('API: Operational')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Page Integration', () => {
    it('should maintain voice processor state across page navigation', async () => {
      const { voiceProcessor } = require('@/lib/voice/voice-processor');
      
      // Test voice state persistence
      expect(voiceProcessor.getStatus).toHaveBeenCalled();
    });

    it('should handle offline mode gracefully', async () => {
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      render(<CrewDashboardPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
      });
    });

    it('should sync data when coming back online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      
      render(<CrewDashboardPage />);
      
      // Go online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      window.dispatchEvent(new Event('online'));
      
      await waitFor(() => {
        // Should trigger sync operations
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});