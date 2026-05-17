import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { DataProvider } from "@/contexts/DataContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import PersonnelPage from "@/pages/PersonnelPage";
import EquipmentPage from "@/pages/EquipmentPage";
import DailyLogPage from "@/pages/DailyLogPage";
import ReviewPage from "@/pages/ReviewPage";
import AnalyticsPage from "@/pages/AnalyticsPage";

import ForemanTeamPage from "@/pages/ForemanTeamPage";
import EngineerManagePage from "@/pages/EngineerManagePage";
import WorkCodesPage from "@/pages/WorkCodesPage";
import AccountManagePage from "@/pages/AccountManagePage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { isLoggedIn } = useAppContext();
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/personnel" element={<PersonnelPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/work-codes" element={<WorkCodesPage />} />
        <Route path="/accounts" element={<AccountManagePage />} />
        <Route path="/daily-log" element={<DailyLogPage />} />
        <Route path="/review" element={<ReviewPage />} />
        
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/team" element={<ForemanTeamPage />} />
        <Route path="/engineer-manage" element={<EngineerManagePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
