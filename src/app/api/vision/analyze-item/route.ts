/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/vision/analyze-item/route.ts
 * phase: 3
 * domain: vision
 * purpose: Simple vision API endpoint for inventory item identification using Gemini
 * spec_ref: 007-mvp-intent-driven/contracts/vision-api.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: none
 * estimated_llm_cost: {
 *   "gemini_vision": "$0.002-0.01 per image"
 * }
 * offline_capability: NONE
 * dependencies: {
 *   internal: ['@/core/errors/error-handler'],
 *   external: ['next/server', '@google/generative-ai'],
 *   supabase: []
 * }
 * exports: ['POST']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'tests/api/vision/analyze-item.test.ts'
 * }
 * tasks: [
 *   'Accept base64 image input',
 *   'Call Gemini Vision API for analysis',
 *   'Return item identification results'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { handleApiError, validationError } from '@/core/errors/error-handler';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, prompt } = body;

    if (!image) {
      return validationError('Image is required');
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({
        analysis: 'Unknown Item',
        message: 'Vision analysis not configured - using fallback'
      });
    }

    // Convert base64 to the format expected by Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: 'image/jpeg'
      }
    };

    const finalPrompt = prompt || 'Identify this item and suggest an appropriate name for inventory tracking. Respond with just the item name.';

    const result = await model.generateContent([finalPrompt, imagePart]);
    const response = await result.response;
    const analysis = response.text();

    return NextResponse.json({
      analysis: analysis.trim(),
      cost: 0.005, // Estimated cost for Gemini Vision
      model: 'gemini-1.5-flash'
    });

  } catch (error) {
    console.error('Vision analysis error:', error);
    
    // Fallback response if vision fails
    return NextResponse.json({
      analysis: 'Equipment Item',
      message: 'Vision analysis failed - using fallback',
      fallback: true
    });
  }
}