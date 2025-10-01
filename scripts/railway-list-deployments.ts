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
  
  if (result.errors) {
    console.error('GraphQL Errors:', JSON.stringify(result.errors, null, 2));
  }

  return result;
}

async function listProjects() {
  console.log('🔍 Fetching Railway projects...\n');

  const query = `
    query {
      me {
        id
        email
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              environments {
                edges {
                  node {
                    id
                    name
                    deployments(first: 5) {
                      edges {
                        node {
                          id
                          status
                          createdAt
                          staticUrl
                          meta {
                            commitHash
                            commitMessage
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await queryRailway(query);
  
  if (!result.data?.me) {
    console.error('❌ Could not fetch user data. Check if the token is valid.');
    return;
  }

  console.log(`👤 Logged in as: ${result.data.me.email}\n`);

  const projects = result.data.me.projects?.edges || [];
  
  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  for (const projectEdge of projects) {
    const project = projectEdge.node;
    console.log(`📁 Project: ${project.name}`);
    console.log(`   ID: ${project.id}`);
    if (project.description) {
      console.log(`   Description: ${project.description}`);
    }
    console.log('');

    const environments = project.environments?.edges || [];
    
    for (const envEdge of environments) {
      const env = envEdge.node;
      console.log(`  🌍 Environment: ${env.name}`);
      console.log(`     ID: ${env.id}`);
      
      const deployments = env.deployments?.edges || [];
      
      if (deployments.length > 0) {
        console.log('     Recent deployments:');
        
        for (const depEdge of deployments) {
          const dep = depEdge.node;
          const statusEmoji = dep.status === 'SUCCESS' ? '✅' : 
                            dep.status === 'FAILED' ? '❌' : 
                            dep.status === 'BUILDING' ? '🔨' : '⏳';
          
          console.log(`       ${statusEmoji} ${dep.id.substring(0, 8)}... - ${dep.status}`);
          console.log(`          Created: ${new Date(dep.createdAt).toLocaleString()}`);
          if (dep.meta?.commitMessage) {
            console.log(`          Commit: ${dep.meta.commitMessage.split('\n')[0]}`);
          }
          if (dep.staticUrl) {
            console.log(`          URL: ${dep.staticUrl}`);
          }
        }
      } else {
        console.log('     No recent deployments');
      }
      console.log('');
    }
  }
}

async function getLatestFailedDeployment() {
  const query = `
    query {
      me {
        projects {
          edges {
            node {
              id
              name
              environments {
                edges {
                  node {
                    id
                    name
                    deployments(first: 10) {
                      edges {
                        node {
                          id
                          status
                          createdAt
                          meta {
                            commitHash
                            commitMessage
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await queryRailway(query);
  
  if (!result.data?.me) {
    return null;
  }

  // Find the most recent failed deployment
  let latestFailed = null;
  let latestFailedTime = 0;

  for (const projectEdge of result.data.me.projects.edges) {
    for (const envEdge of projectEdge.node.environments.edges) {
      for (const depEdge of envEdge.node.deployments.edges) {
        const dep = depEdge.node;
        if (dep.status === 'FAILED' || dep.status === 'CRASHED') {
          const depTime = new Date(dep.createdAt).getTime();
          if (depTime > latestFailedTime) {
            latestFailedTime = depTime;
            latestFailed = {
              deployment: dep,
              project: projectEdge.node,
              environment: envEdge.node
            };
          }
        }
      }
    }
  }

  return latestFailed;
}

// Main
const command = process.argv[2];

switch (command) {
  case 'failed':
    getLatestFailedDeployment().then(result => {
      if (result) {
        console.log('\n❌ Most recent failed deployment:');
        console.log(`   Project: ${result.project.name}`);
        console.log(`   Environment: ${result.environment.name}`);
        console.log(`   Deployment ID: ${result.deployment.id}`);
        console.log(`   Time: ${new Date(result.deployment.createdAt).toLocaleString()}`);
        if (result.deployment.meta?.commitMessage) {
          console.log(`   Commit: ${result.deployment.meta.commitMessage.split('\n')[0]}`);
        }
        console.log('\nTo view logs:');
        console.log(`   npm run railway:monitor ${result.deployment.id}`);
      } else {
        console.log('No failed deployments found.');
      }
    });
    break;

  default:
    listProjects().catch(console.error);
}