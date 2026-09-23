import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import WeddingRegistration from './pages/WeddingRegistration';
import Candidates from './pages/Candidates';
import WeddingOperationsDesk from './pages/WeddingOperationsDesk';
import Employees from './pages/Employees';
import Openings from './pages/Openings';
import Settings from './pages/Settings';
import BroadcastCenter from './pages/BroadcastCenter';
import UserManagement from './pages/UserManagement';
import DepartmentHiring from './pages/DepartmentHiring';
import SectionAllocation from './pages/SectionAllocation';
import Footfall from './pages/Footfall';
import PublicFeedback from './pages/PublicFeedback';
import FeedbackQR from './pages/FeedbackQR';
import FeedbackList from './pages/FeedbackList';
import FeedbackCollection from './pages/FeedbackCollection';
import FeedbackQRManagement from './pages/FeedbackQRManagement';
import Divert from './pages/Divert';
import PMView from './pages/PMView';
import CashSettlement from './pages/CashSettlement';
import VmChecklist from './pages/VmChecklist';
import TVDisplay from './pages/TVDisplay';
import Greeter from './pages/Greeter';
import Attendance from './pages/Attendance';
import DailyMCheck from './pages/DailyMCheck';
import MCheckReports from './pages/MCheckReports';
import MCheckHistory from './pages/MCheckHistory';
import WeddingCRM from './pages/WeddingCRM';
import TelecallerDashboard from './pages/TelecallerDashboard';
import WeddingTracking from './pages/WeddingTracking';
import SystemAdmin from './pages/SystemAdmin';
import BatchPlan from './pages/BatchPlan';
import DojDesk from './pages/DojDesk';
import CandidateEntry from './pages/CandidateEntry';
import ChatDashboard from './pages/ChatDashboard';
import WeddingCrmDashboard from './pages/wedding/WeddingCrmDashboard';
import WeddingCustomerRegister from './pages/wedding/WeddingCustomerRegister';
import WeddingCustomerDetail from './pages/wedding/WeddingCustomerDetail';
import WeddingCustomerCreate from './pages/wedding/WeddingCustomerCreate';
import TelecallerDeskPage from './pages/wedding/TelecallerDeskPage';
import WeddingCallHistory from './pages/wedding/WeddingCallHistory';
import WeddingFollowUpCalendar from './pages/wedding/WeddingFollowUpCalendar';
import WeddingStatusBoard from './pages/wedding/WeddingStatusBoard';
import WeddingReports from './pages/wedding/WeddingReports';
import WeddingImport from './pages/wedding/WeddingImport';
import NoAccess from './pages/NoAccess';
import ToastContainer from './components/Toast';
import { LocationProvider } from './context/LocationContext';
import QuickActionCenter from './components/ui/QuickActionCenter';
import ChatWidget from './components/ui/ChatWidget';
import RouteGuard from './components/RouteGuard';
import UserTracker from './components/UserTracker';
import DevToolsGuard from './components/DevToolsGuard';
import ConnectivityBanner from './components/ConnectivityBanner';
import ErrorBoundary from './components/ErrorBoundary';
import SessionTimeoutGuard from './components/SessionTimeoutGuard';
import DesktopModeWarning from './components/DesktopModeWarning';
import ConsentGuard from './components/ConsentGuard';
import { useUrlGuard } from './hooks/useUrlGuard';
import { Auth } from './services/api';

/** Monitors every URL change for unauthorized access — triggers force-logout on violation. */
function UrlGuardMonitor() {
  useUrlGuard();
  return null;
}

