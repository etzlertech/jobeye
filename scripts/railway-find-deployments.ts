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

async function queryRailway(query: string, variables: any = {}) {
  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_TOKEN}`
    },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json() as any;
  return result;
}

async function findDeployments() {
  console.log('🔍 Searching for deployments...\n');

  // Try to get deployments using a different query structure
  const query = `
    query {
      deployments(first: 10) {
        edges {
          node {
            id
            status
            createdAt
            projectId
            environmentId
            meta {
              repo
              branch
              commitHash
              commitMessage
            }
          }
        }
      }
    }
  `;

  const result = await queryRailway(query);
  
  if (result.errors) {
    console.log('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
    
    // Try an alternative query
    console.log('\n🔄 Trying alternative query...\n');
    
    const altQuery = `
      query {
        viewer {
          id
          email
        }
      }
    `;
    
    const altResult = await queryRailway(altQuery);
    console.log('Alternative result:', JSON.stringify(altResult, null, 2));
  } else if (result.data?.deployments) {
    const deployments = result.data.deployments.edges || [];
    
    if (deployments.length === 0) {
      console.log('No deployments found.');
      return;
    }

    console.log(`Found ${deployments.length} deployments:\n`);
    
    for (const edge of deployments) {
      const dep = edge.node;
      const statusEmoji = dep.status === 'SUCCESS' ? '✅' : 
                        dep.status === 'FAILED' ? '❌' : 
                        dep.status === 'BUILDING' ? '🔨' : '⏳';
      
      console.log(`${statusEmoji} Deployment: ${dep.id}`);
      console.log(`   Status: ${dep.status}`);
      console.log(`   Created: ${new Date(dep.createdAt).toLocaleString()}`);
      if (dep.meta?.commitMessage) {
        console.log(`   Commit: ${dep.meta.commitMessage.split('\n')[0]}`);
      }
      console.log('');
    }
  }
}

// Also try to get deployment by partial ID
async function findDeploymentByPartialId(partialId: string) {
  console.log(`\n🔎 Searching for deployment containing: ${partialId}\n`);
  
  // This is a bit of a hack - we'll try different full IDs based on the partial
  const possibleIds = [
    partialId,
    `${partialId}-0000-0000-0000-000000000000`,
    `00000000-${partialId}-0000-000000000000`,
  ];
  
  for (const id of possibleIds) {
    const query = `
      query GetDeployment($id: String!) {
        deployment(id: $id) {
          id
          status
          createdAt
        }
      }
    `;
    
    const result = await queryRailway(query, { id });
    
    if (result.data?.deployment) {
      console.log('✅ Found deployment!');
      console.log(`   Full ID: ${result.data.deployment.id}`);
      console.log(`   Status: ${result.data.deployment.status}`);
      return result.data.deployment;
    }
  }
  
  console.log('❌ Could not find deployment with that partial ID');
}

// Main
findDeployments().then(() => {
  const partialId = process.argv[2];
  if (partialId) {
    return findDeploymentByPartialId(partialId);
  }
}).catch(console.error);