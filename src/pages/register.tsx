import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function EmailVerificationPage() {
  const [, setLocation] = useLocation();
  const { verifyEmail, user } = useAuth();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const verify = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const email = params.get("email");
      const sent = params.get("sent") === "1";

      if (sent && !token) {
        setStatus("pending");
        setMessage(`A verification email has been sent to ${email || "your inbox"}. Please click the link in that email to verify your account.`);
        return;
      }

      if (!token) {
        setStatus("error");
        setMessage("This verification link is invalid or expired.");
        return;
      }

      const result = await verifyEmail(token);
      if (result.ok) {
        setStatus("success");
        setMessage("Your email has been verified successfully.");
        setTimeout(() => setLocation("/login"), 1800);
        return;
      }

      setStatus("error");
      setMessage(result.error || "Verification failed.");
    };

    void verify();
  }, [setLocation, verifyEmail]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg">
        <CardContent className="p-8 text-center">
          {status === "success" ? (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold text-emerald-700">Email Verified</h1>
              <p className="mt-3 text-sm text-slate-500">{message}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                <MailCheck className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold text-violet-700">Email Verification</h1>
              <p className="mt-3 text-sm text-slate-500">{message}</p>
              {user && !user.emailVerified ? (
                <p className="mt-3 text-xs text-slate-400">You can try again from your inbox or contact support.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"user" | "agent" | "admin">("user");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const refParam = new URLSearchParams(window.location.search).get("ref") || undefined;
    const result = await register({
      fullName,
      email,
      username,
      phone,
      password,
      role,
      referredBy: refParam,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Registration failed.");
      return;
    }

    setLocation("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <Card className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Join AllenDataHub as a dealer</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Full Name</Label>
              <Input className="rounded-xl dark:border-slate-700 dark:bg-slate-950" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Email</Label>
              <Input type="email" className="rounded-xl dark:border-slate-700 dark:bg-slate-950" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Username</Label>
              <Input className="rounded-xl dark:border-slate-700 dark:bg-slate-950" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Allen Kelvin" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Phone Number</Label>
              <Input className="rounded-xl dark:border-slate-700 dark:bg-slate-950" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Account Type</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "user" | "agent" | "admin")}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="user">User</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  className="rounded-xl pr-10 dark:border-slate-700 dark:bg-slate-950"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white"
            >
              {loading ? "Creating..." : "Sign Up"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
