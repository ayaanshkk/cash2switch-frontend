"use client";
import Image from "next/image";
import { Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  const [inviteInfo, setInviteInfo] = useState<{
    employee_name: string;
    username: string;
    email: string | null;
    role: string;
  } | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    if (!token) { setInvalidToken(true); setIsValidating(false); return; }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/invite/validate/${token}`);
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setInvalidToken(true);
        setError(data.error || "Invalid or expired invite link");
      } else {
        setInviteInfo(data);
      }
    } catch {
      setInvalidToken(true);
      setError("Could not connect to server");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!password) return setError("Password is required");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set password");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRight = () => {
    if (isValidating) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Validating invite link...</p>
        </div>
      );
    }

    if (invalidToken) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-400" />
          <h1 className="text-2xl font-medium">Invalid Invite Link</h1>
          <p className="text-muted-foreground text-sm">
            {error || "This invite link is invalid or has already been used."}
          </p>
          <Button onClick={() => router.push("/login")} className="mt-2">
            Go to Login
          </Button>
        </div>
      );
    }

    if (success) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h1 className="text-2xl font-medium">Password Set!</h1>
          <p className="text-muted-foreground text-sm">
            Redirecting you to login...
          </p>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">Welcome, {inviteInfo?.employee_name}!</h1>
          <p className="text-muted-foreground text-sm">
            You've been invited as <strong>{inviteInfo?.role}</strong>. Set your password to get started.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={inviteInfo?.username || ""} readOnly className="bg-muted" />
            <p className="text-xs text-muted-foreground">Use this to log in</p>
          </div>

          <div className="space-y-2">
            <Label>Password <span className="text-red-500">*</span></Label>
            <Input
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Confirm Password <span className="text-red-500">*</span></Label>
            <Input
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting password...</>
            ) : (
              "Set Password & Activate Account"
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-dvh">
      {/* Left Panel */}
      <div className="bg-primary hidden lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Image
              src="/images/cash2switch.png"
              alt="Logo"
              width={80}
              height={80}
              className="mx-auto"
            />
            <div className="space-y-2">
              <h1 className="text-primary-foreground text-5xl font-light">
                Activate Account
              </h1>
              <p className="text-primary-foreground/80 text-xl">
                Set your password to get started
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="bg-background relative flex w-full items-center justify-center p-8 lg:w-2/3">
        {renderRight()}

        {/* Footer */}
        <div className="absolute bottom-5 flex w-full justify-between px-10">
          <div className="text-sm">{APP_CONFIG.copyright}</div>
          <div className="flex items-center gap-1 text-sm">
            <Globe className="text-muted-foreground size-4" />
            ENG
          </div>
        </div>
      </div>
    </div>
  );
}