import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Auth, UserSession } from '../services/api';
import {
  BarChart3,
  Users,
  Target,
  FileText,
  LogOut,
  ClipboardList,
  Settings,
  UserCheck,
  Briefcase,
  ChevronRight,
  Sparkles,
  Megaphone,
  SquareCheck,
  Menu,
  Shield,
  ShieldAlert,
  PhoneCall,
  Heart,
  X,
  KeyRound,
  Globe
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ChangePasswordModal from './ui/ChangePasswordModal';
import {
  getSidebarCollapsed,
  setSidebarCollapsed,
  subscribeSidebarCollapsed
} from '../utils/sidebarState';
import { getDashboardLabelForRole, getDashboardRouteForRole } from '../utils/dashboardRouting';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { useLocationContext } from '../context/LocationContext';
import { permissionsCache } from '../context/PermissionsCache';

interface SidebarProps {
  session: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  isNew?: boolean;
  hint?: string;
  target?: string;
}

export default function Sidebar({ session, isOpen, onClose }: SidebarProps) {
  const pathname = useLocation().pathname;
  const role = session?.role || 'HR';
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);

  const locCtx = useLocationContext();
  const isAdminRole = ['Admin', 'Super Admin'].includes(session?.role || '');
  const isGlobalUser = locCtx.isGlobalAdmin && isAdminRole && (!session?.locationId || session?.isGlobalAdmin === true);
  const activeLocationLabel = locCtx
    ? (locCtx.currentLocation === 'ALL' && isGlobalUser)
      ? 'ALL LOCATIONS'
      : (locCtx.currentLocationLabel || session?.locationName || 'STORE').toUpperCase()
    : 'ALL LOCATIONS';

  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => {
      setCollapsed(c);
    });
    return unsub;
  }, []);

  // Escape key closes mobile sidebar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock when mobile sidebar drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('sidebar-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('sidebar-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('sidebar-open');
    };
  }, [isOpen]);

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    setSidebarCollapsed(next);
  };

  // Auto-scroll active nav item into view
  useEffect(() => {
    if (!navScrollRef.current) return;
    const container = navScrollRef.current;
    const timer = setTimeout(() => {
      const activeLink = container.querySelector('[data-active="true"]');
      if (activeLink) {
        const containerRect = container.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const offset = linkRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: Math.max(0, offset - 12), behavior: 'smooth' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Single source of truth shared with RouteGuard
  const [allowed, setAllowed] = useState<string[]>(() => {
    if (session?.modules && Array.isArray(session.modules) && session.modules.length > 0) {
      return resolveAllowedPages(role, null, session.modules);
    }
    return getRoleNavMap(role);
  });

  const roleLabels: Record<string, string> = {
    'Super Admin': 'Super Administrator',
    'Admin':       'Administrator',
    'Manager':     'Store Manager',
    'HR':          'HR Specialist',
    'VM':          'Visual Merchandiser',
    'Greeter':     'Greeter Desk',
    'CRM Executive': 'CRM Executive',
    'CRM Manager': 'CRM Manager',
    'Data Analyst': 'Data Analyst',
    'Telecaller':  'Telecaller Workspace',
    'VM Extension Telecaller': 'VM Telecaller Workspace',
    'Floor Manager': 'Floor Manager',
    'Wedding Collection Manager': 'Wedding Collection Head',
    'Team Lead':   'Team Lead / Calling Desk',
    'Recruiter':   'Recruiter',
    'Interviewer': 'Interviewer Panel',
    'HR Manager':  'HR Manager',
    'Employee':    'Employee',
    'Guest':       'Guest'
  };

  const dashboardHref = getDashboardRouteForRole(role);

  const navItems: NavItem[] = [
    // Overview (formerly Enterprise)
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: BarChart3, section: 'Overview' },
    { key: 'regional_analytics', href: '/dashboard', label: 'Regional Analytics', icon: BarChart3, section: 'Overview' },
    { key: 'employees', href: '/employees', label: 'Employee & Store Directory', icon: UserCheck, section: 'Overview' },
    { key: 'greyhr', href: '/employees', label: 'GreyHR Sync', icon: UserCheck, section: 'Overview' },
    { key: 'user_management', href: '/user-management', label: 'User Management', icon: Shield, section: 'Overview' },
    { key: 'attendance', href: '/attendance', label: 'Attendance & Roster', icon: UserCheck, section: 'Overview' },

    // Store Operations
    { key: 'wedding_crm', href: '/wedding-crm/dashboard', label: 'Wedding CRM', icon: Sparkles, section: 'Store Operations', isNew: true },
    { key: 'wedding_registration', href: '/wedding/customer-registration', label: 'Wedding Customer Registration', icon: Heart, section: 'Store Operations' },
    { key: 'telecaller_desk', href: '/telecaller/desk', label: 'Telecaller Calling Desk', icon: PhoneCall, section: 'Store Operations' },
    { key: 'telecaller_dashboard', href: '/telecaller-dashboard', label: 'Telecaller Dashboard', icon: BarChart3, section: 'Store Operations' },
    { key: 'footfall', href: '/footfall', label: 'Hourly Footfall', icon: BarChart3, section: 'Store Operations' },
    { key: 'feedback_collection', href: '/feedback-collection', label: 'Feedback Collection', icon: FileText, section: 'Store Operations', hint: 'View CSAT submissions' },
    { key: 'feedback_list', href: '/feedback-list', label: 'Feedback Call Queue', icon: PhoneCall, section: 'Store Operations' },
    { key: 'feedback_qr', href: '/feedback-qr-management', label: 'Feedback QR Code', icon: ClipboardList, section: 'Store Operations' },

    // Talent
    { key: 'candidates', href: '/candidates', label: 'Candidate CRM', icon: Users, section: 'Talent' },
    { key: 'openings', href: '/openings', label: 'Manpower Planning', icon: Briefcase, section: 'Talent' },
    { key: 'section_allocation', href: '/section-allocation', label: 'Section Allocation', icon: UserCheck, section: 'Talent' },
    { key: 'offer', href: '/offer-process', label: 'Offer Desk', icon: FileText, section: 'Talent' },
    { key: 'doj_desk', href: '/doj-desk', label: 'DOJ Not Joined Desk', icon: UserCheck, section: 'Talent' },
    { key: 'joining_desk', href: '/doj-desk', label: 'Store Joining Desk', icon: UserCheck, section: 'Talent' },
    { key: 'dept_hiring', href: '/department-hiring', label: 'Department Hiring Status', icon: Briefcase, section: 'Talent' },

    // Daily Operations
    { key: 'daily_mcheck', href: '/daily-mcheck', label: 'MCheck Store Audit', icon: SquareCheck, section: 'Daily Operations' },
    { key: 'mcheck_audit', href: '/daily-mcheck', label: 'MCheck Store Audit', icon: SquareCheck, section: 'Daily Operations' },
    { key: 'mcheck_reports', href: '/mcheck-reports', label: 'MCheck Reports', icon: BarChart3, section: 'Daily Operations' },
    { key: 'mcheck_history', href: '/mcheck-history', label: 'MCheck History', icon: ClipboardList, section: 'Daily Operations' },
    { key: 'divert', href: '/divert', label: 'Sourcing Diverts', icon: Target, section: 'Daily Operations' },
    { key: 'batch_plan', href: '/batch-plan', label: 'Batch Plan', icon: FileText, section: 'Daily Operations' },
    { key: 'pm_view', href: '/pm-view', label: 'Purchase Manager View', icon: Briefcase, section: 'Daily Operations' },
    { key: 'vm_checklist', href: '/vm-checklist', label: 'VM Checklist', icon: ClipboardList, section: 'Daily Operations' },
    { key: 'vm_dashboard', href: '/vm-dashboard', label: 'VM Dashboard', icon: BarChart3, section: 'Daily Operations' },

    // Administration
    { key: 'broadcast', href: '/broadcast-center', label: 'Broadcast Center', icon: Megaphone, section: 'Administration' },
    { key: 'settings', href: '/settings', label: 'System Settings', icon: Settings, section: 'Administration' },
    { key: 'system_admin', href: '/system-admin', label: 'System Administrator', icon: ShieldAlert, section: 'Administration' },

    // Public Portals
    { key: 'candidate_apply', href: '/apply', label: 'Job Applicant Registration', icon: UserCheck, section: 'Public Portals' },
    { key: 'feedback_public', href: '/feedback-public', label: 'Customer Feedback QR', icon: ClipboardList, section: 'Public Portals' },
    { key: 'tv', href: '/tv', label: 'Live TV Kiosk', icon: BarChart3, section: 'Public Portals' },
    { key: 'greeter', href: '/greeter', label: 'Greeter Kiosk', icon: UserCheck, section: 'Public Portals' }
  ];

  useEffect(() => {
    const updateAllowed = () => {
      try {
        const stored = localStorage.getItem('bsc_user_session') || localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed?.modules) && parsed.modules.length > 0) {
            setAllowed(resolveAllowedPages(role, null, parsed.modules));
          }
        }
      } catch {
        // ignore
      }

      permissionsCache.get().then(({ myPerms, pageSettings }) => {
        const userModules = myPerms?.custom && Array.isArray(myPerms.modules)
          ? myPerms.modules
          : (session?.modules && session.modules.length > 0 ? session.modules : null);
        setAllowed(resolveAllowedPages(role, pageSettings, userModules));
      }).catch((err) => {
        console.error('[Sidebar] Failed to load permissions:', err);
        if (session?.modules && Array.isArray(session.modules) && session.modules.length > 0) {
          setAllowed(resolveAllowedPages(role, null, session.modules));
        } else {
          setAllowed(getRoleNavMap(role));
        }
      });
    };

    updateAllowed();

    const handlePermissionsUpdated = () => {
      permissionsCache.invalidate();
      updateAllowed();
    };

    window.addEventListener('permissions-updated', handlePermissionsUpdated);
    window.addEventListener('bsc_auth_changed', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('permissions-updated', handlePermissionsUpdated);
      window.removeEventListener('bsc_auth_changed', handlePermissionsUpdated);
    };
  }, [role, session]);

  const initials = session?.fullName
    ? session.fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#0B2924]/75 z-40 lg:hidden transition-opacity backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Main Sidebar Shell ────────────────────────────────────────────── */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={`
          fixed top-0 left-0 bottom-0 bg-[#123C35] text-white z-50 flex flex-col transition-all duration-300 shadow-2xl border-r border-white/10 overscroll-contain overflow-hidden
          w-[min(85vw,320px)] lg:max-w-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-[270px]'}
        `}
      >
        {/* ── 1. Fixed Header ─────────────────────────────────────────────── */}
        <div className="p-3 sm:p-3.5 border-b border-white/10 flex items-center justify-between min-h-[64px] sm:min-h-[68px] w-full bg-[#0B2924]/60 shrink-0">
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'lg:hidden' : 'flex'}`}>
            <div className="w-9 h-9 rounded-lg bg-white p-1 shadow-sm border border-[#C9A45C]/40 flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="BSC Logo"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-white tracking-wider leading-tight uppercase truncate">
                BSC Textiles
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 flex items-center gap-1 truncate text-[#E4CB92]">
                <Globe className="w-2.5 h-2.5 text-[#C9A45C] shrink-0" />
                <span className="truncate">{activeLocationLabel}</span>
              </div>
            </div>
          </div>

          {/* Desktop Collapsed View Only (Icon and Logo) */}
          {collapsed && (
            <div className="hidden lg:flex flex-col items-center justify-center w-full gap-2 py-1">
              <button
                type="button"
                onClick={handleToggle}
                className="p-1.5 rounded-xl text-[#C9A45C] hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer shadow-xs border border-white/10"
                title="Expand navigation menu"
                aria-label="Expand sidebar"
              >
                <Menu className="w-5 h-5 text-[#C9A45C]" />
              </button>
              <div
                className="w-9 h-9 rounded-lg bg-white p-1 shadow-sm border border-[#C9A45C]/40 hover:scale-105 transition-transform cursor-pointer flex items-center justify-center shrink-0"
                onClick={handleToggle}
                title="BSC Logo - Click to expand navigation"
              >
                <img
                  src="/logo.png"
                  alt="BSC Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Header Action: Close button on mobile; Collapse toggle on desktop */}
          <div className="flex items-center gap-1">
            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close navigation"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Desktop Collapse Toggle */}
            {!collapsed && (
              <button
                type="button"
                onClick={handleToggle}
                className="hidden lg:flex p-1.5 rounded-xl text-[#C9A45C] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer border border-white/10 shadow-xs"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <Menu className="w-5 h-5 text-[#C9A45C]" />
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Fixed User Profile Card ──────────────────────────────────── */}
        <div className={`mx-3 my-2.5 rounded-xl bg-[#0B2924]/60 border border-white/[0.08] flex items-center transition-all shrink-0 ${
          collapsed ? 'lg:mx-1.5 p-1.5 justify-center' : 'p-2.5 gap-2.5'
        }`}>
          <div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A45C] to-[#B88F45] text-[#0B2924] font-black flex items-center justify-center text-xs shadow-sm border border-[#E4CB92]/40 shrink-0"
            title={`${session?.fullName || 'User'} (${role})`}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="font-bold text-xs text-white truncate">
                {session?.fullName || 'System Administrator'}
              </div>
              <div className="text-[10px] text-[#E4CB92] font-semibold truncate mt-0.5">
                {roleLabels[role] || role}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Scrollable Navigation Content ────────────────────────────── */}
        <div
          ref={navScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar px-3 py-2 space-y-4"
        >
          {['Overview', 'Store Operations', 'Talent', 'Daily Operations', 'Administration', 'Public Portals'].map((section) => {
            const rawItems = navItems.filter((item) => item.section === section && allowed.includes(item.key));
            if (rawItems.length === 0) return null;

            // Deduplicate items by href
            const items: NavItem[] = [];
            const seenHrefs = new Set<string>();
            for (const it of rawItems) {
              if (!seenHrefs.has(it.href)) {
                seenHrefs.add(it.href);
                items.push(it);
              }
            }

            return (
              <div key={section} className="space-y-1">
                {collapsed ? (
                  <div className="h-px bg-white/10 my-2 mx-1" />
                ) : (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#E4CB92]/90 px-3 mb-1.5">
                    <span>{section}</span>
                  </div>
                )}

                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.key === 'dashboard' && pathname === dashboardHref);

                    return (
                      <Link
                        key={item.key}
                        to={item.href}
                        target={item.target}
                        onClick={onClose}
                        title={item.hint ? `${item.label} — ${item.hint}` : item.label}
                        data-active={isActive ? 'true' : undefined}
                        className={`
                          flex items-center rounded-xl text-xs font-semibold transition-colors duration-150 group relative
                          ${collapsed ? 'justify-center p-2.5 my-1' : 'px-3 py-2.5 justify-between my-0.5'}
                          ${isActive
                            ? 'bg-[#C9A45C] text-[#0B2924] font-bold shadow-sm'
                            : 'text-white/80 hover:bg-white/[0.08] hover:text-white'}
                        `}
                      >
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                          <Icon
                            className={`w-[18px] h-[18px] shrink-0 transition-transform ${
                              isActive ? 'text-[#0B2924]' : 'text-[#C9A45C] group-hover:text-white'
                            }`}
                          />

                          {!collapsed && (
                            <span className="min-w-0 truncate">
                              <span className="block truncate">{item.label}</span>
                              {item.hint && (
                                <span className="block truncate text-[9px] font-medium leading-tight text-white/60">
                                  {item.hint}
                                </span>
                              )}
                            </span>
                          )}

                          {!collapsed && item.isNew && (
                            <span className="border border-[#C9A45C]/50 bg-[#C9A45C]/20 text-[#E4CB92] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ml-auto mr-1 shrink-0">
                              NEW
                            </span>
                          )}
                        </div>

                        {!collapsed && isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-[#0B2924]/70 shrink-0 ml-1" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 4. Fixed Footer Actions ─────────────────────────────────────── */}
        <div className={`border-t border-white/10 bg-[#082821]/90 shrink-0 space-y-1.5 transition-all ${
          collapsed ? 'p-2' : 'p-3'
        }`}>
          <button
            type="button"
            onClick={() => setChangePasswordOpen(true)}
            title="Update Password"
            className={`w-full flex items-center justify-center rounded-xl text-xs font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-[#E4CB92] hover:text-white transition-all cursor-pointer ${
              collapsed ? 'py-2.5 px-0' : 'py-2 px-3 gap-2'
            }`}
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Update Password</span>}
          </button>

          <button
            type="button"
            onClick={() => Auth.logout()}
            title="Sign Out Session"
            className={`w-full flex items-center justify-center rounded-xl text-xs font-semibold border border-[#C83B4A]/25 bg-[#C83B4A]/10 hover:bg-[#C83B4A] text-white/90 hover:text-white transition-all cursor-pointer ${
              collapsed ? 'py-2.5 px-0' : 'py-2 px-3 gap-2'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>

          {!collapsed && (
            <div className="text-[10px] text-white/40 tracking-wider text-center pt-1 font-medium select-none">
              BSC Exclusive CRM · Enterprise Suite
            </div>
          )}
        </div>
      </aside>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        session={session}
      />
    </>
  );
}
