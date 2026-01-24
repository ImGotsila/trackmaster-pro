import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import SearchPage from './pages/SearchPage';
import SummaryPage from './pages/SummaryPage';
import DataManagementPage from './pages/DataManagementPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { DataProvider } from './context/DataContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    // Outer container: Full screen
    <div className="flex h-screen w-full bg-[#f1f5f9] overflow-hidden">
      {/* Sidebar: Desktop Only */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Scrollable Content: Bottom padding for Mobile Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 pb-28 md:pb-6 scroll-smooth custom-scrollbar">
          <div className="max-w-[1800px] mx-auto min-h-full">
            {children}
          </div>
        </div>

        {/* Mobile Navigation: Fixed at bottom */}
        <MobileNav />
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/management" element={<DataManagementPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </DataProvider>
  );
};

export default App;