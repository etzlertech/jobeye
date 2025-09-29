# Task: Cloud OCR Provider Adapter

**Slug:** `ocr-007-cloud-ocr-adapter`
**Priority:** High
**Size:** 1 PR

## Description
Create unified adapter for cloud OCR providers (AWS Textract, Google Vision) with cost tracking and fallback.

## Files to Create
- `src/domains/ocr/services/cloud-ocr-adapter.ts`
- `src/domains/ocr/providers/textract-provider.ts`
- `src/domains/ocr/providers/google-vision-provider.ts`
- `src/domains/ocr/types/cloud-ocr-types.ts`

## Files to Modify
- `.env.example` - Add provider API keys

## Acceptance Criteria
- [ ] Unified interface for all providers
- [ ] AWS Textract for forms/tables
- [ ] Google Vision for general text
- [ ] Cost estimation before API call
- [ ] Budget check via company settings
- [ ] Automatic provider failover
- [ ] Response normalization
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/cloud-ocr-adapter.test.ts`

Test cases:
- `selects appropriate provider`
  - Invoice → Textract
  - Receipt → Google Vision
  - Assert correct provider used
  
- `enforces budget limits`
  - Set budget to $0.10
  - Estimate cost $0.15
  - Assert request blocked
  
- `fails over to alternate provider`
  - Mock Textract failure
  - Assert tries Google Vision
  - Assert result returned
  
- `normalizes responses`
  - Process with each provider
  - Assert same output format

## Dependencies
- `ocr-004-company-settings-ocr` - Budget limits
- Cost tracking service
- External: AWS SDK, Google Cloud Vision

## Provider Interface
```typescript
interface CloudOcrProvider {
  name: string;
  processImage(image: Buffer, options: OcrOptions): Promise<OcrResult>;
  estimateCost(image: Buffer): number;
  isAvailable(): Promise<boolean>;
}

interface OcrResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
  tables?: Table[];
  metadata: {
    provider: string;
    processingTime: number;
    cost: number;
  };
}
```

## Environment Variables
```
# AWS Textract
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Google Vision
GOOGLE_CLOUD_PROJECT=xxx
GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
```

## Rollback
- Disable cloud OCR via feature flag
- Fall back to local only