import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🆕 API /api/produtos-final GET chamada');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  return NextResponse.json({
    success: true,
    message: 'API produtos-final funcionando!',
    timestamp: new Date().toISOString(),
    version: 'final'
  });
}
