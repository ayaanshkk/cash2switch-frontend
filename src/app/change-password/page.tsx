"use client";
import Image from "next/image";
import Link from "next/link";
import { Globe, ArrowLeft } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function ChangePasswordPage() {
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
              <h1 className="text-primary-foreground text-5xl font-light">Reset Password</h1>
              <p className="text-primary-foreground/80 text-xl">Create a new password</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="bg-background relative flex w-full items-center justify-center p-8 lg:w-2/3">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
          {/* Back to Login Link */}
          <Link 
            href="/login" 
            className="flex items-center gap-2 text-sm text-black hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>

          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-medium">Change Password</h1>
            <p className="text-muted-foreground text-sm">
              Enter your username and new password
            </p>
          </div>

          <div className="space-y-4">
            <ChangePasswordForm />
          </div>
        </div>

        {/* Bottom Footer */}
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