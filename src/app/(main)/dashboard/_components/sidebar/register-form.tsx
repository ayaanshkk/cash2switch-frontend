// /src/app/(main)/auth/_components/register-form.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "Staff", // default selection
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.first_name || !form.last_name || !form.email || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    const payload = {
      email: form.email,
      password: form.password,
      first_name: form.first_name,
      last_name: form.last_name,
      role: form.role, // send role instead of department/phone
    };

    setLoading(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      setSuccess("Registration successful — you can now log in.");
      // optional: redirect to login after short delay
      setTimeout(() => router.push("/login"), 900);
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          name="first_name"
          value={form.first_name}
          onChange={onChange}
          placeholder="First name"
          className="input"
          required
        />
        <input
          name="last_name"
          value={form.last_name}
          onChange={onChange}
          placeholder="Last name"
          className="input"
          required
        />
      </div>

      <input
        name="email"
        value={form.email}
        onChange={onChange}
        placeholder="you@example.com"
        type="email"
        className="input"
        required
      />

      <input
        name="password"
        value={form.password}
        onChange={onChange}
        placeholder="Password"
        type="password"
        className="input"
        required
      />

      <input
        name="confirm_password"
        value={form.confirm_password}
        onChange={onChange}
        placeholder="Confirm password"
        type="password"
        className="input"
        required
      />

      <label className="text-sm">Role</label>
      <select name="role" value={form.role} onChange={onChange} className="select" aria-label="Select role">
        <option>Admin</option>
        <option>Staff</option>
        <option>Secratary</option>
      </select>

      {error && <div className="text-destructive text-sm">{error}</div>}
      {success && <div className="text-success text-sm">{success}</div>}

      <button type="submit" className="btn" disabled={loading}>
        {loading ? "Registering..." : "Create account"}
      </button>

      <p className="text-muted-foreground text-center text-xs">
        Already have an account?{" "}
        <Link href="/login" className="text-primary">
          Login
        </Link>
      </p>
    </form>
  );
}
