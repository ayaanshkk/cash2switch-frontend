"use client";
import Image from "next/image";
import { Globe } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { LoginForm } from "../(main)/auth/_components/login-form";

export default function LoginV2Enhanced() {
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
              <h1 className="text-primary-foreground text-5xl font-light">Hello again</h1>
              <p className="text-primary-foreground/80 text-xl">Login to continue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="bg-background relative flex w-full items-center justify-center p-8 lg:w-2/3">
        <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-medium">Login to your account</h1>
            <p className="text-muted-foreground text-sm">Please enter your details to login.</p>
          </div>

          <div className="space-y-4">
            <LoginForm />
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