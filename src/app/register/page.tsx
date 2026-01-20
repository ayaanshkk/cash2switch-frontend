'use client';

import { useState, useEffect } from 'react';
import { Command, Terminal, Eye, EyeOff } from "lucide-react";

export default function RegisterV1() {
  return (
    <div className="flex h-dvh">
      <div className="bg-background flex w-full items-center justify-center p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-medium tracking-tight text-3xl">
                Account Registration
            </div>
            <div className="text-muted-foreground mx-auto max-w-xl">
              <InviteRegistrationForm />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-primary hidden lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Command className="text-primary-foreground mx-auto size-12" />
            <div className="space-y-2">
              <h1 className="text-primary-foreground text-5xl font-light">Welcome!</h1>
              <p className="text-primary-foreground/80 text-xl">You&apos;re in the right place.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteRegistrationForm() {
    const [token, setToken] = useState<string | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [error, setError] = useState('');
    const [inviteValid, setInviteValid] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        setToken(urlToken);

        if (!urlToken) {
            setInviteValid(false);
            setLoading(false);
            return;
        }

        validateToken(urlToken);
    }, []);

    const validateToken = async (urlToken: string) => {
        // ✅ FIXED: Use correct backend endpoint
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
        const validationUrl = `${BACKEND_URL}/auth/validate-invitation`;

        try {
            const response = await fetch(validationUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ invitation_token: urlToken }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setInviteValid(true);
                setInviteEmail(data.user.email);
                setFirstName(data.user.first_name);
                setLastName(data.user.last_name);
                setInviteRole(data.user.role || 'Staff');
            } else {
                setError(data.error || 'Invalid or expired invitation link. Please contact HR or Manager.');
            }
        } catch (err) {
            console.error('Validation error:', err);
            setError('Failed to validate invite token. Check your network connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setRegistering(true);
        
        // ✅ FIXED: Use correct backend endpoint
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
        const registerUrl = `${BACKEND_URL}/auth/register`;

        try {
            const response = await fetch(registerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    invitation_token: token,
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Successful registration, save auth token and redirect
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Get base path from environment
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                window.location.assign(`${basePath}/`);
            } else {
                setError(data.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            console.error('Registration error:', err);
            setError('Registration failed due to a network error.');
        } finally {
            setRegistering(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="text-xl text-gray-600 animate-pulse">
                    Validating invitation link...
                </div>
            </div>
        );
    }
   
    if (token && !inviteValid) {
        return (
            <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-700 space-y-2">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <h3 className="font-bold">Invalid Invitation</h3>
                </div>
                <p className="text-sm">
                    {error || 'This invitation link is invalid, expired, or has already been used.'}
                </p>
                <button
                    onClick={() => {
                        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                        window.location.assign(`${basePath}/login`);
                    }}
                    className="text-sm underline hover:text-red-900"
                >
                    Go to Login
                </button>
            </div>
        );
    }

    if (!token || !inviteValid) {
        return (
            <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg text-yellow-800 space-y-2">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <h3 className="font-bold">Registration by Invitation Only</h3>
                </div>
                <p className="text-sm">
                    Access to this system requires a registration link provided by a Manager or HR.
                    If you were expecting an invite, please check your email or contact your administrator.
                </p>
                <button
                    onClick={() => {
                        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                        window.location.assign(`${basePath}/login`);
                    }}
                    className="text-sm underline hover:text-yellow-900"
                >
                    Go to Login
                </button>
            </div>
        );
    }

    // Main Registration Form (Token is valid)
    return (
        <div className="space-y-6">
            <div className="mb-4 p-4 bg-blue-100 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800">
                    You are completing registration for:
                </p>
                <p className="text-lg font-bold text-blue-900 mt-1">
                    {firstName} {lastName}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                    {inviteEmail} • {inviteRole}
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-300">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password Input with Toggle */}
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="New Password (min 8 characters)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pr-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                </div>

                {/* Confirm Password Input with Toggle */}
                <div className="relative">
                    <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full pr-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                </div>
               
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    disabled={registering}
                >
                    {registering ? 'Creating Account...' : 'Complete Registration & Login'}
                </button>
            </form>
            
            <div className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                    onClick={() => {
                        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                        window.location.assign(`${basePath}/login`);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                >
                    Login here
                </button>
            </div>
        </div>
    );
}