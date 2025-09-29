/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/config/labor-rules.ts
 * phase: 3
 * domain: scheduling
 * purpose: Define labor rules and compliance requirements
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 100
 * migrations_touched: none
 * state_machine: none
 * estimated_llm_cost: 0.0005
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: none
 *   external: none
 *   supabase: none
 * exports:
 *   - LaborRules
 *   - getDefaultLaborRules
 *   - getStateSpecificRules
 * voice_considerations:
 *   - Simple rule explanations for voice queries
 *   - Voice-friendly break reminders
 * test_requirements:
 *   coverage: 100%
 *   test_file: src/__tests__/scheduling/unit/labor-rules.test.ts
 * tasks:
 *   - Define default labor rules
 *   - Support state-specific rules
 *   - Include break requirements
 *   - Define overtime thresholds
 */

export interface LaborRules {
  maxContinuousWorkHours: number;
  maxDailyHours: number;
  maxWeeklyHours: number;
  overtimeThresholdDaily: number;
  overtimeThresholdWeekly: number;
  restBreakDuration: number;
  mealBreakDuration: number;
  maxHoursBeforeMealBreak: number;
  minHoursBetweenShifts: number;
  voiceReminders: {
    breakWarningMinutes: number;
    overtimeWarningHours: number;
  };
}

export interface StateSpecificRules extends LaborRules {
  state: string;
  additionalRequirements?: {
    paidBreaks?: boolean;
    splitShiftPremium?: boolean;
    heatBreakRequired?: boolean;
    heatBreakThresholdTemp?: number;
  };
}

// Default federal rules (baseline)
const defaultRules: LaborRules = {
  maxContinuousWorkHours: 4,
  maxDailyHours: 12,
  maxWeeklyHours: 60,
  overtimeThresholdDaily: 8,
  overtimeThresholdWeekly: 40,
  restBreakDuration: 15,
  mealBreakDuration: 30,
  maxHoursBeforeMealBreak: 6,
  minHoursBetweenShifts: 8,
  voiceReminders: {
    breakWarningMinutes: 15,
    overtimeWarningHours: 1
  }
};

// State-specific overrides
const stateRules: Record<string, Partial<StateSpecificRules>> = {
  CA: {
    state: 'California',
    maxContinuousWorkHours: 4,
    maxHoursBeforeMealBreak: 5,
    mealBreakDuration: 30,
    restBreakDuration: 10,
    overtimeThresholdDaily: 8,
    additionalRequirements: {
      paidBreaks: true,
      splitShiftPremium: true,
      heatBreakRequired: true,
      heatBreakThresholdTemp: 80
    }
  },
  TX: {
    state: 'Texas',
    maxContinuousWorkHours: 6,
    additionalRequirements: {
      heatBreakRequired: true,
      heatBreakThresholdTemp: 95
    }
  },
  NY: {
    state: 'New York',
    maxHoursBeforeMealBreak: 6,
    mealBreakDuration: 30,
    additionalRequirements: {
      paidBreaks: false
    }
  },
  FL: {
    state: 'Florida',
    additionalRequirements: {
      heatBreakRequired: true,
      heatBreakThresholdTemp: 90
    }
  }
};

export function getDefaultLaborRules(): LaborRules {
  return { ...defaultRules };
}

export function getStateSpecificRules(stateCode: string): StateSpecificRules {
  const baseRules = getDefaultLaborRules();
  const stateOverrides = stateRules[stateCode.toUpperCase()];

  if (!stateOverrides) {
    return {
      ...baseRules,
      state: stateCode
    };
  }

  return {
    ...baseRules,
    ...stateOverrides,
    state: stateOverrides.state || stateCode
  } as StateSpecificRules;
}

// Helper functions for voice-friendly rule explanations
export function getBreakRulesSummary(rules: LaborRules): string {
  return `${rules.restBreakDuration} minute break every ${rules.maxContinuousWorkHours} hours, ` +
         `${rules.mealBreakDuration} minute meal break after ${rules.maxHoursBeforeMealBreak} hours`;
}

export function getOvertimeRulesSummary(rules: LaborRules): string {
  return `Overtime after ${rules.overtimeThresholdDaily} hours daily or ${rules.overtimeThresholdWeekly} hours weekly`;
}

// Validation helpers
export function validateWorkHours(
  hoursWorked: number,
  rules: LaborRules
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (hoursWorked > rules.maxDailyHours) {
    warnings.push(`Exceeds maximum daily hours (${rules.maxDailyHours})`);
  }

  if (hoursWorked > rules.overtimeThresholdDaily) {
    warnings.push(`Overtime required after ${rules.overtimeThresholdDaily} hours`);
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

export function calculateBreaksRequired(
  totalWorkHours: number,
  rules: LaborRules
): { restBreaks: number; mealBreaks: number } {
  const restBreaks = Math.floor(totalWorkHours / rules.maxContinuousWorkHours);
  const mealBreaks = totalWorkHours >= rules.maxHoursBeforeMealBreak ? 1 : 0;

  return { restBreaks, mealBreaks };
}

// Temperature-based break requirements
export function requiresHeatBreak(
  temperature: number,
  stateCode: string
): { required: boolean; reason?: string } {
  const rules = getStateSpecificRules(stateCode);
  
  if (rules.additionalRequirements?.heatBreakRequired && 
      rules.additionalRequirements.heatBreakThresholdTemp &&
      temperature >= rules.additionalRequirements.heatBreakThresholdTemp) {
    return {
      required: true,
      reason: `Temperature ${temperature}°F exceeds ${rules.additionalRequirements.heatBreakThresholdTemp}°F threshold`
    };
  }

  return { required: false };
}