import { CompanySettingsRepository } from '@/lib/repositories/company-settings.repository';

jest.mock('@/lib/supabase/client');

const defaultRow = {
  id: 'settings-123',
  company_id: 'company-123',
  vision_thresholds: {
    confidenceThreshold: 0.7,
    maxObjects: 20,
    checkExpectedItems: true,
  },
  voice_preferences: {
    wakeWord: 'Hey JobEye',
    voiceName: 'Google US English',
    speechRate: 1,
    confirmationRequired: true,
  },
  budget_limits: {
    stt: 10,
    tts: 5,
    vlm: 25,
    llm: 50,
  },
  features: {
    offlineMode: true,
    visionVerification: true,
    voiceCommands: true,
  },
  created_at: '2025-09-28T00:00:00.000Z',
  updated_at: '2025-09-28T00:00:00.000Z',
};

describe('CompanySettingsRepository', () => {
  let repository: CompanySettingsRepository;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
      auth: {
        getUser: jest.fn(),
      },
      rpc: jest.fn(),
    };

    repository = new CompanySettingsRepository(mockSupabase);
  });

  it('creates default settings for company', async () => {
    const selectSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    });

    const selectEqMock = jest.fn().mockReturnValue({
      single: selectSingleMock,
    });

    const selectMock = jest.fn().mockReturnValue({
      eq: selectEqMock,
    });

    const insertSingleMock = jest.fn().mockResolvedValue({
      data: defaultRow,
      error: null,
    });

    const insertSelectMock = jest.fn().mockReturnValue({
      single: insertSingleMock,
    });

    const insertMock = jest.fn().mockReturnValue({
      select: insertSelectMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
      insert: insertMock,
    });

    const settings = await repository.ensureForCompany('company-123');

    expect(selectMock).toHaveBeenCalledWith('*');
    expect(selectEqMock).toHaveBeenCalledWith('company_id', 'company-123');
    expect(insertMock).toHaveBeenCalledWith({ company_id: 'company-123' });
    expect(settings.companyId).toBe('company-123');
    expect(settings.visionThresholds.confidenceThreshold).toBe(0.7);
    expect(settings.voicePreferences.wakeWord).toBe('Hey JobEye');
    expect(settings.budgetLimits.tts).toBe(5);
  });

  it('updates vision thresholds', async () => {
    const updatedRow = {
      ...defaultRow,
      vision_thresholds: {
        confidenceThreshold: 0.8,
        maxObjects: 15,
        checkExpectedItems: false,
      },
      updated_at: '2025-09-28T01:00:00.000Z',
    };

    const updateSingleMock = jest.fn().mockResolvedValue({
      data: updatedRow,
      error: null,
    });

    const updateSelectMock = jest.fn().mockReturnValue({
      single: updateSingleMock,
    });

    const updateEqMock = jest.fn().mockReturnValue({
      select: updateSelectMock,
    });

    const updateMock = jest.fn().mockReturnValue({
      eq: updateEqMock,
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const thresholds = {
      confidenceThreshold: 0.8,
      maxObjects: 15,
      checkExpectedItems: false,
    };

    const result = await repository.updateVisionThresholds('company-123', thresholds);

    expect(updateMock).toHaveBeenCalledWith({ vision_thresholds: thresholds });
    expect(updateEqMock).toHaveBeenCalledWith('company_id', 'company-123');
    expect(result.visionThresholds).toEqual(thresholds);
    expect(result.voicePreferences.wakeWord).toBe('Hey JobEye');
  });

  it('enforces RLS isolation', async () => {
    const selectSingleOwn = jest.fn().mockResolvedValue({
      data: defaultRow,
      error: null,
    });

    const selectSingleForbidden = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    const selectEqMock = jest.fn().mockImplementation((column: string, value: string) => {
      if (value === 'company-123') {
        return { single: selectSingleOwn };
      }

      return { single: selectSingleForbidden };
    });

    const selectMock = jest.fn().mockReturnValue({
      eq: selectEqMock,
    });

    mockSupabase.from.mockReturnValue({
      select: selectMock,
      insert: jest.fn(),
    });

    await expect(repository.getForCompany('company-999')).rejects.toThrow(
      'Failed to fetch company settings'
    );

    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          user_metadata: { company_id: 'company-123' },
          app_metadata: {},
        },
      },
      error: null,
    });

    const ownSettings = await repository.getForCurrentCompany();

    expect(selectEqMock).toHaveBeenCalledWith('company_id', 'company-123');
    expect(ownSettings.companyId).toBe('company-123');
  });
});
