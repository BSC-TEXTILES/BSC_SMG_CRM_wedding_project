import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Topbar from '../Topbar';
import ToastContainer from '../Toast';
import { Auth, UserSession } from "../../services/api";
import { Plus, X, UserCheck, BarChart3, Target, PhoneCall, Zap, QrCode } from 'lucide-react';

import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import { BreadcrumbCrumb } from '../../utils/breadcrumbs';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Optional dynamic sub-crumb(s) under the route-derived page crumb. */
  breadcrumbs?: BreadcrumbCrumb[] | null;
  hideBreadcrumbs?: boolean;
  rightElement?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  breadcrumbs = [],
  hideBreadcrumbs,
  rightElement
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
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
    <div className="min-h-screen bg-[#F6F4EF] flex relative select-text w-full overflow-x-hidden">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 w-full transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          hideBreadcrumbs={hideBreadcrumbs}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={rightElement}
        />

        <main className="flex-1 w-full min-w-0 max-w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
