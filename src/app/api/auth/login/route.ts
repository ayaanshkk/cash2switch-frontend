// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username || body.email; // accept legacy email if sent
    const password = body.password;
    // Only forward tenant_id when client sent it — backend rejects wrong tenant as 403.
    const tenant_id = body.tenant_id;
    
    console.log('🔄 Proxying login to backend:', { username, tenant_id, backend: BACKEND_URL });
    
    const backendBody: Record<string, unknown> = { username, password };
    if (tenant_id !== undefined && tenant_id !== null && tenant_id !== "") {
      backendBody.tenant_id = tenant_id;
    }

    // ✅ Call your REAL backend login endpoint
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendBody),
    });

    console.log('📡 Backend response status:', response.status);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Failed to parse backend response:', e);
      return NextResponse.json(
        { success: false, error: 'Backend returned invalid response' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.log('❌ Backend login failed:', data);
      return NextResponse.json(
        { success: false, error: data.error || data.message || 'Login failed' },
        { status: response.status }
      );
    }

    console.log('✅ Backend login successful');

    // ✅ Return REAL token and user from backend
    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      token: data.token || data.access_token,  // Backend might use different key names
      user: data.user,
    }, { status: 200 });

  } catch (error: any) {
    console.error('🚨 Login proxy error:', error);
    
    // Handle network errors
    if (error.message.includes('fetch')) {
      return NextResponse.json(
        { success: false, error: 'Cannot connect to backend server. Please try again.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Login failed due to server error' },
      { status: 500 }
    );
  }
}

export const GET = () => NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });