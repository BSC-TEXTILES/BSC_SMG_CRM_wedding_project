import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import WeddingCrmDashboard from './wedding/WeddingCrmDashboard';
import { Auth } from '../services/api';

/**
 * WeddingCRM Entrypoint & Route Delegator
 * Seamlessly routes legacy query parameter tabs (?tab=calling_desk, ?tab=register, etc.)
 * directly to their respective dedicated modular pages, preventing the "everything on one page" clutter.
 */
export default function WeddingCRM() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const user = Auth.get();
  const roleNorm = (user?.role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  const isTelecaller = ['telecaller', 'caller', 'tele-caller', 'tele caller', 'vm extension telecaller', 'vm telecaller'].includes(roleNorm);

  if (!tab && isTelecaller) {
    return <Navigate to="/telecaller/desk" replace />;
  }

  if (tab === 'calling_desk') {
    return <Navigate to="/telecaller/desk" replace />;
  }
  if (tab === 'register') {
    return <Navigate to="/wedding-crm/customers" replace />;
  }
  if (tab === 'calendar') {
    return <Navigate to="/wedding-crm/calendar" replace />;
  }
  if (tab === 'pipeline') {
    return <Navigate to="/wedding-crm/pipeline" replace />;
  }
  if (tab === 'call_history') {
    return <Navigate to="/wedding-crm/calls" replace />;
  }
  if (tab === 'analytics' || tab === 'reports') {
    return <Navigate to="/wedding-crm/reports" replace />;
  }
  if (tab === 'import') {
    return <Navigate to="/wedding-crm/import" replace />;
  }

  return <WeddingCrmDashboard />;
}
