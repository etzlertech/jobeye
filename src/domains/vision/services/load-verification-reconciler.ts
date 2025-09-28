import { Logger } from '@/core/logger/logger';
import {
  ChecklistAutoStatus,
  ChecklistStatus,
  JobChecklistItem,
  JobChecklistRepository,
} from '@/domains/job/repositories/job-checklist-repository';
import { LoadVerificationAnalysis } from '@/domains/vision/types/load-verification-types';

export interface ReconciliationResultItem {
  checklistItemId: string;
  autoStatus: ChecklistAutoStatus;
  confidence: number | null;
  finalStatus: ChecklistStatus;
  manualOverrideApplied: boolean;
}

export interface LoadVerificationReconciliationResult {
  jobId: string;
  verificationId: string;
  updatedItems: ReconciliationResultItem[];
  mismatchedItems: string[];
  missingItems: string[];
  overridesRespected: string[];
}

export interface ReconciliationOptions {
  respectManualOverrides?: boolean;
  minimumConfidence?: number;
}

export interface ReconciliationParams {
  jobId: string;
  verificationId: string;
  analysis: LoadVerificationAnalysis;
  checklistItems?: JobChecklistItem[];
  options?: ReconciliationOptions;
}

const defaultOptions: ReconciliationOptions = {
  respectManualOverrides: true,
  minimumConfidence: 0.6,
};

export class LoadVerificationReconciler {
  private readonly logger: Logger;

  constructor(private readonly checklistRepository: JobChecklistRepository, logger?: Logger) {
    this.logger = logger || new Logger('load-verification-reconciler');
  }

  async reconcile(
    params: ReconciliationParams
  ): Promise<LoadVerificationReconciliationResult> {
    const { jobId, verificationId, analysis } = params;
    const options = { ...defaultOptions, ...params.options };
    const checklistItems = params.checklistItems ?? await this.checklistRepository.listByJob(jobId);

    const timestampIso = new Date().toISOString();
    const verifiedMap = new Map(analysis.verifiedItems.map(item => [item.checklistItemId, item]));
    const missingSet = new Set(analysis.missingItems.map(item => item.checklistItemId));

    const updatedItems: ReconciliationResultItem[] = [];
    const mismatchedItems: string[] = [];
    const overridesRespected: string[] = [];

    for (const item of checklistItems) {
      const verifiedEntry = verifiedMap.get(item.id);
      let autoStatus: ChecklistAutoStatus = 'pending';
      let confidence: number | null = null;

      if (verifiedEntry) {
        autoStatus = verifiedEntry.status as ChecklistAutoStatus;
        confidence = verifiedEntry.confidence ?? null;

        if (options.minimumConfidence && confidence !== null && confidence < options.minimumConfidence) {
          autoStatus = 'low_confidence';
        }
      } else if (missingSet.has(item.id)) {
        autoStatus = 'missing';
      }

      const manualOverrideApplied = Boolean(item.manualOverrideStatus) && options.respectManualOverrides;
      if (manualOverrideApplied) {
        overridesRespected.push(item.id);
      }

      let finalStatus: ChecklistStatus = item.status;
      if (!manualOverrideApplied) {
        if (autoStatus === 'verified') {
          finalStatus = 'verified';
        } else if (autoStatus === 'missing') {
          finalStatus = 'missing';
        } else {
          finalStatus = 'pending';
        }
      }

      const autoVerifiedAt = autoStatus === 'pending' ? null : timestampIso;

      await this.checklistRepository.updateAutoVerification(item.id, {
        status: manualOverrideApplied ? item.status : finalStatus,
        autoStatus,
        autoConfidence: confidence,
        autoVerifiedAt,
        lastVerificationId: verificationId,
      });

      if (autoStatus === 'wrong_container' || autoStatus === 'low_confidence') {
        mismatchedItems.push(item.id);
        this.logger.warn('Checklist mismatch detected', {
          jobId,
          checklistItemId: item.id,
          autoStatus,
          confidence,
          manualOverrideApplied,
        });
      }

      if (autoStatus === 'missing') {
        // Already tracked through analysis.missingItems
        this.logger.warn('Checklist item missing after vision scan', {
          jobId,
          checklistItemId: item.id,
          manualOverrideApplied,
        });
      }

      updatedItems.push({
        checklistItemId: item.id,
        autoStatus,
        confidence,
        finalStatus: manualOverrideApplied ? item.status : finalStatus,
        manualOverrideApplied,
      });
    }

    const result: LoadVerificationReconciliationResult = {
      jobId,
      verificationId,
      updatedItems,
      mismatchedItems,
      missingItems: analysis.missingItems.map(item => item.checklistItemId),
      overridesRespected,
    };

    this.logger.info('Checklist reconciliation complete', {
      jobId,
      verificationId,
      updatedCount: updatedItems.length,
      mismatchedCount: mismatchedItems.length,
      missingCount: result.missingItems.length,
      overridesRespected: overridesRespected.length,
    });

    return result;
  }
}
