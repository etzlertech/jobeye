import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';
import { withDeveloperAuth, createErrorResponse, AuthUser } from '../middleware';

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  return withDeveloperAuth(request, async (req, user: AuthUser) => {

    console.log('Executing report:progress script...');
    
    try {
      const { stdout, stderr } = await execAsync('npm run report:progress', {
        cwd: process.cwd(),
        timeout: 30000,
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

    const manifestPath = path.join(process.cwd(), 'PROGRESS_MANIFEST.md');
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

    const { data, error } = await supabase
      .from('dev_manifest_history')
      .insert({
        manifest_content: manifestContent,
        file_count: fileCount,
        generated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json(
        { error: 'Failed to save manifest to database', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      manifest: {
        id: data.id,
        content: manifestContent,
        fileCount: fileCount,
        createdAt: data.created_at,
      },
    });
  });
}

export async function GET(request: NextRequest) {
  return withDeveloperAuth(request, async (req, user: AuthUser) => {

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