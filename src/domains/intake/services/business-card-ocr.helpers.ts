/**
 * @file src/domains/intake/services/business-card-ocr.helpers.ts
 * @phase 3
 * @domain intake
 * @purpose Helper utilities for parsing and confidence scoring within BusinessCardOcrService.
 * @spec_ref specs/005-field-intelligence-safety/tasks.md#T074
 * @complexity_budget 200 LoC
 * @dependencies
 *   internal:
 *     - @/domains/intake/services/business-card-ocr.types
 * @exports
 *   - defaultContactParser
 *   - normalizeParsedContact
 *   - normalizeVisionResult
 *   - computeConfidence
 *   - clampConfidence
 *   - roundConfidence
 *   - hasMeaningfulContact
 * @voice_considerations
 *   - Helpers maintain consistent scoring so voice feedback remains reliable.
 * END AGENT DIRECTIVE BLOCK
 */

import {
  BusinessCardContactParser,
  ParsedContact,
  VisionBusinessCardExtraction,
} from './business-card-ocr.types';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*\d{3}\s*\)|\d{3})(?:\s*[.-]\s*)?)\d{3}(?:\s*[.-]\s*)\d{4}/;
const ADDRESS_HINT_REGEX = /(Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Suite|Ste\.?)/i;

export function normalizeParsedContact(parsed: ParsedContact): ParsedContact {
  const normalizedPhone = normalizePhone(parsed.data.phone);
  const normalizedEmail = parsed.data.email?.toLowerCase();

  const data = {
    name: parsed.data.name,
    company: parsed.data.company,
    phone: normalizedPhone,
    email: normalizedEmail,
    address: parsed.data.address,
  } as ParsedContact['data'];

  const fieldsPresent = [
    data.name,
    data.company,
    data.phone,
    data.email,
    data.address,
  ].filter(Boolean).length;

  return {
    data,
    rawText: parsed.rawText,
    fieldsPresent,
  };
}

export function normalizeVisionResult(
  result: VisionBusinessCardExtraction | null | undefined
): {
  data: ParsedContact['data'];
  confidence: number;
  hasMeaningfulData: boolean;
} {
  const normalized = normalizeParsedContact({
    data: {
      name: result?.name ?? undefined,
      company: result?.company ?? undefined,
      phone: result?.phone ?? undefined,
      email: result?.email ?? undefined,
      address: result?.address ?? undefined,
    },
    rawText: result?.rawText ?? '',
    fieldsPresent: 0,
  });

  const confidence = clampConfidence(result?.confidence ?? 0.5);

  return {
    data: normalized.data,
    confidence,
    hasMeaningfulData: hasMeaningfulContact(normalized.data),
  };
}

export function computeConfidence(
  baseConfidence: number,
  fieldsPresent: number
): number {
  const coverageScore = Math.min(fieldsPresent / 5, 1);
  const weighted = baseConfidence * 0.7 + coverageScore * 0.3;
  return clampConfidence(weighted);
}

export function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

export function hasMeaningfulContact(data: ParsedContact['data']): boolean {
  return Boolean(data.email || data.phone || (data.name && data.company));
}

export const defaultContactParser: BusinessCardContactParser = {
  parse(text: string): ParsedContact {
    const safeText = text ?? '';
    const trimmed = safeText.trim();
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const emailMatch = trimmed.match(EMAIL_REGEX);
    const phoneMatch = trimmed.match(PHONE_REGEX);

    const name = lines.find((line) =>
      isLikelyName(line, emailMatch?.[0] ?? '', phoneMatch?.[0] ?? '')
    );
    const company = lines
      .filter((line) => line !== name)
      .find((line) => isLikelyCompany(line));
    const address = lines
      .filter((line) => line !== name && line !== company)
      .find((line) => ADDRESS_HINT_REGEX.test(line));

    const fieldsPresent = [
      name,
      company,
      phoneMatch?.[0],
      emailMatch?.[0],
      address,
    ].filter(Boolean).length;

    return {
      data: {
        name,
        company,
        phone: phoneMatch?.[0],
        email: emailMatch?.[0],
        address,
      },
      rawText: trimmed,
      fieldsPresent,
    };
  },
};

function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) {
    return undefined;
  }

  const digits = phone.replace(/[^0-9+]/g, '');

  if (digits.startsWith('+')) {
    return digits;
  }

  const numeric = digits.replace(/\D/g, '');

  if (numeric.length === 11 && numeric.startsWith('1')) {
    return '+' + numeric;
  }

  if (numeric.length === 10) {
    return '+1' + numeric;
  }

  return undefined;
}

function isLikelyName(line: string, email: string, phone: string): boolean {
  if (!line || line.includes('@') || line === email) {
    return false;
  }

  const hasDigits = /\d/.test(line);
  if (hasDigits) {
    return false;
  }

  const words = line.split(/\s+/);
  return words.length <= 4 && words.every((word) => /^[A-Za-z\-'.]+$/.test(word));
}

function isLikelyCompany(line: string): boolean {
  if (!line || line.includes('@')) {
    return false;
  }

  if (/\d/.test(line)) {
    return false;
  }

  const blacklist = ['phone', 'email'];
  return blacklist.every((term) => !line.toLowerCase().includes(term));
}
