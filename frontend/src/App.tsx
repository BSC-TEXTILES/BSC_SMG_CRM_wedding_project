import { Suspense, lazy, useEffect } from 'react';
import { forceResetBodyScroll } from './components/ui/ModalPortal';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient, useRealtimeInvalidation } from './hooks/useApi';
const Home = lazy(() => import('./pages/Home'));

// Create QueryClient instance outside component to prevent recreation on re-renders
const queryClient = createQueryClient();
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const HRDashboard = lazy(() => import('./pages/HRDashboard'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const WeddingRegistration = lazy(() => import('./pages/WeddingRegistration'));
const Candidates = lazy(() => import('./pages/Candidates'));
const OfferProcess = lazy(() => import('./pages/OfferProcess'));
const WeddingOperationsDesk = lazy(() => import('./pages/WeddingOperationsDesk'));
const Employees = lazy(() => import('./pages/Employees'));
const Openings = lazy(() => import('./pages/Openings'));
const Settings = lazy(() => import('./pages/Settings'));
const BroadcastCenter = lazy(() => import('./pages/BroadcastCenter'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const DepartmentHiring = lazy(() => import('./pages/DepartmentHiring'));
const SectionAllocation = lazy(() => import('./pages/SectionAllocation'));
const Footfall = lazy(() => import('./pages/Footfall'));
const PublicFeedback = lazy(() => import('./pages/PublicFeedback'));
const FeedbackQR = lazy(() => import('./pages/FeedbackQR'));
const FeedbackList = lazy(() => import('./pages/FeedbackList'));
const FeedbackCollection = lazy(() => import('./pages/FeedbackCollection'));
const FeedbackQRManagement = lazy(() => import('./pages/FeedbackQRManagement'));
const Divert = lazy(() => import('./pages/Divert'));
const PMView = lazy(() => import('./pages/PMView'));
const CashSettlement = lazy(() => import('./pages/CashSettlement'));
const VmChecklist = lazy(() => import('./pages/VmChecklist'));
const VmDashboard = lazy(() => import('./pages/VmDashboard'));
const TVDisplay = lazy(() => import('./pages/TVDisplay'));
const Greeter = lazy(() => import('./pages/Greeter'));
const Attendance = lazy(() => import('./pages/Attendance'));
const DailyMCheck = lazy(() => import('./pages/DailyMCheck'));
const MCheckReports = lazy(() => import('./pages/MCheckReports'));
const MCheckHistory = lazy(() => import('./pages/MCheckHistory'));
const WeddingCRM = lazy(() => import('./pages/WeddingCRM'));
const TelecallerDashboard = lazy(() => import('./pages/TelecallerDashboard'));
const WeddingTracking = lazy(() => import('./pages/WeddingTracking'));
const SystemAdmin = lazy(() => import('./pages/SystemAdmin'));
const BatchPlan = lazy(() => import('./pages/BatchPlan'));
const DojDesk = lazy(() => import('./pages/DojDesk'));
const CandidateEntry = lazy(() => import('./pages/CandidateEntry'));
const ChatDashboard = lazy(() => import('./pages/ChatDashboard'));
const WeddingCrmDashboard = lazy(() => import('./pages/wedding/WeddingCrmDashboard'));
const WeddingCustomerRegister = lazy(() => import('./pages/wedding/WeddingCustomerRegister'));
const WeddingCustomerDetail = lazy(() => import('./pages/wedding/WeddingCustomerDetail'));
const WeddingCustomerCreate = lazy(() => import('./pages/wedding/WeddingCustomerCreate'));
const TelecallerDeskPage = lazy(() => import('./pages/wedding/TelecallerDeskPage'));
const WeddingCallHistory = lazy(() => import('./pages/wedding/WeddingCallHistory'));
const WeddingFollowUpCalendar = lazy(() => import('./pages/wedding/WeddingFollowUpCalendar'));
const WeddingStatusBoard = lazy(() => import('./pages/wedding/WeddingStatusBoard'));
const WeddingReports = lazy(() => import('./pages/wedding/WeddingReports'));
const WeddingImport = lazy(() => import('./pages/wedding/WeddingImport'));
const WeddingOldCustomers = lazy(() => import('./pages/wedding/WeddingOldCustomers'));
const NoAccess = lazy(() => import('./pages/NoAccess'));
const MadtHome = lazy(() => import('./pages/madt/MadtHome'));
const MadtWedding = lazy(() => import('./pages/madt/MadtWedding'));
const MadtConsult = lazy(() => import('./pages/madt/MadtConsult'));
const MadtContact = lazy(() => import('./pages/madt/MadtContact'));
const MadtDesk = lazy(() => import('./pages/madt/MadtDesk'));
const MadtLogin = lazy(() => import('./pages/madt/MadtLogin'));
const MadtPrivacy = lazy(() => import('./pages/madt/MadtPrivacy'));
const MadtTerms = lazy(() => import('./pages/madt/MadtTerms'));
import ToastContainer from './components/Toast';
import { LocationProvider } from './context/LocationContext';
import RouteGuard from './components/RouteGuard';
import UserTracker from './components/UserTracker';
import ConnectivityBanner from './components/ConnectivityBanner';
import ErrorBoundary from './components/ErrorBoundary';
import ConsentGuard from './components/ConsentGuard';
import { useUrlGuard } from './hooks/useUrlGuard';
import { Auth } from './services/api';
const QuickActionCenter = lazy(() => import('./components/ui/QuickActionCenter'));
const DevToolsGuard = lazy(() => import('./components/DevToolsGuard'));
const SessionTimeoutGuard = lazy(() => import('./components/SessionTimeoutGuard'));
const DesktopModeWarning = lazy(() => import('./components/DesktopModeWarning'));

/** Lightweight Suspense spinner that matches the project theme */
function RouteSuspenseFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-xs font-bold text-primary">
        <div className="w-5 h-5 border-2 border-primary/20 border-t-accent rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

/** Monitors every URL change for unauthorized access — triggers force-logout on violation. */
function UrlGuardMonitor() {
  useUrlGuard();
  return null;
}

/**
 * RouteChangeCleanup — Force-resets stale overlay state on route change.
 * Prevents body scroll lock, stuck blur classes, and sidebar-open state
 * from persisting when the user navigates away from a page with an open modal.
 */
function RouteChangeCleanup() {
  const location = useLocation();
  useEffect(() => {
    // Force-reset body scroll lock on route change
    forceResetBodyScroll();
    // Clear any stale sidebar-open class
    document.body.classList.remove('sidebar-open');
    // Clear any stale inline filter/blur on body
    document.body.style.filter = '';
    (document.body.style as any).webkitFilter = '';
  }, [location.pathname]);
  return null;
}

/** Sets up real-time event listeners for automatic query invalidation */
function RealtimeInvalidationSetup() {
  const { setupListeners } = useRealtimeInvalidation(queryClient);

  useEffect(() => {
    const cleanup = setupListeners();
    return cleanup;
  }, []);

  return null;
}

/**
 * WeddingCustomerRegistrationDispatcher:
 * - Authenticated CRM staff clicking "Add Customer" or navigating to /wedding/customer-registration
 *   get the unified CRM "New Wedding Customer Form" (WeddingCustomerCreate) with store & telecaller assignment.
 * - Public visitors / brides self-registering from marketing links get the public multi-step registration portal (WeddingRegistration).
 */
function WeddingCustomerRegistrationDispatcher() {
  const isAuth = typeof Auth !== 'undefined' && typeof Auth.check === 'function' ? Auth.check() : false;
  if (isAuth) {
    return (
      <RouteGuard pageKey="wedding_registration">
        <WeddingCustomerCreate />
      </RouteGuard>
    );
  }
  return <WeddingRegistration />;
}


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
    <LocationProvider>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastContainer />
      <ConnectivityBanner />
      <UserTracker />
      <UrlGuardMonitor />
      <RouteChangeCleanup />
      <ConsentGuard>
      <RealtimeInvalidationSetup />
      <Suspense fallback={<RouteSuspenseFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/no-access" element={<NoAccess />} />
        <Route path="/dashboard" element={<RouteGuard pageKey="dashboard"><Dashboard /></RouteGuard>} />
        <Route path="/hr-dashboard" element={<RouteGuard pageKey="dashboard"><HRDashboard /></RouteGuard>} />
        <Route path="/manager-dashboard" element={<RouteGuard pageKey="dashboard"><ManagerDashboard /></RouteGuard>} />
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
        <Route path="/wedding-crm/old-customers" element={<RouteGuard pageKey="wedding_crm"><WeddingOldCustomers /></RouteGuard>} />
        <Route path="/wedding/customer-registration" element={<WeddingCustomerRegistrationDispatcher />} />
        <Route path="/wedding/public-registration" element={<WeddingRegistration />} />
        <Route path="/wedding-operations" element={<RouteGuard pageKey="wedding_operations"><WeddingOperationsDesk /></RouteGuard>} />

        {/* Telecaller Dedicated Routes */}
        <Route path="/telecaller/desk" element={<RouteGuard pageKey="telecaller_desk"><TelecallerDeskPage /></RouteGuard>} />
        <Route path="/telecaller/queue" element={<Navigate to="/telecaller/desk" replace />} />
        <Route path="/telecaller/customer/:id" element={<RouteGuard pageKey="wedding_crm"><WeddingCustomerDetail /></RouteGuard>} />
        <Route path="/telecaller-dashboard" element={<RouteGuard pageKey="telecaller_dashboard"><TelecallerDashboard /></RouteGuard>} />

        {/* Job Applicant Public Portals (Distinct from Wedding Customer Registration) */}
        <Route path="/apply" element={<CandidateEntry />} />
        <Route path="/applicants/register" element={<CandidateEntry />} />
        <Route path="/candidate-entry" element={<CandidateEntry />} />
        <Route path="/candidate-registration" element={<Navigate to="/apply" replace />} />

        <Route path="/footfall" element={<RouteGuard pageKey="footfall"><Footfall /></RouteGuard>} />
        <Route path="/feedback" element={<PublicFeedback />} />
        <Route path="/feedback-public" element={<PublicFeedback />} />
        <Route path="/feedback-qr" element={<FeedbackQR />} />
        <Route path="/feedback-qr-management" element={<RouteGuard pageKey="feedback_qr"><FeedbackQRManagement /></RouteGuard>} />
        <Route path="/feedback-list" element={<RouteGuard pageKey="feedback_list"><FeedbackList /></RouteGuard>} />
        <Route path="/feedback-collection" element={<RouteGuard pageKey="feedback_collection"><FeedbackCollection /></RouteGuard>} />
        <Route path="/divert" element={<RouteGuard pageKey="divert"><Divert /></RouteGuard>} />
        <Route path="/pm-view" element={<RouteGuard pageKey="pm_view"><PMView /></RouteGuard>} />
        <Route path="/cash-settlement" element={<CashSettlement />} />
        <Route path="/vm-checklist" element={<RouteGuard pageKey="vm_checklist"><VmChecklist /></RouteGuard>} />
        <Route path="/vm-dashboard" element={<RouteGuard pageKey="vm_checklist"><VmDashboard /></RouteGuard>} />
        <Route path="/tv" element={<TVDisplay />} />
        <Route path="/greeter" element={<RouteGuard pageKey="greeter"><Greeter /></RouteGuard>} />
        <Route path="/attendance" element={<RouteGuard pageKey="attendance"><Attendance /></RouteGuard>} />
        <Route path="/roster" element={<Navigate to="/attendance" replace />} />
        <Route path="/daily-mcheck" element={<RouteGuard pageKey="daily_mcheck"><DailyMCheck /></RouteGuard>} />
        <Route path="/mcheck-reports" element={<RouteGuard pageKey="mcheck_reports"><MCheckReports /></RouteGuard>} />
        <Route path="/mcheck-history" element={<RouteGuard pageKey="mcheck_history"><MCheckHistory /></RouteGuard>} />
        <Route path="/candidates" element={<RouteGuard pageKey="candidates"><Candidates /></RouteGuard>} />
        <Route path="/wedding-registration" element={<Navigate to="/wedding/customer-registration" replace />} />
        <Route path="/track" element={<WeddingTracking />} />
        <Route path="/interview-panel" element={<Navigate to="/candidates" replace />} />
        <Route path="/interview-form" element={<Navigate to="/candidates" replace />} />
        <Route path="/offer-process" element={<RouteGuard pageKey="offer"><OfferProcess /></RouteGuard>} />
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

        {/* MADT House Dedicated Routes */}
        <Route path="/madt" element={<MadtHome />} />
        <Route path="/madt/wedding" element={<MadtWedding />} />
        <Route path="/madt/consult" element={<MadtConsult />} />
        <Route path="/madt/contact" element={<MadtContact />} />
        <Route path="/madt/desk" element={<MadtDesk />} />
        <Route path="/madt/login" element={<MadtLogin />} />
        <Route path="/madt/privacy" element={<MadtPrivacy />} />
        <Route path="/madt/terms" element={<MadtTerms />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </ConsentGuard>
      <Suspense fallback={null}>
        <QuickActionCenter />
        <SessionTimeoutGuard />
        <DevToolsGuard />
        <DesktopModeWarning />
      </Suspense>
      <ToastContainer />
    </Router>
    </LocationProvider>
    </ErrorBoundary>
    </QueryClientProvider>
  );
}
