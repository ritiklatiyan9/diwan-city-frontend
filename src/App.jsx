import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './graphql/client';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Sites from './pages/Sites';
import SubAdmins from './pages/SubAdmins';
import Farmers from './pages/Farmers';
import FarmerPayments from './pages/FarmerPayments';
import Commissions from './pages/Commissions';
import CreateCommission from './pages/CreateCommission';
import PlotCommissionList from './pages/PlotCommissionList';
import PlotCommissionDetail from './pages/PlotCommissionDetail';
import PlotCommissionSearch from './pages/PlotCommissionSearch';
import CashFlow from './pages/CashFlow';
import FirmTransactions from './pages/FirmTransactions';
import FirmDetail from './pages/FirmDetail';
import FirmTransactionHistory from './pages/FirmTransactionHistory';
import PlotPayments from './pages/PlotPayments';
import PaymentManagement from './pages/PaymentManagement';
import PaymentAnalytics from './pages/PaymentAnalytics';
import PlotDetail from './pages/PlotDetail';
import PlotRegistry from './pages/PlotRegistry';
import Expenses from './pages/Expenses';
import EditApprovals from './pages/EditApprovals';
import AdminApprovals from './pages/AdminApprovals';
import PendingApprovals from './pages/PendingApprovals';
import DayBook from './pages/DayBook';
import ImprestManagement from './pages/ImprestManagement';
import ImprestDashboard from './pages/ImprestDashboard';
import PermissionManagement from './pages/PermissionManagement';
import RegisterUser from './pages/RegisterUser';
import UserCategories from './pages/UserCategories';
import ExpenseCategories from './pages/ExpenseCategories';
import ExcelEditor from './pages/ExcelEditor';
import ExcelFiles from './pages/ExcelFiles';
import Chat from './pages/Chat';
import VendorManagement from './pages/VendorManagement';
import VendorCommitmentDetail from './pages/VendorCommitmentDetail';
import VendorInventory from './pages/VendorInventory';
import VendorInventoryDetail from './pages/VendorInventoryDetail';
import VendorPaymentReceiptPrint from './pages/VendorPaymentReceiptPrint';
import VendorCategories from './pages/VendorCategories';
import UserIdManagement from './pages/UserIdManagement';
import ApprovalManager from './pages/ApprovalManager';
import DashboardManagement from './pages/DashboardManagement';
import './App.css';
import './fonts.css';

const customFontStyle = {
  fontFamily: "'Neue Montreal Regular', sans-serif",
  fontWeight: 600,
  fontStyle: "normal",
};

