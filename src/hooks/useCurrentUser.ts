import { useAuth } from "@/contexts/AuthContext";

export const useCurrentUser = () => {
  const { user } = useAuth();

  if (!user) return null;

  // Transform your auth user data to match the expected format
  return {
    id: user.id.toString(),
    name: user.full_name,
    username: user.email.split("@")[0], // Use email prefix as username
    email: user.email,
    avatar: `/avatars/default.png`, // You can add avatar field to your User model later
    role: user.role,
    department: user.department,
    phone: user.phone,
    first_name: user.first_name,
    last_name: user.last_name,
  };
};
