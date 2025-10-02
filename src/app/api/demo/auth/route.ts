import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Set demo authentication cookies
    const response = NextResponse.json({ 
      success: true, 
      message: 'Demo mode activated' 
    });
    
    // Set cookies for demo mode
    response.cookies.set('isDemo', 'true', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax'
    });
    
    response.cookies.set('demoRole', 'supervisor', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax'
    });
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to activate demo mode' },
      { status: 500 }
    );
  }
}