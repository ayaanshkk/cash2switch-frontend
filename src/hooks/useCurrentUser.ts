import { useAuth } from "@/contexts/AuthContext";

export const useCurrentUser = () => {
  const { user } = useAuth();

  if (!user) return null;

  // ✅ Cast to any to avoid TypeScript errors
  const userAny = user as any;

  return {
    id: user.id.toString(),
    name: user.name,
    username: user.email || user.name || '',
    email: user.email || "",
    avatar: `/avatars/default.svg`,
    role: user.role,
    phone: userAny.phone || "",
    tenant_id: userAny.tenant_id || null,
  };
};
