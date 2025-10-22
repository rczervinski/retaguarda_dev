import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'API funcionando',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
}
