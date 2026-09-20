import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Calendar, Sparkles, Search, UserPlus, PhoneCall, QrCode } from 'lucide-react';
import { Auth } from '../../services/api';

export default function QuickActionCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const session = Auth.get();
  const role = session?.role || 'Guest';

  // Hide quick actions floating menu entirely for the login page, Greeter role,
  // and on public / kiosk pages.
  if (
    location.pathname === '/login' ||
    location.pathname === '/' ||
    role === 'Greeter' ||
    location.pathname === '/wedding-registration' ||
    location.pathname === '/track' ||
    location.pathname === '/greeter' ||
    location.pathname === '/footfall' ||
    location.pathname === '/feedback-public' ||
    location.pathname === '/feedback-qr' ||
    location.pathname === '/tv'
  ) {
    return null;
  }

  // Wedding CRM gets a wedding-focused quick action menu with relevant modules
  const isWeddingCrm = location.pathname.startsWith('/wedding-crm');

  const actions = isWeddingCrm
    ? [
        { label: 'Add Wedding Customer', icon: UserPlus, href: '/wedding-registration', color: 'bg-primary text-white' },
        { label: "Today's Follow-ups", icon: PhoneCall, href: '/wedding-crm', color: 'bg-primary-dark text-accent-light' },
        { label: 'Follow-up Calendar', icon: Calendar, href: '/wedding-crm', color: 'bg-accent text-primary-dark' },
        { label: 'Tracking Search', icon: Search, href: '/track', target: '_blank', color: 'bg-status-info text-white' },
        { label: 'Feedback QR', icon: QrCode, href: '/feedback-qr', color: 'bg-primary text-white' }
      ]
    : [
        { label: 'Wedding Registration', icon: Sparkles, href: '/wedding-registration', target: '_blank', color: 'bg-primary text-white' },
        { label: 'Section Allocation', icon: Calendar, href: '/section-allocation', color: 'bg-accent text-primary-dark' },
        { label: 'Feedback QR', icon: QrCode, href: '/feedback-qr', color: 'bg-primary text-white' }
      ];

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Expanded Speed Dial Menu */}
      {open && (
        <div className="mb-3 space-y-2 animate-fade-in">
          {isWeddingCrm && (
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-white border border-accent-soft px-2.5 py-1 rounded-full shadow-sm">
                Wedding Quick Actions
              </span>
            </div>
          )}
          {actions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  setOpen(false);
                  if (act.target) {
                    window.open(act.href, act.target);
                  } else {
                    // Direct navigation for all internal routes
                    navigate(act.href);
                  }
                }}
                className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white border border-border shadow-xl hover:shadow-2xl transition-all duration-150 group text-left"
              >
                <span className="text-xs font-bold text-text-primary whitespace-nowrap group-hover:text-accent">
                  {act.label}
                </span>
                <div className={`p-2 rounded-lg ${act.color} shadow-xs group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl border border-accent/20 transition-all duration-200 hover:scale-105 active:scale-95 text-white
          ${open ? 'rotate-45 bg-status-danger hover:bg-status-danger' : 'bg-primary hover:bg-primary-dark'}
        `}
        title="Quick Action Center"
        aria-label="Quick actions"
        aria-expanded={open}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}