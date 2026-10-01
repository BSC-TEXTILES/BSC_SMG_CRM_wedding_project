import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, PhoneCall, History, Calendar, Kanban, BarChart3, FileSpreadsheet, Sparkles, Archive } from 'lucide-react';

interface WeddingNavProps {
  currentPageTitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  hideTitleCard?: boolean;
}

export default function WeddingNav({ currentPageTitle, breadcrumbs, actions, hideTitleCard = false }: WeddingNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
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
    { href: '/wedding-crm/import', label: 'Import', icon: FileSpreadsheet },
    { href: '/wedding-crm/old-customers', label: 'Old Customers', icon: Archive }
  ];

  return (
    <div className={`space-y-4 ${hideTitleCard ? 'mb-4' : 'mb-6'}`}>
      {/* Page Title + Quick Actions */}
      {!hideTitleCard && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FFFDFC] p-4 sm:p-5 rounded-2xl border border-[#E8D9D4] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#4A173A] text-[#E8C7A8] flex items-center justify-center shadow-md border border-[#B76E79]/30 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[#E8C7A8]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#4A173A] tracking-tight leading-none">
                {currentPageTitle || 'Wedding CRM'}
              </h1>
              <div className="text-[11px] font-bold text-[#6F5963] uppercase tracking-widest mt-1">
                BSC Textiles · WEDDING CONCIERGE & CRM
              </div>
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Responsive Wedding CRM Sub-Navigation */}
      <div className="bg-[#FFFDFC] p-2.5 rounded-2xl border border-[#E8D9D4] shadow-xs">
        {/* Mobile View (< sm): Select Dropdown + Full Horizontal Scrollable Tab Strip */}
        <div className="sm:hidden space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#6F5963] uppercase tracking-wider shrink-0">Module:</span>
            <select
              value={currentPath}
              onChange={(e) => {
                navigate(e.target.value);
              }}
              className="flex-1 px-3 py-2 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
            >
              {navLinks.map((link) => (
                <option key={link.href} value={link.href}>
                  {link.label}
                </option>
              ))}
            </select>
          </div>

          {/* Full Horizontal Scrollable Pill Strip on Mobile (100% of tabs accessible) */}
          <div className="overflow-x-auto custom-scrollbar pb-1.5 pt-1 border-t border-[#E8D9D4]/70">
            <div className="flex items-center gap-1.5 min-w-max">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = currentPath === link.href || (link.href === '/wedding-crm/dashboard' && currentPath === '/wedding-crm') || (link.href === '/wedding/customer-registration' && currentPath === '/wedding-crm/customers/new');
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#B76E79] text-white shadow-xs font-black border border-[#D89AA3]/40'
                        : 'bg-[#FFF7F2] text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#B76E79]'}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Horizontal Scroll Tab Strip (sm+) */}
        <div className="hidden sm:flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar max-w-full pb-1">
          <div className="flex items-center gap-1.5 min-w-max py-0.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentPath === link.href || (link.href === '/wedding-crm/dashboard' && currentPath === '/wedding-crm') || (link.href === '/wedding/customer-registration' && currentPath === '/wedding-crm/customers/new');

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#B76E79] text-white shadow-md font-black border border-[#D89AA3]/30'
                      : 'text-[#6F5963] hover:text-[#4A173A] hover:bg-[#F6E2E5]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#B76E79]'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {hideTitleCard && actions && (
            <div className="flex items-center gap-2 flex-shrink-0 pl-3 border-l border-[#E8D9D4]/60">
              {actions}
            </div>
          )}
        </div>

        {/* Mobile Actions when Title Card is hidden */}
        {hideTitleCard && actions && (
          <div className="sm:hidden pt-2 border-t border-[#E8D9D4] flex items-center gap-2 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
