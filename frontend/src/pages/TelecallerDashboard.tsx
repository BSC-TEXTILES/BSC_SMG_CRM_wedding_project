import React from 'react';
import TelecallerDeskPage from './wedding/TelecallerDeskPage';

/**
 * TelecallerDashboard (Unified Wrapper)
 * Uses the canonical TelecallerDeskPage component to eliminate duplicated telecaller queue logic.
 */
export default function TelecallerDashboard() {
  return <TelecallerDeskPage />;
}
