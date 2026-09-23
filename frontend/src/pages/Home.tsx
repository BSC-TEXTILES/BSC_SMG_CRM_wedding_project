import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Auth } from '../services/api';
import { resolvePostLoginRoute } from '../utils/moduleRegistry';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Auth.check()) {
      setLoading(false);
      return;
    }

    const user = Auth.get();
    let isMounted = true;

    resolvePostLoginRoute(user).then((route) => {
      if (isMounted) {
        setTargetRoute(route || '/no-access');
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setTargetRoute('/no-access');
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  if (!Auth.check()) {
    return <Navigate to="/login" replace />;
  }

  if (loading || !targetRoute) {
    return (
      <div className="min-h-screen bg-[#FBF8F5] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-[#DFDDD7] shadow-sm flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[#C9A45C] animate-spin" />
          </div>
          <p className="text-xs font-semibold text-[#07101F]/70 tracking-tight">
            Loading your authorized workspace...
          </p>
        </div>
      </div>
    );
  }

  return <Navigate to={targetRoute} replace />;
}
