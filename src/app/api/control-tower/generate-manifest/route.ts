import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';
import { withDeveloperAuth, createErrorResponse, AuthUser } from '../middleware';

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Only create client if variables are present (for runtime)
// During build, these might not be available
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function POST(request: NextRequest) {
  // In development mode, bypass authentication for easier testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Function to handle the manifest generation logic
  const generateManifest = async (userId?: string) => {
    console.log('Executing report:progress script...');
    
    try {
      // Check if we're in a development environment with source code access
      const hasSourceAccess = require('fs').existsSync(path.join(process.cwd(), 'src'));
      
      if (!hasSourceAccess) {
        return NextResponse.json(
          { error: 'Manifest generation requires source code access' },
          { status: 400 }
        );
      }
      
      // Use detailed manifest for proper Architecture-as-Code tracking
      const { stdout, stderr } = await execAsync('npm run report:detailed', {
        cwd: process.cwd(),
        timeout: 30000,
        env: { ...process.env, NODE_ENV: 'development' }
      });

      if (stderr && !stderr.includes('warning')) {
        console.error('Script stderr:', stderr);
      }

      console.log('Script output:', stdout);
    } catch (execError: any) {
      console.error('Script execution error:', execError);
      
      if (execError.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Script not found. Please ensure report:progress script is defined in package.json' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to execute manifest generation script: ${execError.message}` },
        { status: 500 }
      );
    }

    // Look for detailed manifest first, fall back to simple one
    let manifestPath = path.join(process.cwd(), 'DETAILED_PROGRESS_MANIFEST.md');
    const fs = require('fs');
    if (!fs.existsSync(manifestPath)) {
      manifestPath = path.join(process.cwd(), 'PROGRESS_MANIFEST.md');
    }
    let manifestContent: string;
    let fileCount = 0;

    try {
      manifestContent = await readFile(manifestPath, 'utf-8');
      
      const fileCountMatch = manifestContent.match(/Total Files[:\s]+(\d+)/i);
      if (fileCountMatch) {
        fileCount = parseInt(fileCountMatch[1], 10);
      }
    } catch (readError: any) {
      console.error('Error reading manifest file:', readError);
      
      manifestContent = `# Progress Manifest
Generated at: ${new Date().toISOString()}

## Error
The manifest generation script ran but did not produce a PROGRESS_MANIFEST.md file.
Please check the report:progress script configuration.`;
      
      fileCount = 0;
    }

    // If we have Supabase configured and a user ID, save to database
    if (supabase && userId) {
      const { data, error } = await supabase
        .from('dev_manifest_history')
        .insert({
          manifest_content: manifestContent,
          file_count: fileCount,
          generated_by: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        // Continue anyway - we have the manifest even if DB save fails
      }

      if (data) {
        return NextResponse.json({
          success: true,
          manifest: {
            id: data.id,
            content: manifestContent,
            fileCount: fileCount,
            createdAt: data.created_at,
          },
        });
      }
    }

    // Return manifest without database ID (development mode or DB not configured)
    return NextResponse.json({
      success: true,
      manifest: {
        id: `local-${Date.now()}`,
        content: manifestContent,
        fileCount: fileCount,
        createdAt: new Date().toISOString(),
      },
    });
  };

  // In development mode, bypass authentication
  if (isDevelopment) {
    console.log('Running in development mode - bypassing authentication');
    return generateManifest();
  }
  
  // In production mode, use authentication
  return withDeveloperAuth(request, async (req, user: AuthUser) => {
    // Check if Supabase client is available
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.' },
        { status: 500 }
      );
    }
    
    return generateManifest(user.id);
  });
}

export async function GET(request: NextRequest) {
  return withDeveloperAuth(request, async (req, user: AuthUser) => {
    
    // Check if Supabase client is available
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const { data, error, count } = await supabase
      .from('dev_manifest_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch manifest history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      manifests: data,
      total: count,
      limit,
      offset,
    });
  });
}