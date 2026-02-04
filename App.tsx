import * as React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import GlobalDateFilter from './components/GlobalDateFilter';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import SearchPage from './pages/SearchPage';
import SummaryPage from './pages/SummaryPage';
import DataManagementPage from './pages/DataManagementPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CostAnalyticsPage from './pages/CostAnalyticsPage';
import ProductManagementPage from './pages/ProductManagementPage';
import VisualMetricsPage from './pages/VisualMetricsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import RTSManagementPage from './pages/RTSManagementPage';
import ClaimsDashboardPage from './pages/ClaimsDashboardPage';
import ShippingAnomalyPage from './pages/ShippingAnomalyPage';
import WeightAnalysisPage from './pages/WeightAnalysisPage';
import VerifiedWeightsPage from './pages/VerifiedWeightsPage';
import LoginPage from './pages/LoginPage';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen w-full bg-[#f1f5f9] overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <GlobalDateFilter />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 pb-28 md:pb-6 scroll-smooth custom-scrollbar">
          <div className="max-w-[1800px] mx-auto min-h-full">
            {children}
          </div>
        </div>
        <MobileNav />
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/visual-stats" element={<VisualMetricsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/cost-analytics" element={<CostAnalyticsPage />} />
        <Route path="/products" element={<ProductManagementPage />} />
        <Route path="/management" element={<DataManagementPage />} />
        <Route path="/rts" element={<RTSManagementPage />} />
        <Route path="/claims" element={<ClaimsDashboardPage />} />
        <Route path="/claims" element={<ClaimsDashboardPage />} />
        <Route path="/shipping-anomalies" element={<ShippingAnomalyPage />} />
        <Route path="/weight-analysis" element={<WeightAnalysisPage />} />
        <Route path="/weight-anomalies" element={<WeightAnalysisPage />} />
        <Route path="/weight-anomalies-list" element={<WeightAnalysisPage />} />
        <Route path="/verified-weights" element={<VerifiedWeightsPage />} />
        <Route path="/admin" element={<AdminSettingsPage />} />
      </Routes>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;