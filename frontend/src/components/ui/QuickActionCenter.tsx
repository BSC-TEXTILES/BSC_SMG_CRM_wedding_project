import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Calendar, Sparkles, Search, UserPlus, PhoneCall, QrCode, UserCheck, Shield } from 'lucide-react';
import { Auth } from '../../services/api';

export default function QuickActionCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const session = Auth.get();
  const role = session?.role || 'Guest';

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

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
  const canManageTalent = ['Admin', 'Super Admin', 'HR', 'HR Manager', 'Floor Manager', 'Store Manager'].includes(role);

  const actions = isWeddingCrm
    ? [
        { label: '+ Add Wedding Customer', icon: UserPlus, href: '/wedding-registration' },
        { label: "Today's Follow-ups", icon: PhoneCall, href: '/wedding-crm' },
        { label: 'Follow-up Calendar', icon: Calendar, href: '/wedding-crm' },
        { label: 'Tracking Search', icon: Search, href: '/track', target: '_blank' },
        { label: 'Feedback QR', icon: QrCode, href: '/feedback-qr' }
      ]
    : [
        { label: '+ Add Wedding Customer', icon: Sparkles, href: '/wedding-registration', target: '_blank' },
        { label: '+ Section Allocation', icon: Calendar, href: '/section-allocation' },
        { label: '+ Feedback QR', icon: QrCode, href: '/feedback-qr' },
        ...(canManageTalent
          ? [{ label: '+ Register Candidate', icon: UserCheck, href: '/apply', target: '_blank' }]
          : []),
        ...(['Admin', 'Super Admin'].includes(role)
          ? [{ label: '+ User Management', icon: Shield, href: '/user-management' }]
          : [])
      ];

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end">
      {/* Expanded Speed Dial Menu */}
      {open && (
        <div className="mb-3 space-y-2 animate-fade-in">
          {isWeddingCrm && (
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#101C36] bg-white border border-[#DFDDD7] px-2.5 py-1 rounded-full shadow-sm">
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
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-[#DFDDD7] shadow-lg hover:shadow-xl hover:border-[#C9A45C] transition-all duration-150 group text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-[#182033] whitespace-nowrap group-hover:text-[#C9A45C] transition-colors">
                  {act.label}
                </span>
                <div className="p-2 rounded-lg bg-[#C9A45C]/15 text-[#C9A45C] group-hover:bg-[#C9A45C] group-hover:text-[#07101F] shadow-xs group-hover:scale-105 transition-all">
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
          w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-xl border border-[#DFDDD7] transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer
          ${open ? 'rotate-45 bg-[#C7374A] text-white hover:bg-[#A32838]' : 'bg-[#101C36] hover:bg-[#07101F] text-white'}
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