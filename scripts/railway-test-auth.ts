#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

if (!RAILWAY_TOKEN) {
  console.error('❌ RAILWAY_TOKEN not found in .env.local');
  process.exit(1);
}

console.log('🔐 Testing Railway API authentication...\n');
console.log(`Token: ${RAILWAY_TOKEN.substring(0, 10)}...${RAILWAY_TOKEN.substring(-4)}`);
console.log(`API URL: ${RAILWAY_API_URL}\n`);

async function testAuth() {
  // Try the simplest possible query
  const query = `
    query {
      me {
        id
        email
      }
    }
  `;

  console.log('Sending query:', query);

  try {
    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_TOKEN}`
      },
      body: JSON.stringify({ query })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());

    const text = await response.text();
    console.log('\nRaw response:', text);

    try {
      const json = JSON.parse(text);
      console.log('\nParsed response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Failed to parse as JSON');
    }

  } catch (error) {
    console.error('Request failed:', error);
  }
}

testAuth();