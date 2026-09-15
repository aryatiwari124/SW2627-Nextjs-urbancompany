"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();

  const [role, setRole] = useState<"CUSTOMER" | "PROFESSIONAL">("CUSTOMER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          email,
          password,
          phone: phone || undefined,
          address: role === "CUSTOMER" ? address || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      if (role === "PROFESSIONAL") {
        router.push("/professional");
      } else {
        router.push("/customer");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-logo-row">
        <span className="auth-logo-mark">U</span>
        <span className="auth-logo-name">Urban Company</span>
      </Link>

      <div className="auth-card">
        <h1 className="auth-card-title">Create an account</h1>
        <p className="auth-card-sub">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>

        {error && (
          <div className="auth-error">
            <svg className="auth-error-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Role selector */}
        <div className="auth-role-tabs">
          <button
            type="button"
            onClick={() => setRole("CUSTOMER")}
            className={`auth-role-tab${role === "CUSTOMER" ? " active" : ""}`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setRole("PROFESSIONAL")}
            className={`auth-role-tab${role === "PROFESSIONAL" ? " active" : ""}`}
          >
            Professional
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="name" className="auth-label">Full Name</label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              placeholder="e.g. Rahul Sharma"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="email" className="auth-label">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="name@example.com"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">Password (min 6 characters)</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              placeholder="••••••••"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="phone" className="auth-label">
              Phone Number {role === "PROFESSIONAL" ? "" : "(optional)"}
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="auth-input"
              placeholder="9876543210"
              required={role === "PROFESSIONAL"}
            />
          </div>

          {role === "CUSTOMER" && (
            <div className="auth-field">
              <label htmlFor="address" className="auth-label">Address (optional)</label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="auth-input"
                placeholder="e.g. 28, 2nd Cross, Indiranagar, Bengaluru"
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
