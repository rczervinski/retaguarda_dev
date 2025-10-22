import { NextRequest, NextResponse } from 'next/server';

// GET /api/produtos/test - Teste simples
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'API de teste funcionando',
    timestamp: new Date().toISOString()
  });
}

// POST /api/produtos/test - Teste simples
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📦 Body de teste recebido:', body);
    
    return NextResponse.json({
      success: true,
      message: 'POST de teste funcionando',
      received: body
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erro no teste' },
      { status: 500 }
    );
  }
}
