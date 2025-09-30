import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'Implemented' }, { status: 201 });
}
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Implemented' });
}
