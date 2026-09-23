import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '../services/api';
import { permissionsCache } from '../context/PermissionsCache';
import { resolvePostLoginRoute } from '../utils/moduleRegistry';
import { ShieldAlert, RefreshCw, LogOut, UserCheck, MapPin, Building2 } from 'lucide-react';

export default function NoAccess() {
  const navigate = useNavigate();
  const session = Auth.get();
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');

  const handleCheckAgain = async () => {
    setChecking(true);
    setMsg('');
    try {
      permissionsCache.clear();
      const target = await resolvePostLoginRoute(session);
      if (target && target !== '/no-access') {
        navigate(target, { replace: true });
        return;
      }
      setMsg('No modules have been assigned yet. Please verify with your system administrator.');
    } catch (err: any) {
      setMsg('Unable to refresh permissions at this moment. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    Auth.logout();
  };

  return (
    <div className="min-h-screen bg-[#FBF8F5] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none font-sans">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl border border-[#DFDDD7] shadow-xl p-8 sm:p-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 border border-amber-200/80 shadow-inner">
          <ShieldAlert className="w-8 h-8 text-[#C9A45C]" />
        </div>

        {/* Heading */}
        <h1 className="text-xl sm:text-2xl font-black text-[#07101F] tracking-tight mb-2">
          No Modules Assigned
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#07101F]/70 mb-6 leading-relaxed">
          Your account is active, but no application modules have been assigned to your profile in <span className="font-semibold text-[#07101F]">User Management</span>.
        </p>

        {/* User Details Pill */}
        <div className="w-full bg-[#FBF8F5] rounded-2xl p-4 border border-[#DFDDD7] text-left text-xs mb-6 space-y-2">
          <div className="flex items-center justify-between text-[#07101F]/80 pb-1.5 border-b border-[#DFDDD7]/60">
            <span className="flex items-center gap-1.5 font-medium text-[#7A7874]">
              <UserCheck className="w-3.5 h-3.5 text-[#C9A45C]" />
              Account
            </span>
            <span className="font-bold text-[#07101F]">
              @{session?.username || 'user'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[#07101F]/80 pb-1.5 border-b border-[#DFDDD7]/60">
            <span className="flex items-center gap-1.5 font-medium text-[#7A7874]">
              <Building2 className="w-3.5 h-3.5 text-[#C9A45C]" />
              Assigned Role
            </span>
            <span className="font-semibold px-2 py-0.5 rounded-md bg-[#07101F]/5 text-[#07101F]">
              {session?.role || 'Staff'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[#07101F]/80">
            <span className="flex items-center gap-1.5 font-medium text-[#7A7874]">
              <MapPin className="w-3.5 h-3.5 text-[#C9A45C]" />
              Store Location
            </span>
            <span className="font-medium text-[#07101F]">
              {session?.locationName || (session?.isGlobalAdmin ? 'All Locations' : 'Not assigned')}
            </span>
          </div>
        </div>

        {msg && (
          <div className="w-full mb-5 p-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200/80 animate-in fade-in duration-150">
            {msg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            type="button"
            onClick={handleCheckAgain}
            disabled={checking}
            className="w-full py-3 px-4 rounded-xl bg-[#07101F] text-white hover:bg-[#07101F]/90 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[#C9A45C] ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking permissions...' : 'Check Permissions Again'}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 px-4 rounded-xl border border-[#DFDDD7] bg-white text-[#7A7874] hover:text-[#07101F] hover:bg-gray-50 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Return to Login</span>
          </button>
        </div>

        <div className="mt-6 text-[10px] text-[#7A7874] font-medium tracking-tight">
          Please contact your administrator to configure initial module permissions.
        </div>
      </div>
    </div>
  );
}
