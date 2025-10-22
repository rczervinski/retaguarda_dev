import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 TESTE API /api/produtos-teste chamada:', new Date().toISOString());
  
  return NextResponse.json({
    success: true,
    message: 'API teste funcionando!',
    timestamp: new Date().toISOString()
  });
}
