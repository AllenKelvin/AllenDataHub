import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(identifier, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "Login failed");
      return;
    }

    const adminLogin = result.userRole === "admin";
    setLocation(adminLogin ? "/admin" : "/user/dashboard");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-800 lg:flex lg:flex-col lg:justify-between p-10 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400 text-sm font-bold text-white">
            P2
          </div>
          <div>
            <p className="text-sky-200 text-sm font-medium">ALLENDATAHUB</p>
            <p className="text-xl font-semibold">AllenDataHub</p>
          </div>
        </div>
        <div className="max-w-md space-y-4 pb-10">
          <h1 className="text-4xl font-bold leading-tight">Welcome to AllenDataHub</h1>
          <p className="text-lg text-emerald-100/90">
            Securely manage your airtime and data transactions with confidence.
          </p>
          <p className="flex items-center gap-2 text-sm text-emerald-200/80">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-xs">✓</span>
            Trusted by thousands of dealers
          </p>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="flex flex-col items-center justify-center bg-white px-6 py-12 dark:bg-slate-950">
        <Card className="w-full max-w-md rounded-2xl border-slate-200 shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Welcome Back
              </span>
              <h2 className="text-3xl font-bold text-blue-600">Sign In</h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your credentials to access your dashboard
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or Username</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your email or Username"
                    className="h-11 rounded-xl pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:underline"
                    onClick={() => window.alert("Password reset link is coming soon.")}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11 rounded-xl pl-10 pr-10"
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
                className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-base font-semibold text-white hover:from-blue-700 hover:to-violet-700"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don’t have an account?{" "}
              <Link href="/register" className="font-semibold text-blue-600 hover:underline">
                Sign up
              </Link>
            </p>
            <p className="mt-4 text-center text-xs text-slate-400">
              Use your verified account credentials to continue.
            </p>
          </CardContent>
        </Card>
        <p className="mt-8 text-xs text-slate-400">© 2026 AllenDataHub. All rights reserved.</p>
      </div>
    </div>
  );
}
