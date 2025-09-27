import {
  AppError,
  DatabaseError,
  VoiceError,
  ValidationError,
  AuthenticationError,
  NetworkError,
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  createAppError,
  ErrorOptions,
} from '@/core/errors/error-types';

describe('Error Types', () => {
  describe('ErrorCode enum', () => {
    it('should have correct error code values', () => {
      expect(ErrorCode.UNKNOWN).toBe(1000);
      expect(ErrorCode.INVALID_INPUT).toBe(1001);
      expect(ErrorCode.UNAUTHORIZED).toBe(1002);
      expect(ErrorCode.DATABASE_CONNECTION).toBe(2000);
      expect(ErrorCode.VOICE_RECOGNITION).toBe(3000);
      expect(ErrorCode.NETWORK_OFFLINE).toBe(4000);
      expect(ErrorCode.AUTH_INVALID_CREDENTIALS).toBe(5000);
    });
  });

  describe('ErrorSeverity enum', () => {
    it('should have correct severity levels', () => {
      expect(ErrorSeverity.INFO).toBe('info');
      expect(ErrorSeverity.LOW).toBe('low');
      expect(ErrorSeverity.MEDIUM).toBe('medium');
      expect(ErrorSeverity.HIGH).toBe('high');
      expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('ErrorCategory enum', () => {
    it('should have correct categories', () => {
      expect(ErrorCategory.VALIDATION).toBe('validation');
      expect(ErrorCategory.BUSINESS_LOGIC).toBe('business_logic');
      expect(ErrorCategory.DATABASE).toBe('database');
      expect(ErrorCategory.NETWORK).toBe('network');
      expect(ErrorCategory.AUTHENTICATION).toBe('authentication');
      expect(ErrorCategory.VOICE).toBe('voice');
      expect(ErrorCategory.SYSTEM).toBe('system');
    });
  });

  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.UNKNOWN);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.voiceMessage).toBeTruthy();
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom values', () => {
      const error = new AppError(
        'Database connection failed',
        ErrorCode.DATABASE_CONNECTION,
        ErrorSeverity.HIGH,
        'Database is not available'
      );

      expect(error.message).toBe('Database connection failed');
      expect(error.code).toBe(ErrorCode.DATABASE_CONNECTION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.voiceMessage).toBe('Database is not available');
    });

    it('should generate voice message from error message', () => {
      const error = new AppError('Error: Invalid user input!');

      expect(error.voiceMessage).toBe('Error Invalid User Input');
    });

    it('should maintain stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should be instanceof Error', () => {
      const error = new AppError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('DatabaseError', () => {
    it('should create database error with defaults', () => {
      const error = new DatabaseError('Connection timeout');

      expect(error.message).toBe('Connection timeout');
      expect(error.code).toBe(ErrorCode.DATABASE_CONNECTION);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.voiceMessage).toBe('Database connection issue detected');
      expect(error.name).toBe('DatabaseError');
    });

    it('should accept custom error code', () => {
      const error = new DatabaseError('Query failed', ErrorCode.DATABASE_QUERY);

      expect(error.code).toBe(ErrorCode.DATABASE_QUERY);
    });

    it('should be instanceof DatabaseError and AppError', () => {
      const error = new DatabaseError('Test');

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('VoiceError', () => {
    it('should create voice error with audio context', () => {
      const audioContext = { sampleRate: 44100, channels: 2 };
      const error = new VoiceError('Microphone not available', ErrorCode.VOICE_DEVICE, audioContext);

      expect(error.message).toBe('Microphone not available');
      expect(error.code).toBe(ErrorCode.VOICE_DEVICE);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.voiceMessage).toBe('Voice system error occurred');
      expect(error.audioContext).toEqual(audioContext);
      expect(error.name).toBe('VoiceError');
    });

    it('should work without audio context', () => {
      const error = new VoiceError('Recognition failed');

      expect(error.audioContext).toBeUndefined();
      expect(error.code).toBe(ErrorCode.VOICE_RECOGNITION);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field', () => {
      const error = new ValidationError('Email is required', 'email');

      expect(error.message).toBe('Email is required');
      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.field).toBe('email');
      expect(error.voiceMessage).toBe('Input validation failed');
      expect(error.name).toBe('ValidationError');
    });

    it('should work without field', () => {
      const error = new ValidationError('Invalid input');

      expect(error.field).toBeUndefined();
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid credentials');

      expect(error.message).toBe('Invalid credentials');
      expect(error.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.voiceMessage).toBe('Authentication required');
      expect(error.name).toBe('AuthenticationError');
    });

    it('should accept custom error code', () => {
      const error = new AuthenticationError('Token expired', ErrorCode.AUTH_TOKEN_EXPIRED);

      expect(error.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
    });
  });

  describe('NetworkError', () => {
    it('should create network error', () => {
      const error = new NetworkError('Connection timeout');

      expect(error.message).toBe('Connection timeout');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.voiceMessage).toBe('Network connectivity issue');
      expect(error.name).toBe('NetworkError');
    });

    it('should accept custom error code', () => {
      const error = new NetworkError('No internet', ErrorCode.NETWORK_OFFLINE);

      expect(error.code).toBe(ErrorCode.NETWORK_OFFLINE);
    });
  });

  describe('createAppError', () => {
    it('should create error from options', () => {
      const options: ErrorOptions = {
        code: 'CUSTOM_ERROR',
        message: 'Something went wrong',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        userMessage: 'Please try again later',
        originalError: new Error('Original error'),
        metadata: { userId: '123', action: 'create' },
      };

      const error = createAppError(options);

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Something went wrong');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect((error as any).category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect((error as any).userMessage).toBe('Please try again later');
      expect((error as any).originalError).toBeDefined();
      expect((error as any).metadata).toEqual(options.metadata);
    });

    it('should use default error code when not mapped', () => {
      const error = createAppError({
        code: 'UNMAPPED_CODE',
        message: 'Test',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.SYSTEM,
      });

      expect(error.code).toBe(ErrorCode.UNKNOWN);
    });
  });

  describe('Error serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', ErrorCode.INVALID_INPUT, ErrorSeverity.HIGH);
      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.message).toBe('Test error');
      expect(parsed.code).toBe(ErrorCode.INVALID_INPUT);
      expect(parsed.severity).toBe(ErrorSeverity.HIGH);
      expect(parsed.voiceMessage).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('Error inheritance', () => {
    it('should maintain prototype chain', () => {
      const dbError = new DatabaseError('DB Error');
      const voiceError = new VoiceError('Voice Error');
      const validationError = new ValidationError('Validation Error');
      const authError = new AuthenticationError('Auth Error');
      const networkError = new NetworkError('Network Error');

      // All should be instances of their specific class
      expect(dbError.constructor.name).toBe('DatabaseError');
      expect(voiceError.constructor.name).toBe('VoiceError');
      expect(validationError.constructor.name).toBe('ValidationError');
      expect(authError.constructor.name).toBe('AuthenticationError');
      expect(networkError.constructor.name).toBe('NetworkError');

      // All should be instances of AppError
      expect(dbError).toBeInstanceOf(AppError);
      expect(voiceError).toBeInstanceOf(AppError);
      expect(validationError).toBeInstanceOf(AppError);
      expect(authError).toBeInstanceOf(AppError);
      expect(networkError).toBeInstanceOf(AppError);

      // All should be instances of Error
      expect(dbError).toBeInstanceOf(Error);
      expect(voiceError).toBeInstanceOf(Error);
      expect(validationError).toBeInstanceOf(Error);
      expect(authError).toBeInstanceOf(Error);
      expect(networkError).toBeInstanceOf(Error);
    });
  });

  describe('Error comparison', () => {
    it('should allow comparison by error code', () => {
      const error1 = new AppError('Error 1', ErrorCode.INVALID_INPUT);
      const error2 = new AppError('Error 2', ErrorCode.INVALID_INPUT);
      const error3 = new AppError('Error 3', ErrorCode.UNAUTHORIZED);

      expect(error1.code).toBe(error2.code);
      expect(error1.code).not.toBe(error3.code);
    });

    it('should allow comparison by severity', () => {
      const criticalError = new AppError('Critical', ErrorCode.UNKNOWN, ErrorSeverity.CRITICAL);
      const infoError = new AppError('Info', ErrorCode.UNKNOWN, ErrorSeverity.INFO);

      expect(criticalError.severity).not.toBe(infoError.severity);
    });
  });

  describe('Voice message generation', () => {
    it('should handle complex error messages', () => {
      const complexMessages = [
        { input: 'Error: Connection failed @ 192.168.1.1:5432', expected: 'Error Connection Failed  Ipaddress' },
        { input: 'Invalid JSON: {bad}', expected: 'Invalid Json Bad' },
        { input: '404 - Not Found!', expected: ' Not Found' },
        { input: 'user@email.com is invalid', expected: 'Useremailcom Is Invalid' },
      ];

      complexMessages.forEach(({ input, expected }) => {
        const error = new AppError(input);
        expect(error.voiceMessage).toBe(expected);
      });
    });
  });
});