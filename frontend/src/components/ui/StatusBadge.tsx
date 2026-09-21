import React from 'react';
import { 
  Sparkles, Clock, Calendar, CircleCheck, 
  Send, CircleAlert, CircleX, UserCheck, Shield 
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  color?: string;
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const norm = (status || '').toLowerCase().trim();

  let badgeClass = 'b-info';
  let Icon = Shield;

  if (norm === 'new' || norm === 'applied' || norm === 'pending') {
    badgeClass = 'b-new';
    Icon = Sparkles;
  } else if (norm === 'shortlisted') {
    badgeClass = 'b-short';
    Icon = Clock;
  } else if (norm.includes('scheduled') || norm.includes('interview')) {
    badgeClass = 'b-int';
    Icon = Calendar;
  } else if (norm.includes('already selected') || norm === 'selected' || norm === 'hired') {
    badgeClass = 'b-sel';
    Icon = CircleCheck;
  } else if (norm.includes('offer') || norm === 'accepted') {
    badgeClass = 'b-offer';
    Icon = Send;
  } else if (norm.includes('hold') || norm.includes('pending accept')) {
    badgeClass = 'b-hold';
    Icon = CircleAlert;
  } else if (norm === 'rejected' || norm === 'declined') {
    badgeClass = 'b-rej';
    Icon = CircleX;
  } else if (norm === 'joined' || norm === 'onboarded') {
    badgeClass = 'b-board';
    Icon = UserCheck;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`badge ${badgeClass} ${padding} transition-all duration-150`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{status || 'Unknown'}</span>
    </span>
  );
}
