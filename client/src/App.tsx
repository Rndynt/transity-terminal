import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PermissionsProvider } from "@/lib/permissions";
import { RequireFlag } from "@/components/rbac/RequireFlag";
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
import CancellationsReportPage from "@/pages/reports/CancellationsReportPage";
import CargoReportPage from "@/pages/reports/CargoReportPage";
import PaymentsReportPage from "@/pages/reports/PaymentsReportPage";
import LoginPage from "@/pages/auth/LoginPage";
import AdminStaffPage from "@/pages/admin/AdminStaffPage";
import AdminFlagsPage from "@/pages/admin/AdminFlagsPage";
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
          <PermissionsProvider>
            <AppLayout>
              <Switch>
                <Route path="/">
                  <RequireFlag flag="page.cso">
                    <CsoPage />
                  </RequireFlag>
                </Route>
                <Route path="/cso">
                  <RequireFlag flag="page.cso">
                    <CsoPage />
                  </RequireFlag>
                </Route>
                <Route path="/cargo">
                  <RequireFlag flag="page.cargo">
                    <CargoListPage />
                  </RequireFlag>
                </Route>
                <Route path="/manifest">
                  <RequireFlag flag="page.manifest">
                    <ManifestPage />
                  </RequireFlag>
                </Route>
                <Route path="/schedule">
                  <RequireFlag flag="page.schedule">
                    <SchedulePage />
                  </RequireFlag>
                </Route>
                <Route path="/bookings">
                  <RequireFlag flag="page.bookings">
                    <AllBookingsPage />
                  </RequireFlag>
                </Route>
                <Route path="/spj">
                  <RequireFlag flag="page.spj">
                    <SpjPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/revenue">
                  <RequireFlag flags={["page.reports", "report.revenue"]}>
                    <RevenueReportPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/sales">
                  <RequireFlag flags={["page.reports", "report.sales"]}>
                    <SalesReportPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/trip-profitability">
                  <RequireFlag flags={["page.reports", "report.trip_profitability"]}>
                    <TripProfitabilityPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/load-factor">
                  <RequireFlag flags={["page.reports", "report.load_factor"]}>
                    <LoadFactorPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/cancellations">
                  <RequireFlag flags={["page.reports", "report.cancellations"]}>
                    <CancellationsReportPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/cargo">
                  <RequireFlag flags={["page.reports", "report.cargo"]}>
                    <CargoReportPage />
                  </RequireFlag>
                </Route>
                <Route path="/reports/payments">
                  <RequireFlag flags={["page.reports", "report.payments"]}>
                    <PaymentsReportPage />
                  </RequireFlag>
                </Route>
                <Route path="/masters">
                  <RequireFlag flag="page.masters">
                    <MastersPage />
                  </RequireFlag>
                </Route>
                <Route path="/admin/staff">
                  <RequireFlag flag="admin.staff.manage">
                    <AdminStaffPage />
                  </RequireFlag>
                </Route>
                <Route path="/admin/flags">
                  <RequireFlag flag="admin.flags.manage">
                    <AdminFlagsPage />
                  </RequireFlag>
                </Route>
                <Route component={NotFound} />
              </Switch>
            </AppLayout>
          </PermissionsProvider>
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
