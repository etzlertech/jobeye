import { Logger } from '@/core/logger/logger';
import { LoadVerificationAnalysis } from '@/domains/vision/types/load-verification-types';
import { LoadVerificationReconciliationResult } from '@/domains/vision/services/load-verification-reconciler';

export interface TelemetryCaptureParams {
  jobId: string;
  verificationId: string;
  analysis: LoadVerificationAnalysis;
  reconciliation: LoadVerificationReconciliationResult;
  frameIndex?: number;
  frameTimestamp?: string;
}

export class LoadVerificationTelemetry {
  constructor(private readonly logger: Logger = new Logger('load-verification-telemetry')) {}

  capture(params: TelemetryCaptureParams) {
    const { analysis, reconciliation } = params;

    const confidenceValues = analysis.verifiedItems
      .map(item => item.confidence)
      .filter((value): value is number => typeof value === 'number');

    const avgConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null;

    const lowConfidenceItems = analysis.verifiedItems.filter(item => item.status === 'low_confidence');
    const wrongContainerItems = analysis.verifiedItems.filter(item => item.status === 'wrong_container');

    this.logger.info('Load verification telemetry', {
      jobId: params.jobId,
      verificationId: params.verificationId,
      frameIndex: params.frameIndex,
      frameTimestamp: params.frameTimestamp,
      verifiedCount: analysis.verifiedItems.length,
      missingCount: analysis.missingItems.length,
      unexpectedCount: analysis.unexpectedItems.length,
      mismatchedCount: reconciliation.mismatchedItems.length,
      overridesRespected: reconciliation.overridesRespected.length,
      lowConfidenceCount: lowConfidenceItems.length,
      wrongContainerCount: wrongContainerItems.length,
      averageConfidence: avgConfidence,
      minConfidence: confidenceValues.length ? Math.min(...confidenceValues) : null,
      maxConfidence: confidenceValues.length ? Math.max(...confidenceValues) : null,
    });
  }
}

export function createLoadVerificationTelemetry(logger?: Logger) {
  return new LoadVerificationTelemetry(logger);
}
