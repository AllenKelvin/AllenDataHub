import { Switch, Route, useLocation } from "wouter";
import { queryClient, setGetAccessTokenFn } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { useUser, getAccessToken } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import BuyDataPage from "@/pages/buy-data-page";
import AdminPage from "@/pages/admin-page";
import CartPage from "@/pages/cart-page";
import ProfilePage from "@/pages/profile-page";
import FundWalletPage from "@/pages/fund-wallet-page";
import PaymentReturnPage from "@/pages/payment-return-page";

// Initialize JWT token getter for queryClient
setGetAccessTokenFn(getAccessToken);

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect logic handled in useEffect usually, but direct navigation works too
    // Wouter doesn't have a direct <Redirect> component in current versions commonly used
    // so we render AuthPage or null
    return <AuthPage />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <NotFound />; // Or Access Denied
  }

  return (
    <LayoutShell>
      <Component />
    </LayoutShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/payment-return">
        {() => (
          <LayoutShell>
            <PaymentReturnPage />
          </LayoutShell>
        )}
      </Route>
      
      {/* Protected Routes */}
      <Route path="/">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/buy-data">
        {() => <ProtectedRoute component={BuyDataPage} />}
      </Route>
      <Route path="/cart">
        {() => <ProtectedRoute component={CartPage} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={ProfilePage} />}
      </Route>
      <Route path="/fund-wallet">
        {() => <ProtectedRoute component={FundWalletPage} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPage} adminOnly={true} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
