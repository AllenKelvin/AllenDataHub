import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function PasswordResetCard({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <Card className="w-full max-w-md rounded-2xl border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (!result.ok) setError(result.error || "Unable to send the reset email.");
    else setMessage(result.message || "Check your email for a password reset link.");
  };

  return (
    <PasswordResetCard title="Forgot your password?" description="Enter your account email and we will send you a reset link.">
      {message ? <p className="text-center text-sm text-emerald-600">{message}</p> : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-xl pl-10" required />
            </div>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700">
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
    </PasswordResetCard>
  );
}

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(token ? "" : "This password reset link is invalid.");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    setError("");
    const result = await resetPassword(token, password);
    setLoading(false);
    if (!result.ok) setError(result.error || "Unable to reset your password.");
    else {
      setMessage(result.message || "Your password has been reset.");
      setTimeout(() => setLocation("/login"), 1800);
    }
  };

  return (
    <PasswordResetCard title="Create a new password" description="Choose a strong password with at least 8 characters.">
      {message ? <p className="text-center text-sm text-emerald-600">{message}</p> : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-xl" minLength={8} required /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 rounded-xl" minLength={8} required /></div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading || !token} className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700">{loading ? "Resetting..." : "Reset password"}</Button>
        </form>
      )}
    </PasswordResetCard>
  );
}