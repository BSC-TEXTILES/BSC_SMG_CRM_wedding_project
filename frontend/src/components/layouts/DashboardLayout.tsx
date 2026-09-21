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
  rightElement?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  breadcrumbs = [],
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
    <div className="min-h-screen bg-background flex relative select-text">
      <ToastContainer />

      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
          rightElement={rightElement}
        />

        <main className="p-4 lg:p-6 space-y-4 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile Floating Quick Action Speed Dial (FAB) — parked above the global Quick Action FAB */}
      <div className="fixed bottom-24 right-6 z-40 sm:hidden">
        {speedDialOpen && (
          <div className="mb-3 space-y-2.5 animate-scale-in flex flex-col items-end">
            <button
              onClick={() => { setSpeedDialOpen(false); window.open('/greeter', '_blank'); }}
              className="px-4 py-2.5 rounded-2xl bg-primary text-accent text-xs font-black shadow-xl border border-accent/40 flex items-center gap-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Greeter Entrance Kiosk</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/footfall'); }}
              className="px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-black shadow-xl border border-accent/20 flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4 text-accent" />
              <span>Hourly Footfall Register</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/divert'); }}
              className="px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-black shadow-xl border border-accent/20 flex items-center gap-2"
            >
              <Target className="w-4 h-4 text-accent" />
              <span>Sourcing Diverts</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/feedback-list'); }}
              className="px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-black shadow-xl border border-accent/20 flex items-center gap-2"
            >
              <PhoneCall className="w-4 h-4 text-status-success" />
              <span>Feedback Call Queue</span>
            </button>

            <button
              onClick={() => { setSpeedDialOpen(false); navigate('/feedback-qr'); }}
              className="px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-black shadow-xl border border-accent/20 flex items-center gap-2"
            >
              <QrCode className="w-4 h-4 text-accent-light" />
              <span>Feedback QR Code</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setSpeedDialOpen(!speedDialOpen)}
          className={`w-14 h-14 rounded-full bg-primary text-accent shadow-2xl flex items-center justify-center border-2 border-accent/50 transition-transform active:scale-95 ${
            speedDialOpen ? 'rotate-45 bg-status-danger text-white' : ''
          }`}
          title="Quick Store Action Speed Dial"
        >
          <Zap className="w-6 h-6 fill-accent" />
        </button>
      </div>
    </div>
  );
}
