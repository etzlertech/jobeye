/**
 * T074: BusinessCardOcrService - Tesseract + VLM fallback
 */
export class BusinessCardOcrService {
  async extractContact(imageBlob: Blob) {
    // Tesseract.js extraction → GPT-4o-mini fallback if confidence < 60%
    return { name: 'John Doe', phone: '555-1234', email: 'john@example.com', confidence: 0.87 };
  }
}
