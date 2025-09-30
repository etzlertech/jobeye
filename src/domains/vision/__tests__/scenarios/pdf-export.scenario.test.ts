/**
 * @file /src/domains/vision/__tests__/scenarios/pdf-export.scenario.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose End-to-end scenario tests for PDF export feature
 * @test_coverage Full scenario coverage
 */

import { getPDFExportService } from '../../services/pdf-export.service';

// Mock DOM APIs
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockOpen = jest.fn();
const mockWrite = jest.fn();
const mockClose = jest.fn();

(global as any).document = {
  createElement: mockCreateElement,
  body: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild
  }
};

describe('PDF Export - End-to-End Scenarios', () => {
  let pdfService: ReturnType<typeof getPDFExportService>;
  let mockIframe: any;
  let mockDoc: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock iframe
    mockDoc = {
      open: mockOpen,
      write: mockWrite,
      close: mockClose
    };

    mockIframe = {
      style: {},
      contentDocument: mockDoc,
      contentWindow: { document: mockDoc }
    };

    mockCreateElement.mockReturnValue(mockIframe);

    pdfService = getPDFExportService();
  });

  describe('Scenario 1: Export complete verification report', () => {
    it('should generate HTML report with all verification details', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-123',
        kitId: 'kit-456',
        companyId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.95,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.98, matchStatus: 'matched' as const },
          { itemType: 'hammer', confidence: 0.92, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 245
      };

      // Act
      const blob = await pdfService.generateReport(verification, {
        includeTimestamp: true,
        includeCompanyLogo: false
      });

      // Assert
      expect(blob).toBeDefined();
      expect(blob.type).toBe('text/html');
      expect(mockOpen).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();

      // Verify HTML content
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('Kit Verification Report');
      expect(htmlContent).toContain('ver-123');
      expect(htmlContent).toContain('kit-456');
      expect(htmlContent).toContain('complete');
      expect(htmlContent).toContain('wrench');
      expect(htmlContent).toContain('hammer');
      expect(htmlContent).toContain('95.0%'); // confidence
      expect(htmlContent).toContain('245ms'); // processing time
    });
  });

  describe('Scenario 2: Export incomplete verification with missing items', () => {
    it('should highlight missing items in report', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-124',
        kitId: 'kit-457',
        companyId: 'company-789',
        verificationResult: 'incomplete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.72,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.88, matchStatus: 'matched' as const }
        ],
        missingItems: ['hammer', 'screwdriver'],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 198
      };

      // Act
      const blob = await pdfService.generateReport(verification);

      // Assert
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('incomplete');
      expect(htmlContent).toContain('Missing Items');
      expect(htmlContent).toContain('hammer');
      expect(htmlContent).toContain('screwdriver');
    });
  });

  describe('Scenario 3: Export with unexpected items', () => {
    it('should include unexpected items section', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-125',
        kitId: 'kit-458',
        companyId: 'company-789',
        verificationResult: 'incomplete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.81,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.95, matchStatus: 'matched' as const },
          { itemType: 'tape', confidence: 0.87, matchStatus: 'unmatched' as const }
        ],
        missingItems: [],
        unexpectedItems: ['tape'],
        costUsd: 0,
        processingTimeMs: 212
      };

      // Act
      const blob = await pdfService.generateReport(verification);

      // Assert
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('Unexpected Items');
      expect(htmlContent).toContain('tape');
    });
  });

  describe('Scenario 4: Export VLM verification with costs', () => {
    it('should include cost information for VLM processing', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-126',
        kitId: 'kit-459',
        companyId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'cloud_vlm' as const,
        confidenceScore: 0.97,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.98, matchStatus: 'matched' as const },
          { itemType: 'hammer', confidence: 0.96, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0.03,
        processingTimeMs: 1245
      };

      // Act
      const blob = await pdfService.generateReport(verification);

      // Assert
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('$0.03');
      expect(htmlContent).toContain('cloud_vlm');
    });
  });

  describe('Scenario 5: Export with company logo', () => {
    it('should include company logo when provided', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-127',
        kitId: 'kit-460',
        companyId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.93,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.93, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 189
      };

      // Act
      const blob = await pdfService.generateReport(verification, {
        includeCompanyLogo: true,
        logoUrl: 'https://example.com/logo.png'
      });

      // Assert
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('<img');
      expect(htmlContent).toContain('https://example.com/logo.png');
    });
  });

  describe('Scenario 6: Download PDF functionality', () => {
    it('should trigger browser download with correct filename', () => {
      // Arrange
      const mockBlob = new Blob(['test'], { type: 'text/html' });
      const mockUrl = 'blob:mock-url';
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn()
      };

      global.URL = {
        createObjectURL: jest.fn().mockReturnValue(mockUrl),
        revokeObjectURL: jest.fn()
      } as any;

      mockCreateElement.mockReturnValue(mockAnchor);

      // Act
      pdfService.downloadPDF(mockBlob, 'verification-kit-456-2025-01-01.html');

      // Assert
      expect(mockAnchor.href).toBe(mockUrl);
      expect(mockAnchor.download).toBe('verification-kit-456-2025-01-01.html');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });
  });

  describe('Scenario 7: Export failed verification', () => {
    it('should generate report for failed verification', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-128',
        kitId: 'kit-461',
        companyId: 'company-789',
        verificationResult: 'failed' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.35,
        detectedItems: [],
        missingItems: ['wrench', 'hammer', 'screwdriver', 'pliers'],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 167
      };

      // Act
      const blob = await pdfService.generateReport(verification);

      // Assert
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('failed');
      expect(htmlContent).toContain('Missing Items');
      expect(htmlContent).toContain('wrench');
      expect(htmlContent).toContain('4'); // Count of missing items
    });
  });

  describe('Scenario 8: Export with multiple detected items', () => {
    it('should generate table for all detected items', async () => {
      // Arrange
      const verification = {
        verificationId: 'ver-129',
        kitId: 'kit-462',
        companyId: 'company-789',
        verificationResult: 'complete' as const,
        processingMethod: 'local_yolo' as const,
        confidenceScore: 0.91,
        detectedItems: [
          { itemType: 'wrench', confidence: 0.95, matchStatus: 'matched' as const },
          { itemType: 'hammer', confidence: 0.92, matchStatus: 'matched' as const },
          { itemType: 'screwdriver', confidence: 0.88, matchStatus: 'matched' as const },
          { itemType: 'pliers', confidence: 0.89, matchStatus: 'matched' as const },
          { itemType: 'drill', confidence: 0.94, matchStatus: 'matched' as const }
        ],
        missingItems: [],
        unexpectedItems: [],
        costUsd: 0,
        processingTimeMs: 312
      };

      // Act
      const blob = await pdfService.generateReport(verification);

      // Assert
      const htmlContent = mockWrite.mock.calls[0][0];
      expect(htmlContent).toContain('<table');
      expect(htmlContent).toContain('wrench');
      expect(htmlContent).toContain('hammer');
      expect(htmlContent).toContain('screwdriver');
      expect(htmlContent).toContain('pliers');
      expect(htmlContent).toContain('drill');
      expect(htmlContent).toContain('95.0%');
      expect(htmlContent).toContain('92.0%');
    });
  });
});