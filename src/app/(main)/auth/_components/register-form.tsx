"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_CONFIG } from "@/config/app-config";
import { useAuth } from "@/contexts/AuthContext";

// The Zod Schema needs a slight adjustment to allow the field to be initially undefined/empty
// before the user interacts with it. We use .optional() and .pipe(z.enum(...)) to achieve this.

// Define a literal type for the roles
const Roles = ["Manager", "HR", "Sales", "Production"] as const;
type RoleType = (typeof Roles)[number];

const FormSchema = z
  .object({
    first_name: z.string().min(1, { message: "First name is required." }),
    last_name: z.string().min(1, { message: "Last name is required." }),
    email: z.string().email({ message: "Please enter a valid email address." }),

    // 🌟 CHANGE 1: Define 'role' as a string that must be one of the enum values
    // but allow it to be initially undefined or empty.
    role: z.string().pipe(
      z.enum(Roles, {
        errorMap: () => ({ message: "Please select a role." }),
      }),
    ),

    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .refine((val) => /[a-z]/.test(val) && /[A-Z]/.test(val) && /\d/.test(val), {
        message: "Password must include uppercase, lowercase, and a number.",
      }),
    confirmPassword: z.string().min(1, { message: "Confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function RegisterForm() {
  const { register: authRegister } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      role: "" as RoleType,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setLoading(true);

    const payload = {
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role, // data.role is now guaranteed to be a valid string by the Zod pipe
    };

    try {
      const result = await authRegister(payload);

      if (result.success) {
        toast("Registration successful", {
          description: "Your account has been created. Redirecting to login...",
        });
        setTimeout(() => {
          router.push('/login?message=Registration successful. Please sign in.');
        }, 900);
        form.reset();
      } else {
        toast(result.error || "Registration failed");
      }
    } catch (err: any) {
      toast(`An unexpected error occurred: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input id="first_name" placeholder="First name" autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input id="last_name" placeholder="Last name" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address *</FormLabel>
              <FormControl>
                <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <FormControl>
                  <Select
                    // 🌟 We now rely on Select's internal handling of the empty string.
                    onValueChange={(val) => field.onChange(val)}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div />
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password *</FormLabel>
              <FormControl>
                <Input id="password" type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
              </FormControl>
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password *</FormLabel>
              <FormControl>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </Button>
      </form>
    </Form>
  );
}
