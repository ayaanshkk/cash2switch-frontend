// /Users/razataiab/Desktop/next-shadcn-admin-dashboard/src/app/(main)/dashboard/_components/sidebar/account-switcher.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BadgeCheck, Bell, CreditCard, LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/contexts/AuthContext";

export function AccountSwitcher() {
  const currentUser = useCurrentUser();
  const { logout } = useAuth();
  const router = useRouter();

  const [activeUser, setActiveUser] = useState(() =>
    currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar,
          role: currentUser.role,
        }
      : null,
  );
  const [loading, setLoading] = useState(false);

  if (!currentUser || !activeUser) return null;

  const user = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    avatar: currentUser.avatar,
    role: currentUser.role,
  };

  const handleLogout = async () => {
    console.log("🖱️ Logout button clicked");
    setLoading(true);
    try {
      console.log("🔄 Calling logout from AuthContext...");
      await logout();
      console.log("✅ Logout completed, navigating...");
      router.push("/login");
    } catch (err) {
      console.error("❌ Logout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-9 rounded-lg">
          <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
          <AvatarFallback className="rounded-lg">{getInitials(activeUser.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 space-y-1 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem
          key={user.email}
          className={cn("p-0", user.id === activeUser.id && "bg-accent/50 border-l-primary border-l-2")}
          onClick={() => setActiveUser(user)}
        >
          <div className="flex w-full items-center justify-between gap-2 px-1 py-1.5">
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs capitalize">{user.role}</span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={loading} className="flex items-center gap-2">
          <LogOut />
          {loading ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