/** Renders ChatWidget for all users */
function AuthChatWidget() {
  return <ChatWidget />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <LocationProvider>
    <Router>
      <ToastContainer />
      <ConnectivityBanner />
      <UserTracker />
      <UrlGuardMonitor />
      <ConsentGuard>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/no-access" element={<NoAccess />} />
        <Route path="/dashboard" element={<RouteGuard pageKey="dashboard"><Dashboard /></RouteGuard>} />
        <Route path="/wedding-crm" element={<RouteGuard pageKey="wedding_crm"><WeddingCRM /></RouteGuard>} />
        <Route path="/wedding-crm/dashboard" element={<RouteGuard pageKey="wedding_crm"><WeddingCrmDashboard /></RouteGuard>} />
        <Route path="/wedding-crm/customers" element={<RouteGuard pageKey="wedding_crm"><WeddingCustomerRegister /></RouteGuard>} />
        <Route path="/wedding-crm/customers/new" element={<RouteGuard pageKey="wedding_registration"><WeddingCustomerCreate /></RouteGuard>} />
        <Route path="/wedding-crm/customers/:id" element={<RouteGuard pageKey="wedding_crm"><WeddingCustomerDetail /></RouteGuard>} />
        <Route path="/wedding-crm/telecaller" element={<RouteGuard pageKey="wedding_crm"><TelecallerDeskPage /></RouteGuard>} />
        <Route path="/wedding-crm/calls" element={<RouteGuard pageKey="wedding_crm"><WeddingCallHistory /></RouteGuard>} />
        <Route path="/wedding-crm/calendar" element={<RouteGuard pageKey="wedding_crm"><WeddingFollowUpCalendar /></RouteGuard>} />
        <Route path="/wedding-crm/pipeline" element={<RouteGuard pageKey="wedding_crm"><WeddingStatusBoard /></RouteGuard>} />
        <Route path="/wedding-crm/status-board" element={<RouteGuard pageKey="wedding_crm"><WeddingStatusBoard /></RouteGuard>} />
        <Route path="/wedding-crm/reports" element={<RouteGuard pageKey="wedding_crm"><WeddingReports /></RouteGuard>} />
        <Route path="/wedding-crm/import" element={<RouteGuard pageKey="wedding_crm"><WeddingImport /></RouteGuard>} />
        <Route path="/wedding/customer-registration" element={<RouteGuard pageKey="wedding_registration"><WeddingCustomerCreate /></RouteGuard>} />
        <Route path="/wedding-operations" element={<RouteGuard pageKey="wedding_operations"><WeddingOperationsDesk /></RouteGuard>} />

        {/* Telecaller Dedicated Routes */}
        <Route path="/telecaller/desk" element={<RouteGuard pageKey="telecaller_desk"><TelecallerDeskPage /></RouteGuard>} />
        <Route path="/telecaller/queue" element={<Navigate to="/telecaller/desk" replace />} />
        <Route path="/telecaller/customer/:id" element={<RouteGuard pageKey="wedding_crm"><WeddingCustomerDetail /></RouteGuard>} />
        <Route path="/telecaller-dashboard" element={<RouteGuard pageKey="telecaller_dashboard"><TelecallerDashboard /></RouteGuard>} />

        {/* Job Applicant Public Portals (Distinct from Wedding Customer Registration) */}
        <Route path="/apply" element={<CandidateEntry />} />
        <Route path="/applicants/register" element={<CandidateEntry />} />
        <Route path="/candidate-registration" element={<Navigate to="/apply" replace />} />

        <Route path="/footfall" element={<RouteGuard pageKey="footfall"><Footfall /></RouteGuard>} />
        <Route path="/feedback-public" element={<PublicFeedback />} />
        <Route path="/feedback-qr" element={<FeedbackQR />} />
        <Route path="/feedback-qr-management" element={<RouteGuard pageKey="feedback_qr"><FeedbackQRManagement /></RouteGuard>} />
        <Route path="/feedback-list" element={<RouteGuard pageKey="feedback_list"><FeedbackList /></RouteGuard>} />
        <Route path="/feedback-collection" element={<RouteGuard pageKey="feedback_collection"><FeedbackCollection /></RouteGuard>} />
        <Route path="/divert" element={<RouteGuard pageKey="divert"><Divert /></RouteGuard>} />
        <Route path="/pm-view" element={<RouteGuard pageKey="pm_view"><PMView /></RouteGuard>} />
        <Route path="/cash-settlement" element={<CashSettlement />} />
        <Route path="/vm-checklist" element={<RouteGuard pageKey="vm_checklist"><VmChecklist /></RouteGuard>} />
        <Route path="/tv" element={<TVDisplay />} />
        <Route path="/greeter" element={<RouteGuard pageKey="greeter"><Greeter /></RouteGuard>} />
        <Route path="/attendance" element={<RouteGuard pageKey="attendance"><Attendance /></RouteGuard>} />
        <Route path="/roster" element={<Navigate to="/attendance" replace />} />
        <Route path="/daily-mcheck" element={<RouteGuard pageKey="daily_mcheck"><DailyMCheck /></RouteGuard>} />
        <Route path="/mcheck-reports" element={<RouteGuard pageKey="mcheck_reports"><MCheckReports /></RouteGuard>} />
        <Route path="/mcheck-history" element={<RouteGuard pageKey="mcheck_history"><MCheckHistory /></RouteGuard>} />
        <Route path="/candidates" element={<RouteGuard pageKey="candidates"><Candidates /></RouteGuard>} />
        <Route path="/wedding-registration" element={<WeddingRegistration />} />
        <Route path="/track" element={<WeddingTracking />} />
        <Route path="/interview-panel" element={<Navigate to="/candidates" replace />} />
        <Route path="/interview-form" element={<Navigate to="/candidates" replace />} />
        <Route path="/offer-process" element={<RouteGuard pageKey="offer"><WeddingOperationsDesk /></RouteGuard>} />
        {/* Disabled pages per user request: Onboarding, Exit & FnF, Interview Panel */}
        <Route path="/onboarding" element={<Navigate to="/employees" replace />} />
        <Route path="/employee-exit" element={<Navigate to="/employees" replace />} />
        <Route path="/exit" element={<Navigate to="/employees" replace />} />
        {/* Dead sidebar links — redirect to nearest relevant live page */}
        <Route path="/joining-desk" element={<Navigate to="/doj-desk" replace />} />
        <Route path="/greyhr" element={<Navigate to="/employees" replace />} />
        <Route path="/regional-analytics" element={<Navigate to="/dashboard" replace />} />
        <Route path="/employees" element={<RouteGuard pageKey="employees"><Employees /></RouteGuard>} />
        <Route path="/batch-plan" element={<RouteGuard pageKey="batch_plan"><BatchPlan /></RouteGuard>} />
        <Route path="/doj-desk" element={<RouteGuard pageKey="doj_desk"><DojDesk /></RouteGuard>} />
        <Route path="/joined-store" element={<Navigate to="/doj-desk" replace />} />
        <Route path="/department-hiring" element={<RouteGuard pageKey="dept_hiring"><DepartmentHiring /></RouteGuard>} />
        <Route path="/section-allocation" element={<RouteGuard pageKey="section_allocation"><SectionAllocation /></RouteGuard>} />
        <Route path="/openings" element={<RouteGuard pageKey="openings"><Openings /></RouteGuard>} />
        <Route path="/broadcast-center" element={<RouteGuard pageKey="broadcast"><BroadcastCenter /></RouteGuard>} />
        <Route path="/user-management" element={<RouteGuard pageKey="user_management"><UserManagement /></RouteGuard>} />
        <Route path="/settings" element={<RouteGuard pageKey="settings"><Settings /></RouteGuard>} />
        <Route path="/system-admin" element={<RouteGuard pageKey="system_admin"><SystemAdmin /></RouteGuard>} />
        <Route path="/chat-dashboard" element={<RouteGuard pageKey="dashboard"><ChatDashboard /></RouteGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ConsentGuard>
      <QuickActionCenter />
      <AuthChatWidget />
      <SessionTimeoutGuard />
      <DevToolsGuard />
      <DesktopModeWarning />
    </Router>
    </LocationProvider>
    </ErrorBoundary>
  );
}
