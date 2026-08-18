import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Wallet from "@/pages/wallet";
import Cart from "@/pages/cart";
import Profile from "@/pages/profile";
import Mtn from "@/pages/mtn";
import AirtelTigo from "@/pages/airteltigo";
import Telecel from "@/pages/telecel";
import Afa from "@/pages/afa";
import Vouchers from "@/pages/vouchers";
import Referrals from "@/pages/referrals";
import Services from "@/pages/services";
import AllOrders from "@/pages/history/orders";
import MtnOrders from "@/pages/history/mtn-orders";
import AtOrders from "@/pages/history/at-orders";
import TelecelOrders from "@/pages/history/telecel-orders";
import Refunds from "@/pages/history/refunds";
import Deposits from "@/pages/history/deposits";
import AfaHistory from "@/pages/history/afa";
import VoucherHistory from "@/pages/history/vouchers";
import ApiDocs from "@/pages/api-docs";
import ApiKeys from "@/pages/api-keys";
import Settings from "@/pages/settings";
import AdminPage from "@/pages/admin";
import { EmailVerificationPage } from "@/pages/register";
import NotFound from "@/pages/not-found";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4 p-4 text-center">
            <div className="text-2xl font-bold text-rose-600">Something went wrong</div>
            <p className="max-w-md text-slate-500">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-violet-600 px-4 py-2 text-white"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function Protected({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (user.role === "admin" && Component !== AdminPage) {
    return <Redirect to="/admin" />;
  }
  if (user.role !== "admin" && Component === AdminPage) {
    return <Redirect to="/user/dashboard" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Guest({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }
  if (user) return <Redirect to="/user/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <Guest component={Login} />}</Route>
      <Route path="/register">{() => <Guest component={Register} />}</Route>
      <Route path="/verify-email">{() => <Guest component={EmailVerificationPage} />}</Route>

      <Route path="/user/dashboard">{() => <Protected component={Dashboard} />}</Route>
      <Route path="/user/wallet">{() => <Protected component={Wallet} />}</Route>
      <Route path="/user/cart">{() => <Protected component={Cart} />}</Route>
      <Route path="/user/profile">{() => <Protected component={Profile} />}</Route>

      <Route path="/user/mtn">{() => <Protected component={Mtn} />}</Route>
      <Route path="/user/airteltigo">{() => <Protected component={AirtelTigo} />}</Route>
      <Route path="/user/telecel">{() => <Protected component={Telecel} />}</Route>

      <Route path="/user/afa">{() => <Protected component={Afa} />}</Route>
      <Route path="/user/vouchers">{() => <Protected component={Vouchers} />}</Route>
      <Route path="/user/referrals">{() => <Protected component={Referrals} />}</Route>
      <Route path="/user/services">{() => <Protected component={Services} />}</Route>

      <Route path="/user/history/orders">{() => <Protected component={AllOrders} />}</Route>
      <Route path="/user/history/mtn">{() => <Protected component={MtnOrders} />}</Route>
      <Route path="/user/history/at">{() => <Protected component={AtOrders} />}</Route>
      <Route path="/user/history/telecel">{() => <Protected component={TelecelOrders} />}</Route>
      <Route path="/user/history/refunds">{() => <Protected component={Refunds} />}</Route>
      <Route path="/user/history/deposits">{() => <Protected component={Deposits} />}</Route>
      <Route path="/user/history/afa">{() => <Protected component={AfaHistory} />}</Route>
      <Route path="/user/history/vouchers">{() => <Protected component={VoucherHistory} />}</Route>

      <Route path="/user/api-docs">{() => <Protected component={ApiDocs} />}</Route>
      <Route path="/user/api-keys">{() => <Protected component={ApiKeys} />}</Route>
      <Route path="/user/settings">{() => <Protected component={Settings} />}</Route>
      <Route path="/admin">{() => <Protected component={AdminPage} />}</Route>

      <Route path="/dashboard">
        <Redirect to="/user/dashboard" />
      </Route>
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useAuth();
  return (
    <CartProvider userId={user?.id}>
      <Router />
    </CartProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <WouterRouter>
              <AuthProvider>
                <AppContent />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
