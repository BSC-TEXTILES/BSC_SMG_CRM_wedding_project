import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../Sidebar';
import Topbar from '../Topbar';
import ToastContainer from '../Toast';
import PageContainer from '../ui/PageContainer';
import { Auth, UserSession } from "../../services/api";

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
    <div className="min-h-screen min-h-[100dvh] bg-[#FFF7F2] flex relative select-text w-full overflow-x-hidden">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 w-full transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
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
          <div className="lg:hidden h-12 px-4 flex items-center justify-between bg-[#FFF7F2] border-b border-[#E8D9D4] sticky top-0 z-30 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#4A173A] text-white hover:bg-[#6A2853] active:scale-95 transition-all shadow-sm border border-[#4A173A]"
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <span className="text-xs font-black text-[#4A173A] truncate max-w-[200px]">{title}</span>
            <div className="w-9" />
          </div>
        )}

        <main className="flex-1 w-full min-w-0 max-w-full overflow-y-auto">
          {noPadding ? children : (
            <PageContainer maxWidth="full">
              {children}
            </PageContainer>
          )}
        </main>
      </div>
    </div>
  );
}
