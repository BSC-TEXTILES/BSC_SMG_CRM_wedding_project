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
  expected_shopping_date?: string | null;
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
  // Lifecycle & Old Customer Archive fields
  lifecycle_status?: 'ACTIVE' | 'OLD_CUSTOMER' | 'ARCHIVED';
  archived_at?: string;
  archived_by?: string;
  archived_by_user_id?: number;
  archive_reason?: string;
  previous_status?: string;
  // Additional details
  bride_name?: string;
  groom_name?: string;
  wedding_venue?: string;
  wedding_city?: string;
  alternate_mobile?: string;
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
  'Not Interested',
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

export const CALL_TIMES = CALL_TIME_OPTIONS;
export const WEDDING_STATUSES = CUSTOMER_STATUSES;
export const CALL_STATUSES = ['Completed', 'Pending', 'Scheduled', 'In Progress', 'Cancelled'];

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
 * Matching BSC Exclusive Wedding CRM Brand Color System:
 * - CONFIRMED / WON / VISITED: bg #E8F5EE, text #198754
 * - PENDING / CONTACT PENDING: bg #FFF4D6, text #C58A18
 * - CANCELLED / LOST / NOT INTERESTED: bg #FDE8E7, text #B42318
 * - INTERESTED / NEW LEAD: bg #EDE7F6, text #6A2853
 * - FOLLOW-UP / CALLBACK / SCHEDULED: bg #F6E2E5, text #4A173A
 */
export function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase().trim();
  if (s.includes('won') || s.includes('converted') || s.includes('confirm') || s.includes('visited') || s.includes('planned')) {
    return {
      bg: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25',
      dot: 'bg-[#198754]'
    };
  }
  if (s.includes('interested') || s === 'new lead') {
    return {
      bg: 'bg-[#EDE7F6] text-[#6A2853] border-[#6A2853]/25',
      dot: 'bg-[#6A2853]'
    };
  }
  if (s.includes('follow-up') || s.includes('callback') || s.includes('scheduled')) {
    return {
      bg: 'bg-[#F6E2E5] text-[#4A173A] border-[#4A173A]/25',
      dot: 'bg-[#4A173A]'
    };
  }
  if (s.includes('pending') || s.includes('new') || s.includes('contacted')) {
    return {
      bg: 'bg-[#FFF4D6] text-[#C58A18] border-[#C58A18]/25',
      dot: 'bg-[#C58A18]'
    };
  }
  if (s.includes('not interested') || s.includes('lost') || s.includes('cancel') || s.includes('invalid') || s.includes('rejected')) {
    return {
      bg: 'bg-[#FDE8E7] text-[#B42318] border-[#B42318]/25',
      dot: 'bg-[#B42318]'
    };
  }
  return {
    bg: 'bg-[#FFF7F2] text-[#6F5963] border-[#E8D9D4]',
    dot: 'bg-[#9A858D]'
  };
}
