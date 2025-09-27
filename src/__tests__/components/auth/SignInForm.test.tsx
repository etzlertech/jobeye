/**
 * Tests for SignInForm component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import SignInForm from '@/components/auth/SignInForm';
import { supabase } from '@/lib/supabase/client';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('SignInForm', () => {
  const mockPush = jest.fn();
  const mockSupabase = supabase as jest.Mocked<typeof supabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    
    // Mock auth audit log insert
    const mockFrom = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockSupabase.from.mockReturnValue(mockFrom as any);
  });

  it('should render sign in form with all fields', () => {
    render(<SignInForm />);

    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText('Remember me')).toBeInTheDocument();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
  });

  it('should handle successful sign in without voice profile', async () => {
    const user = userEvent.setup();
    
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
      },
      error: null,
    } as any);

    // Mock audit log insert
    const auditLogMock = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockSupabase.from.mockReturnValueOnce(auditLogMock as any);

    // Mock voice profile check - no profile
    const voiceProfileMock = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      }),
    };
    mockSupabase.from.mockReturnValueOnce(voiceProfileMock as any);

    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText('Email address'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockPush).toHaveBeenCalledWith('/onboarding/voice');
    });
  });

  it('should handle successful sign in with completed voice profile', async () => {
    const user = userEvent.setup();
    
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
      },
      error: null,
    } as any);

    // Mock audit log insert
    const auditLogMock = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockSupabase.from.mockReturnValueOnce(auditLogMock as any);

    // Mock voice profile check - profile completed
    const voiceProfileMock = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { onboarding_completed: true },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(voiceProfileMock as any);

    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText('Email address'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should display error message on failed sign in', async () => {
    const user = userEvent.setup();
    
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: new Error('Invalid credentials'),
    } as any);

    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText('Email address'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should disable form while loading', async () => {
    const user = userEvent.setup();
    
    // Mock a slow sign in
    mockSupabase.auth.signInWithPassword.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        data: { user: null, session: null },
        error: null,
      } as any), 100))
    );

    render(<SignInForm />);

    const emailInput = screen.getByPlaceholderText('Email address');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    
    // Click submit
    fireEvent.click(submitButton);

    // Check that inputs are disabled during loading
    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();

    // Wait for the promise to resolve
    await waitFor(() => {
      expect(emailInput).not.toBeDisabled();
    });
  });

  it('should log authentication events', async () => {
    const user = userEvent.setup();
    
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'token', refresh_token: 'refresh' },
      },
      error: null,
    } as any);

    // Mock successful auth log and voice profile
    const authLogMock = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const voiceProfileMock = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { onboarding_completed: true }, error: null }),
    };
    
    mockSupabase.from
      .mockReturnValueOnce(authLogMock as any) // First call for auth log
      .mockReturnValueOnce(voiceProfileMock as any); // Second call for voice profile

    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText('Email address'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authLogMock.insert).toHaveBeenCalledWith({
        event_type: 'sign_in',
        user_id: 'user-123',
        user_email: 'test@example.com',
        tenant_id: null,
        success: true,
        ip_address: null,
        user_agent: expect.any(String),
        device_type: expect.stringMatching(/mobile|desktop/),
      });
    });
  });

  it('should log failed authentication attempts', async () => {
    const user = userEvent.setup();
    
    mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: new Error('Invalid credentials'),
    } as any);

    const authLogMock = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    
    // Return authLogMock for both potential calls (once in the error handler)
    mockSupabase.from.mockReturnValue(authLogMock as any);

    render(<SignInForm />);

    await user.type(screen.getByPlaceholderText('Email address'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authLogMock.insert).toHaveBeenCalledWith({
        event_type: 'sign_in',
        user_email: 'test@example.com',
        success: false,
        reason: 'Invalid credentials',
        ip_address: null,
        user_agent: expect.any(String),
        device_type: expect.stringMatching(/mobile|desktop/),
      });
    });
  });

  it('should handle form validation', async () => {
    render(<SignInForm />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    const emailInput = screen.getByPlaceholderText('Email address') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;

    // Check that inputs are required
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    
    // Check email input type
    expect(emailInput.type).toBe('email');
    expect(passwordInput.type).toBe('password');
  });
});