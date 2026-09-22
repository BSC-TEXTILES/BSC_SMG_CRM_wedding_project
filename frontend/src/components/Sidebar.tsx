import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API, Auth, UserSession } from '../services/api';
import { BarChart3, Users, Target, FileText, PartyPopper, LogOut, ClipboardList, Settings, DoorOpen, UserCheck, Briefcase, ChevronRight, Sparkles, Megaphone, SquareCheck, Menu, Shield, ShieldAlert, PhoneCall, Heart, Calendar, History } from 'lucide-react';
import { 
  getSidebarCollapsed, 
  setSidebarCollapsed, 
  subscribeSidebarCollapsed 
} from '../utils/sidebarState';
import { getDashboardLabelForRole } from '../utils/dashboardRouting';
import { getRoleNavMap, resolveAllowedPages } from '../utils/rbac';
import { useLocationContext } from '../context/LocationContext';
import { permissionsCache } from '../context/PermissionsCache';

interface SidebarProps {
  session: UserSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ session, isOpen, onClose }: SidebarProps) {
  const pathname = useLocation().pathname;
  const role = session?.role || 'HR';
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const navScrollRef = useRef<HTMLDivElement>(null);

  const locCtx = useLocationContext();
  const activeLocationLabel = locCtx
    ? locCtx.currentLocation === 'ALL'
      ? '🌐 ALL LOCATIONS'
      : `📍 ${(locCtx.currentLocationLabel || session?.locationName || 'STORE').toUpperCase()}`
    : '';

  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => {
      setCollapsed(c);
    });
    return unsub;
  }, []);

  // ── Escape key closes mobile sidebar ────────────────────────────
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

  // ── Body scroll lock when mobile sidebar is open ────────────────
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

  // Auto-scroll the active nav item to the top of the sidebar
  useEffect(() => {
    if (!navScrollRef.current) return;
    const container = navScrollRef.current;
    // Small delay to ensure the DOM has updated after navigation
    const timer = setTimeout(() => {
      const activeLink = container.querySelector('[data-active="true"]');
      if (activeLink) {
        const containerRect = container.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const offset = linkRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: Math.max(0, offset - 8), behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Single source of truth shared with RouteGuard (utils/rbac.ts)
  const [allowed, setAllowed] = useState<string[]>(() => getRoleNavMap(role));

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
    'Employee':    'Employee',
    'Guest':       'Guest'
  };

  const isTelecallerRole = [
    'telecaller', 'caller', 'tele-caller', 'tele caller',
    'vm extension telecaller', 'vm telecaller'
  ].includes((role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' '));

  const navItems = [
    // Enterprise (Admin landing module at top)
    { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: BarChart3, section: 'Enterprise' },
    { key: 'employees', href: '/employees', label: 'Employee & Store Directory', icon: UserCheck, section: 'Enterprise' },
    { key: 'user_management', href: '/user-management', label: 'User Management', icon: Shield, section: 'Enterprise' },
    { key: 'attendance', href: '/attendance', label: 'Attendance & Roster', icon: UserCheck, section: 'Enterprise' },

    // Store Operations
    { key: 'wedding_crm', href: '/wedding-crm/dashboard', label: 'Wedding CRM', icon: Sparkles, section: 'Store Operations', isNew: true },
    { key: 'wedding_registration', href: '/wedding/customer-registration', label: 'Wedding Customer Registration', icon: Heart, section: 'Store Operations' },
    { key: 'telecaller_desk', href: '/telecaller/desk', label: 'Telecaller Desk', icon: PhoneCall, section: 'Store Operations', isNew: true },
    { key: 'telecaller_dashboard', href: '/telecaller-dashboard', label: 'Telecaller Dashboard', icon: BarChart3, section: 'Store Operations' },
    { key: 'wedding_operations', href: '/wedding-operations', label: 'Wedding Operations', icon: FileText, section: 'Store Operations' },
    { key: 'footfall', href: '/footfall', label: 'Hourly Footfall', icon: BarChart3, section: 'Store Operations' },
    { key: 'feedback_collection', href: '/feedback-collection', label: 'Feedback Collection', icon: FileText, section: 'Store Operations' },
    { key: 'feedback_list', href: '/feedback-list', label: 'Feedback Call Queue', icon: FileText, section: 'Store Operations' },
    { key: 'feedback_qr', href: '/feedback-qr-management', label: 'Feedback QR Code', icon: ClipboardList, section: 'Store Operations' },
    { key: 'divert', href: '/divert', label: 'Sourcing Diverts', icon: Target, section: 'Store Operations' },
    { key: 'pm_view', href: '/pm-view', label: 'Purchase Manager View', icon: Briefcase, section: 'Store Operations' },
    { key: 'vm_checklist', href: '/vm-checklist', label: 'VM Checklist', icon: ClipboardList, section: 'Store Operations' },

    // Talent
    { key: 'candidates', href: '/candidates', label: 'Candidate CRM', icon: Users, section: 'Talent' },
    { key: 'offer', href: '/offer-process', label: 'Offer Desk', icon: FileText, section: 'Talent' },
    { key: 'openings', href: '/openings', label: 'Manpower Planning', icon: Briefcase, section: 'Talent' },
    { key: 'dept_hiring', href: '/department-hiring', label: 'Department Hiring Status', icon: Briefcase, section: 'Talent' },
    { key: 'section_allocation', href: '/section-allocation', label: 'Section Allocation', icon: UserCheck, section: 'Talent' },

    // Daily Operations
    { key: 'daily_mcheck', href: '/daily-mcheck', label: 'MCheck Store Audit', icon: SquareCheck, section: 'Daily Operations' },
    { key: 'mcheck_reports', href: '/mcheck-reports', label: 'MCheck Reports', icon: BarChart3, section: 'Daily Operations' },
    { key: 'mcheck_history', href: '/mcheck-history', label: 'MCheck History', icon: ClipboardList, section: 'Daily Operations' },

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
      permissionsCache.get().then(({ myPerms, pageSettings }) => {
        const userModules = myPerms?.custom && Array.isArray(myPerms.modules) ? myPerms.modules : null;
        setAllowed(resolveAllowedPages(role, pageSettings, userModules));
      }).catch((err) => {
        console.error('[Sidebar] Failed to load permissions:', err);
        setAllowed(getRoleNavMap(role));
      });
    };

    updateAllowed();

    const handlePermissionsUpdated = () => {
      permissionsCache.invalidate();
      updateAllowed();
    };

    window.addEventListener('permissions-updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('permissions-updated', handlePermissionsUpdated);
    };
  }, [role]);

  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : role.slice(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-primary/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label="Main navigation"
        style={{ width: collapsed ? '72px' : '256px' }}
        className={`
          fixed top-0 left-0 bottom-0 bg-[#101C36] text-white z-50 flex flex-col transition-all duration-300 shadow-2xl border-r border-[#C9A45C]/20 overscroll-contain
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-[72px]' : 'w-64'}
        `}
      >
        {/* Header: Collapsed shows ONLY 3-lines + logo; Expanded shows Logo + Text + 3-line Toggle */}
        {collapsed ? (
          <div className="p-3 border-b border-[#C9A45C]/15 flex flex-col items-center justify-center min-h-[64px] gap-2.5">
            {/* 3-line hamburger button prominently displayed at top */}
            <button
              type="button"
              onClick={handleToggle}
              className="p-1.5 rounded-xl text-[#C9A45C] hover:text-white hover:bg-[#07101F] transition-colors flex items-center justify-center cursor-pointer shadow-xs border border-[#C9A45C]/30"
              title="Expand navigation menu (3 lines)"
              aria-label="Expand sidebar"
            >
              <Menu className="w-5 h-5 text-[#C9A45C]" />
            </button>
            {/* ONLY LOGO */}
            <img 
              src="/logo.png" 
              alt="BSC Logo" 
              className="w-9 h-9 object-contain rounded-xl bg-white p-1 shadow-md border border-[#C9A45C]/40 hover:scale-105 transition-transform cursor-pointer"
              onClick={handleToggle}
              title="BSC Logo - Click to expand navigation"
            />
          </div>
        ) : (
          <div className="p-3.5 border-b border-[#C9A45C]/15 flex items-center justify-between min-h-[64px] w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <img 
                src="/logo.png" 
                alt="BSC Logo" 
                className="w-10 h-10 object-contain rounded-xl bg-white p-1 shadow-md border border-[#C9A45C]/30 flex-shrink-0" 
              />
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-white tracking-wide leading-tight truncate">BSC EXCLUSIVE</div>
                <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1 truncate text-[#E4C982]">
                  {activeLocationLabel ? (
                    <span className={activeLocationLabel.includes('ALL') ? 'text-[#16805B] font-extrabold truncate' : 'truncate text-[#E4C982]'}>
                      {activeLocationLabel}
                    </span>
                  ) : session?.isGlobalAdmin ? (
                    <span className="text-[#16805B] font-extrabold truncate">🌐 ALL LOCATIONS</span>
                  ) : (
                    <span className="truncate text-[#E4C982]">📍 {session?.locationName?.toUpperCase() || 'DAVANAGERE'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 3-line menu toggle button */}
            <button
              type="button"
              onClick={handleToggle}
              className="p-1.5 rounded-xl text-[#C9A45C] hover:text-white hover:bg-[#07101F] transition-colors flex-shrink-0 cursor-pointer border border-[#C9A45C]/30 shadow-xs"
              title="Collapse sidebar to logo only (3 lines)"
              aria-label="Toggle sidebar collapse"
            >
              <Menu className="w-5 h-5 text-[#C9A45C]" />
            </button>
          </div>
        )}

        {/* User Card */}
        <div className={`mx-2 my-2 rounded-xl bg-[#07101F]/80 border border-[#C9A45C]/25 flex items-center shadow-inner transition-all ${
          collapsed ? 'p-1 justify-center' : 'p-2.5 gap-2.5'
        }`}>
          <div 
            className="w-8 h-8 rounded-lg bg-[#C9A45C] text-[#07101F] font-black flex items-center justify-center text-xs shadow-md border border-[#E4CB92] flex-shrink-0"
            title={`${session?.fullName || 'User'} (${role})`}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <div className="font-bold text-xs text-white truncate">{session?.fullName || 'HR Manager'}</div>
              <div className="text-[10px] text-[#E4CB92] font-semibold truncate">{roleLabels[role] || role}</div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <div ref={navScrollRef} className="flex-1 overflow-y-auto px-2 py-1.5 space-y-3">
          {['Enterprise', 'Store Operations', 'Talent', 'Daily Operations', 'Administration', 'Public Portals'].map(section => {
            // Strict RBAC rendering: only keys resolved for THIS user
            const items = navItems.filter(item => item.section === section && allowed.includes(item.key));
            if (items.length === 0) return null;

            return (
              <div key={section} className="space-y-0.5">
                {collapsed ? (
                  <div className="h-px bg-[#C9A45C]/20 my-1.5 mx-1" />
                ) : (
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#E4CB92] px-2.5 mb-1">
                    <span>{section}</span>
                  </div>
                )}

                <div className="space-y-1">
                  {items.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.key}
                        to={item.href}
                        target={(item as any).target}
                        onClick={onClose}
                        title={item.label}
                        data-active={isActive ? 'true' : undefined}
                        className={`
                          flex items-center rounded-xl text-xs font-bold transition-all duration-150 group relative
                          ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 justify-between'}
                          ${isActive 
                            ? 'bg-[#C9A45C] text-[#07101F] shadow-md shadow-[#C9A45C]/20 font-black border-l-4 border-[#07101F]' 
                            : 'text-white/80 hover:bg-[#07101F] hover:text-[#E4CB92]'}
                        `}
                      >
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                          <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 flex-shrink-0 ${
                            isActive ? 'text-[#07101F]' : item.key === 'wedding_crm' ? 'text-[#C9A45C]' : 'text-white/70 group-hover:text-[#E4CB92]'
                          }`} />
                          
                          {!collapsed && (
                            <span className="truncate">
                              {item.label}
                            </span>
                          )}

                          {!collapsed && item.key === 'wedding_crm' && (
                            <span className="text-[8px] bg-[#07101F] text-[#E4CB92] font-black px-1.5 py-[2px] rounded-full uppercase ml-1 flex-shrink-0 shadow-xs border border-[#C9A45C]/40">
                              NEW
                            </span>
                          )}
                        </div>

                        {!collapsed && isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-[#07101F] opacity-90 flex-shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Logout */}
        <div className={`border-t border-[#C9A45C]/15 bg-[#07101F]/90 transition-all ${collapsed ? 'p-2' : 'p-3'}`}>
          <button
            onClick={() => Auth.logout()}
            title="Sign Out Session"
            className={`w-full flex items-center justify-center rounded-xl text-xs font-bold bg-[#C7374A]/15 text-white border border-[#C7374A]/30 hover:bg-[#C7374A] hover:text-white transition-all shadow-sm ${
              collapsed ? 'py-2.5 px-0' : 'py-2.5 px-3 gap-2'
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
          {!collapsed && (
            <div className="text-[8.5px] text-white/60 text-center mt-2 font-medium">
              BSC Exclusive CRM · Enterprise Suite
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
