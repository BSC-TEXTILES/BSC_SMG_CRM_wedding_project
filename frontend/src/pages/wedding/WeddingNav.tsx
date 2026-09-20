import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  PhoneCall,
  History,
  Calendar,
  Kanban,
  BarChart3,
  FileSpreadsheet,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface WeddingNavProps {
  currentPageTitle: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export default function WeddingNav({ currentPageTitle, breadcrumbs, actions }: WeddingNavProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navLinks = [
    { href: '/wedding-crm/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/wedding-crm/customers', label: 'Customer Register', icon: Users },
    { href: '/wedding/customer-registration', label: 'Add Customer', icon: UserPlus },
    { href: '/telecaller/desk', label: 'Telecaller Desk', icon: PhoneCall },
    { href: '/wedding-crm/calls', label: 'Call History', icon: History },
    { href: '/wedding-crm/calendar', label: 'Calendar', icon: Calendar },
    { href: '/wedding-crm/pipeline', label: 'Status Board', icon: Kanban },
    { href: '/wedding-crm/reports', label: 'Reports', icon: BarChart3 },
    { href: '/wedding-crm/import', label: 'Import', icon: FileSpreadsheet }
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Global Standard Breadcrumb (Below Header, Above Page Title) */}
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <Link to="/dashboard" className="hover:text-primary transition-colors">
          BSC Portal
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-muted/60" />
        <Link to="/wedding-crm/dashboard" className="hover:text-primary transition-colors">
          Wedding CRM
        </Link>
        {breadcrumbs?.map((bc, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-muted/60" />
            {bc.href ? (
              <Link to={bc.href} className="hover:text-primary transition-colors">
                {bc.label}
              </Link>
            ) : (
              <span className="text-primary font-bold">{bc.label}</span>
            )}
          </React.Fragment>
        ))}
        {!breadcrumbs && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-muted/60" />
            <span className="text-primary font-bold">{currentPageTitle}</span>
          </>
        )}
      </div>

      {/* Page Title + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#DFDDD7] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#101C36] text-[#C9A45C] flex items-center justify-center shadow-md border border-[#C9A45C]/30 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#C9A45C]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#182033] tracking-tight leading-none">
              {currentPageTitle}
            </h1>
            <div className="text-[11px] font-bold text-muted uppercase tracking-widest mt-1">
              BSC EXCLUSIVE · WEDDING CONCIERGE & CRM
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {actions}
          </div>
        )}
      </div>

      {/* Modular Wedding CRM Sub-Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-[#DFDDD7] shadow-xs overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1 min-w-max">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentPath === link.href || (link.href === '/wedding-crm/dashboard' && currentPath === '/wedding-crm');

            return (
              <Link
                key={link.href}
                to={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#101C36] text-[#C9A45C] shadow-md border border-[#C9A45C]/30'
                    : 'text-[#687080] hover:text-[#182033] hover:bg-[#F6F4EF]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C9A45C]' : 'text-[#687080]'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
