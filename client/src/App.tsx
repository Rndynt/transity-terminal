import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AppLayout from "@/components/layout/AppLayout";
import MastersPage from "@/pages/masters/MastersPage";
import CsoPage from "@/pages/cso/CsoPage";
import CargoListPage from "@/pages/cargo/CargoListPage";
import ManifestPage from "@/pages/manifest/ManifestPage";
import AllBookingsPage from "@/pages/bookings/AllBookingsPage";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={CsoPage} />
        <Route path="/cso" component={CsoPage} />
        <Route path="/cargo" component={CargoListPage} />
        <Route path="/manifest" component={ManifestPage} />
        <Route path="/bookings" component={AllBookingsPage} />
        <Route path="/masters" component={MastersPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