function App() {
  return (
    <ApolloProvider client={apolloClient}>
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/vendors/payments/:paymentId/receipt"
            element={<ProtectedRoute requiredModule="vendors"><VendorPaymentReceiptPrint /></ProtectedRoute>}
          />

          {/* Protected Routes (all authenticated users) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ProtectedRoute requiredModule="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute requiredModule="clients"><Clients /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute requiredModule="clients"><ClientDetail /></ProtectedRoute>} />
            <Route path="/register-user" element={<ProtectedRoute requiredModule="clients"><RegisterUser /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute requiredModule="vendors"><VendorManagement /></ProtectedRoute>} />
            <Route path="/vendors/inventory" element={<ProtectedRoute requiredModule="vendors"><VendorInventory /></ProtectedRoute>} />
            <Route path="/vendors/inventory/:id" element={<ProtectedRoute requiredModule="vendors"><VendorInventoryDetail /></ProtectedRoute>} />
            <Route path="/vendors/categories" element={<ProtectedRoute requiredModule="vendors"><VendorCategories /></ProtectedRoute>} />
            <Route path="/vendors/:id" element={<ProtectedRoute requiredModule="vendors"><VendorCommitmentDetail /></ProtectedRoute>} />
            <Route path="/user-categories" element={<ProtectedRoute requiredRole="admin"><UserCategories /></ProtectedRoute>} />
            <Route path="/farmers" element={<ProtectedRoute requiredModule="farmers"><Farmers /></ProtectedRoute>} />
            <Route path="/farmers/:id" element={<ProtectedRoute requiredModule="farmers"><FarmerPayments /></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute requiredModule="commissions"><Commissions /></ProtectedRoute>} />
            <Route path="/commissions/create" element={<ProtectedRoute requiredModule="commissions"><CreateCommission /></ProtectedRoute>} />
            <Route path="/plot-commission" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionList /></ProtectedRoute>} />
            <Route path="/plot-commission/search" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionSearch /></ProtectedRoute>} />
            <Route path="/plot-commission/plot/:plotId" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionDetail /></ProtectedRoute>} />
            <Route path="/plot-commission/:id" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionDetail /></ProtectedRoute>} />
            <Route path="/daybook" element={<ProtectedRoute requiredModule="daybook"><DayBook /></ProtectedRoute>} />
            <Route path="/daybook/cash" element={<ProtectedRoute requiredModule="daybook"><DayBook /></ProtectedRoute>} />
            <Route path="/daybook/bank" element={<ProtectedRoute requiredModule="daybook"><DayBook /></ProtectedRoute>} />
            <Route path="/cashflow" element={<ProtectedRoute requiredModule="cashflow"><CashFlow /></ProtectedRoute>} />
            <Route path="/cashflow/:ledgerId" element={<ProtectedRoute requiredModule="cashflow"><CashFlow /></ProtectedRoute>} />
            <Route path="/firm-transactions" element={<ProtectedRoute requiredModule="firm_transactions"><FirmTransactions /></ProtectedRoute>} />
            <Route path="/firm-transactions/history" element={<ProtectedRoute requiredModule="firm_transactions"><FirmTransactionHistory /></ProtectedRoute>} />
            <Route path="/firm-transactions/:id" element={<ProtectedRoute requiredModule="firm_transactions"><FirmDetail /></ProtectedRoute>} />
            <Route path="/plot-payments" element={<ProtectedRoute requiredModule="plot_payments"><PlotPayments /></ProtectedRoute>} />
            <Route path="/plot-payments/:id" element={<ProtectedRoute requiredModule="plot_payments"><PlotDetail /></ProtectedRoute>} />
            <Route path="/payment-management" element={<ProtectedRoute requiredModule="plot_payments"><PaymentManagement /></ProtectedRoute>} />
            <Route path="/payment-analytics" element={<ProtectedRoute requiredModule="plot_payments"><PaymentAnalytics /></ProtectedRoute>} />
            <Route path="/plot-registry" element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistry /></ProtectedRoute>} />
            <Route path="/plot-registry/:id" element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistry /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute requiredModule="expenses"><Expenses /></ProtectedRoute>} />
            <Route path="/expense-categories" element={<ProtectedRoute requiredModule="expenses"><ExpenseCategories /></ProtectedRoute>} />
            <Route path="/imprest" element={<ProtectedRoute requiredModule="imprest"><ImprestDashboard /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredModule="reports"><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredModule="settings"><Settings /></ProtectedRoute>} />

            {/* Native Excel Routes */}
            <Route path="/excel/new" element={<ProtectedRoute requiredModule="excel"><ExcelEditor /></ProtectedRoute>} />
            <Route path="/excel/edit/:id" element={<ProtectedRoute requiredModule="excel"><ExcelEditor /></ProtectedRoute>} />
            <Route path="/excel/files" element={<ProtectedRoute requiredModule="excel"><ExcelFiles /></ProtectedRoute>} />

            {/* Chat Route (accessible to all authenticated users) */}
            <Route path="/chat" element={<ProtectedRoute requiredModule="chat"><Chat /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute requiredModule="chat"><Chat /></ProtectedRoute>} />

            {/* Admin-only Routes */}
            <Route
              path="/sites"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Sites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sub-admins"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SubAdmins />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expense-approvals"
              element={
                <ProtectedRoute requiredModule="expense_approval">
                  <AdminApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approval-manager"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ApprovalManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-approvals"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EditApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pending-approvals"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PendingApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/imprest-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ImprestManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/permissions"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PermissionManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-id-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UserIdManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DashboardManagement />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </Router>
    </ApolloProvider>
  );
}

export default App;
