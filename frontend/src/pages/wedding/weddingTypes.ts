export interface WeddingCustomer {
  id: number;
  customer_code: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  customer_name: string;
  mobile_number: string;
  phone?: string;
  email?: string;
  wedding_date?: string;
  expected_shopping_date: string;
  preferred_shopping_category?: string;
  estimated_family_size?: number;
  assigned_telecaller?: string;
  assigned_telecaller_id?: number;
  follow_up_date: string;
  preferred_call_time?: string;
  customer_notes?: string;
  customer_status: string;
  call_status: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  budget?: string;
  lead_source?: string;
  total_calls_count?: number;
  last_call_date?: string;
  last_call_outcome?: string;
  overdue_days?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WeddingStats {
  totalCustomers: number;
  todayNewCustomers?: number;
  newRequests?: number;
  activeLeads?: number;
  interestedCustomers?: number;
  todayFollowUps: number;
  overdueFollowUps: number;
  callsPending: number;
  callsCompleted: number;
  callsToday?: number;
  connectedCalls?: number;
  missedCalls?: number;
  callbackRequests?: number;
  shoppingConfirmed: number;
  visitedConverted: number;
  convertedCustomers?: number;
  lostCustomers?: number;
  notInterested: number;
  todayAppointments?: number;
  upcomingAppointments?: number;
  completedAppointments?: number;
}

export interface CallLog {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_code?: string;
  customer_mobile?: string;
  call_date: string;
  call_time: string;
  telecaller_name: string;
  telecaller_id?: number;
  call_status: string;
  call_outcome: string;
  remarks?: string;
  next_follow_up_date?: string;
  next_follow_up_time?: string;
  expected_shopping_date_updated?: string;
  created_at: string;
}

export const CUSTOMER_STATUSES = [
  'New Lead',
  'Contact Pending',
  'Contacted',
  'Follow-up Scheduled',
  'Callback',
  'Shopping Planned',
  'Shopping Confirmed',
  'Visit Scheduled',
  'Visited',
  'Won',
  'Not Interested',
  'Lost',
  'Invalid Number'
];

export const CALL_OUTCOMES = [
  'Connected',
  'No Answer',
  'Busy',
  'Switched Off',
  'Wrong Number',
  'Callback Requested',
  'Shopping Confirmed',
  'Visit Planned',
  'Visited',
  'Won',
  'Not Interested'
];

export const CATEGORY_OPTIONS = [
  'Pure Silk Sarees',
  'Bridal Lehengas',
  'Sherwanis & Suits',
  'Family Matching Sets',
  'Fancy & Designer Sarees',
  'Kids Ethnic Wear',
  'Shirting & Suiting',
  'Accessories & Dhotis',
  'General Wedding Shopping'
];

export const CALL_TIME_OPTIONS = [
  'Morning (10 AM - 1 PM)',
  'Afternoon (1 PM - 4 PM)',
  'Evening (4 PM - 7 PM)',
  'Night (7 PM - 9 PM)',
  'Any Time'
];

export const BUDGET_RANGES = [
  'Below ₹25,000',
  '₹25,000 – ₹50,000',
  '₹50,000 – ₹1,00,000',
  '₹1,00,000 – ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  'Above ₹5,00,000',
  'Not Decided'
];

/**
 * Returns badge style for customer status
 * Following Section 22 color standards:
 * New Lead -> Info/Navy
 * Contact Pending -> Warning
 * Contacted -> Info
 * Follow-up Scheduled -> Champagne
 * Overdue -> Danger
 * Shopping Confirmed -> Blue
 * Visit Scheduled -> Info
 * Visited / Won -> Success (#16805B)
 * Not Interested / Lost -> Muted
 */
export function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('won') || s.includes('converted') || s.includes('visited')) {
    return {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      dot: 'bg-emerald-600'
    };
  }
  if (s.includes('confirm') || s.includes('planned')) {
    return {
      bg: 'bg-blue-50 text-blue-800 border-blue-300',
      dot: 'bg-blue-600'
    };
  }
  if (s.includes('schedule') || s.includes('follow-up') || s.includes('callback')) {
    return {
      bg: 'bg-amber-50 text-amber-900 border-[#C9A45C]/40',
      dot: 'bg-[#C9A45C]'
    };
  }
  if (s.includes('pending') || s.includes('new')) {
    return {
      bg: 'bg-primary-soft text-primary border-border',
      dot: 'bg-primary'
    };
  }
  if (s.includes('not interested') || s.includes('lost') || s.includes('cancel') || s.includes('invalid')) {
    return {
      bg: 'bg-rose-50 text-rose-800 border-rose-300',
      dot: 'bg-rose-600'
    };
  }
  return {
    bg: 'bg-gray-50 text-gray-700 border-gray-200',
    dot: 'bg-gray-400'
  };
}
