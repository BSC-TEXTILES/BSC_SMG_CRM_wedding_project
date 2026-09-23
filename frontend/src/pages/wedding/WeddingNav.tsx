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

      {/* Responsive Wedding CRM Sub-Navigation */}
      <div className="bg-white p-2 rounded-2xl border border-[#DFDDD7] shadow-xs">
        {/* Mobile Dropdown View (< sm) */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#687080] uppercase tracking-wider">Module:</span>
            <select
              value={currentPath}
              onChange={(e) => {
                window.location.href = e.target.value;
              }}
              className="flex-1 px-3 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] focus:outline-none focus:border-[#C9A45C]"
            >
              {navLinks.map((link) => (
                <option key={link.href} value={link.href}>
                  {link.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Shortcuts on Mobile */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-[#DFDDD7]">
            {navLinks.slice(0, 4).map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.href || (link.href === '/wedding-crm/dashboard' && currentPath === '/wedding-crm');
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-bold transition-all text-center ${
                    isActive
                      ? 'bg-[#101C36] text-[#C9A45C] shadow-xs'
                      : 'bg-[#F6F4EF] text-[#687080] hover:text-[#182033]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mb-0.5" />
                  <span className="truncate w-full">{link.label.split(' ')[0]}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Desktop / Tablet Horizontal Scroll Tab Strip (sm+) */}
        <div className="hidden sm:block overflow-x-auto scrollbar-hide max-w-full">
          <div className="flex items-center gap-1.5 min-w-max py-0.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.href || (link.href === '/wedding-crm/dashboard' && currentPath === '/wedding-crm');

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#101C36] text-[#C9A45C] shadow-md border border-[#C9A45C]/30'
                      : 'text-[#687080] hover:text-[#182033] hover:bg-[#F6F4EF]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#C9A45C]' : 'text-[#687080]'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
