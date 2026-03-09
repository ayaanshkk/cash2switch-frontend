import { useAuth } from "@/contexts/AuthContext";

export const useCurrentUser = () => {
  const { user } = useAuth();

  if (!user) return null;

  // ✅ Transform to match what your backend actually sends
  return {
    id: user.id.toString(),
    name: user.name,  // ✅ Backend sends this as employee_name
    username: user.username,
    email: user.email || "",
    avatar: `/avatars/default.png`,
    role: user.role,
    phone: user.phone,
    tenant_id: user.tenant_id,
  };
};