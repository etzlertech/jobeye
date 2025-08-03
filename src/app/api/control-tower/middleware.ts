import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthUser {
  id: string;
  email?: string;
  isDeveloper: boolean;
}

export async function validateDeveloperAccess(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    const isDeveloper = user.user_metadata?.is_developer === true || 
                       user.app_metadata?.is_developer === true ||
                       user.role === 'developer';
    
    if (!isDeveloper) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      isDeveloper: true,
    };
  } catch (error) {
    console.error('Auth validation error:', error);
    return null;
  }
}

export function createUnauthorizedResponse(message: string = 'Unauthorized. Developer role required.'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

export function createErrorResponse(message: string, status: number = 500): NextResponse {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function withDeveloperAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await validateDeveloperAccess(request);
  
  if (!user) {
    return createUnauthorizedResponse();
  }

  try {
    return await handler(request, user);
  } catch (error: any) {
    console.error('Handler error:', error);
    return createErrorResponse('Internal server error');
  }
}