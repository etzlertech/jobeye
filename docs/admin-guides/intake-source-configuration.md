# Intake Source Configuration Guide

**Version**: 1.0  
**Last Updated**: 2025-09-30  
**Audience**: Marketing managers and administrators

## Intake Sources

### Creating Sources
1. Settings > Intake > Sources > Add Source
2. Name (e.g., "Google Ads", "Referral", "Website Form")
3. Type (web, phone, email, referral, other)
4. Tracking URL parameters (optional)

### Lead Scoring
Automatic scoring (0-100) based on:
- Service type requested (high-value services score higher)
- Property size (larger = higher)
- Urgency indicators
- Time of day submitted
- Source quality (historical conversion rate)

### Duplicate Detection
- Threshold: 80% similarity (adjustable)
- Checks: Name, address, phone
- Levenshtein distance algorithm
- Adjust in Settings > Intake > Duplicate Threshold

## OCR Configuration

### GPT-4 Vision Setup
1. OpenAI API key required
2. Settings > Integrations > OpenAI
3. Budget cap (e.g., $100/month)
4. Cost: ~$0.01/request

### Supported Documents
- Service request forms
- Property diagrams
- Contracts
- Handwritten notes

## Analytics

Track performance by source:
- Conversion rate
- Average lead score
- Time to conversion
- Cost per lead (if tracked)

Settings > Intake > Analytics

---
**Document Version**: 1.0
