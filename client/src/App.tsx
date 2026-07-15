import { Switch, Route } from "wouter";
import { lazy, Suspense, useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { PermissionsProvider } from "@/lib/permissions";
import { RequireFlag } from "@/components/rbac/RequireFlag";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useLocation, Redirect } from "wouter";
import { PageLoader } from "@/components/ui/page-loader";

const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const SetupPage = lazy(() => import("@/pages/auth/SetupPage"));
const CsoPage = lazy(() => import("@/pages/cso/CsoPage"));
const MastersPage = lazy(() => import("@/pages/masters/MastersPage"));
const CargoListPage = lazy(() => import("@/pages/cargo/CargoListPage"));
const CargoTerminalPage = lazy(() => import("@/pages/cargo/CargoTerminalPage"));
const ManifestPage = lazy(() => import("@/pages/manifest/ManifestPage"));
const AllBookingsPage = lazy(() => import("@/pages/bookings/AllBookingsPage"));
const SpjPage = lazy(() => import("@/pages/spj/SpjPage"));
const SchedulePage = lazy(() => import("@/pages/schedule/SchedulePage"));
const SchedulerPage = lazy(() => import("@/pages/scheduler/SchedulerPage"));
const RevenueReportPage = lazy(() => import("@/pages/reports/RevenueReportPage"));
const SalesReportPage = lazy(() => import("@/pages/reports/SalesReportPage"));
const TripProfitabilityPage = lazy(() => import("@/pages/reports/TripProfitabilityPage"));
const LoadFactorPage = lazy(() => import("@/pages/reports/LoadFactorPage"));
const CancellationsReportPage = lazy(() => import("@/pages/reports/CancellationsReportPage"));
const CargoReportPage = lazy(() => import("@/pages/reports/CargoReportPage"));
const PaymentsReportPage = lazy(() => import("@/pages/reports/PaymentsReportPage"));
const CommercialFeeReportPage = lazy(() => import("@/pages/reports/CommercialFeeReportPage"));
const AdminStaffPage = lazy(() => import("@/pages/admin/AdminStaffPage"));
const AdminFlagsPage = lazy(() => import("@/pages/admin/AdminFlagsPage"));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const CashierPage = lazy(() => import("@/pages/cashier/CashierPage"));
const RefundsPage = lazy(() => import("@/pages/refunds/RefundsPage"));
const CustomersPage = lazy(() => import("@/pages/customers/CustomersPage"));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"));


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [setupChecked, setSetupChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      fetch("/api/setup/status")
        .then(r => r.json())
        .then(data => {
          if (data.needsSetup) {
            setNeedsSetup(true);
            navigate("/setup");
          }
        })
        .catch(() => {})
        .finally(() => setSetupChecked(true));
    } else if (!isLoading) {
      setSetupChecked(true);
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || (isAuthenticated && !setupChecked)) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (needsSetup) {
    return <Redirect to="/setup" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/setup" component={SetupPage} />
        <Route>
          <ProtectedRoute>
            <PermissionsProvider>
              <AppLayout>
                <Suspense fallback={<PageLoader />}>
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
                    <Route path="/cargo-terminal">
                      <RequireFlag flag="page.cargo">
                        <CargoTerminalPage />
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
                    <Route path="/scheduler">
                      <RequireFlag flag="page.schedule">
                        <SchedulerPage />
                      </RequireFlag>
                    </Route>
                    <Route path="/bookings">
                      <RequireFlag flag="page.bookings">
                        <AllBookingsPage />
                      </RequireFlag>
                    </Route>
                    <Route path="/dashboard">
                      <RequireFlag flag="page.dashboard">
                        <DashboardPage />
                      </RequireFlag>
                    </Route>
                    <Route path="/cashier">
                      <RequireFlag flag="page.cashier">
                        <CashierPage />
                      </RequireFlag>
                    </Route>
                    <Route path="/refunds">
                      <RequireFlag flag="page.refunds">
                        <RefundsPage />
                      </RequireFlag>
                    </Route>
                    <Route path="/customers">
                      <RequireFlag flag="page.customers">
                        <CustomersPage />
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
                    <Route path="/reports/commercial-fee">
                      <RequireFlag flags={["page.reports", "report.commercial_fee"]}>
                        <CommercialFeeReportPage />
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
                    <Route path="/admin/settings">
                      <RequireFlag flag="admin.flags.manage">
                        <SettingsPage />
                      </RequireFlag>
                    </Route>
                    <Route component={NotFound} />
                  </Switch>
                </Suspense>
              </AppLayout>
            </PermissionsProvider>
          </ProtectedRoute>
        </Route>
      </Switch>
    </Suspense>
  );
}

import AppLayout from "@/components/layout/AppLayout";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Toaster />
            <Router />
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
