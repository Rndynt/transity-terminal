import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import AppLayout from "@/components/layout/AppLayout";
import MastersPage from "@/pages/masters/MastersPage";
import CsoPage from "@/pages/cso/CsoPage";
import CargoListPage from "@/pages/cargo/CargoListPage";
import ManifestPage from "@/pages/manifest/ManifestPage";
import AllBookingsPage from "@/pages/bookings/AllBookingsPage";
import SpjPage from "@/pages/spj/SpjPage";
import SchedulePage from "@/pages/schedule/SchedulePage";
import RevenueReportPage from "@/pages/reports/RevenueReportPage";
import SalesReportPage from "@/pages/reports/SalesReportPage";
import TripProfitabilityPage from "@/pages/reports/TripProfitabilityPage";
import LoadFactorPage from "@/pages/reports/LoadFactorPage";
import LoginPage from "@/pages/auth/LoginPage";
import { Loader2 } from "lucide-react";
import { useLocation, Redirect } from "wouter";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <ProtectedRoute>
          <AppLayout>
            <Switch>
              <Route path="/" component={CsoPage} />
              <Route path="/cso" component={CsoPage} />
              <Route path="/cargo" component={CargoListPage} />
              <Route path="/manifest" component={ManifestPage} />
              <Route path="/schedule" component={SchedulePage} />
              <Route path="/bookings" component={AllBookingsPage} />
              <Route path="/spj" component={SpjPage} />
              <Route path="/reports/revenue" component={RevenueReportPage} />
              <Route path="/reports/sales" component={SalesReportPage} />
              <Route path="/reports/trip-profitability" component={TripProfitabilityPage} />
              <Route path="/reports/load-factor" component={LoadFactorPage} />
              <Route path="/masters" component={MastersPage} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
