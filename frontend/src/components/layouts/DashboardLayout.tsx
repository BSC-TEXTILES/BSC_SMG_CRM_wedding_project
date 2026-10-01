import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../Sidebar';
import Topbar from '../Topbar';
import ToastContainer from '../Toast';
import PageContainer from '../ui/PageContainer';
import { Auth, UserSession } from '../../services/api';

import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import { BreadcrumbCrumb } from '../../utils/breadcrumbs';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Optional dynamic sub-crumb(s) under the route-derived page crumb. */
  breadcrumbs?: BreadcrumbCrumb[] | null;
  hideBreadcrumbs?: boolean;
  hideTopbar?: boolean;
  rightElement?: React.ReactNode;
  noPadding?: boolean;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  breadcrumbs = [],
  hideBreadcrumbs,
  hideTopbar = false,
  rightElement,
  noPadding = false
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => setCollapsed(c));
    return unsub;
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
  }, [navigate]);

  return (
    <div className="h-screen h-[100dvh] max-h-screen bg-[#F7F4ED] flex relative select-text w-full max-w-full overflow-hidden">
      <ToastContainer />

      {/* Global Sidebar Shell */}
      <Sidebar
        session={session}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area: Resizes smoothly with sidebar collapse */}
      <div
        className={`flex-1 flex flex-col min-w-0 w-full h-full max-h-full overflow-hidden transition-all duration-300 ${
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[270px]'
        }`}
      >
        {!hideTopbar ? (
          <Topbar
            title={title}
            breadcrumbs={breadcrumbs}
            hideBreadcrumbs={hideBreadcrumbs}
            session={session}
            onMenuClick={() => setSidebarOpen(true)}
            rightElement={rightElement}
          />
        ) : (
          <div className="lg:hidden h-14 px-4 flex items-center justify-between bg-white border-b border-[#E2DDD2] sticky top-0 z-30 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#123C35] text-white hover:bg-[#0B2924] active:scale-95 transition-all shadow-xs border border-[#123C35] cursor-pointer"
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <span className="text-sm font-bold text-[#182033] truncate max-w-[200px]">{title}</span>
            <div className="w-10" />
          </div>
        )}

        <main className="flex-1 w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden custom-scrollbar focus:outline-none">
          {noPadding ? (
            children
          ) : (
            <PageContainer maxWidth="full">
              {children}
            </PageContainer>
          )}
        </main>
      </div>
    </div>
  );
}
