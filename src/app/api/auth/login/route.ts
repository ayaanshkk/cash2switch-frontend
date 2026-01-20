// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('🔄 Proxying login to backend:', { email, backend: BACKEND_URL });
    
    // ✅ Call your REAL backend login endpoint
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
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