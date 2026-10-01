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
  last_contacted_by?: string;
  last_contacted_by_user_id?: number;
  last_updated_by?: string;
  last_updated_by_user_id?: number;
  shopping_requirements?: string;
}

/**
 * A related / previous wedding journey for the same mobile number, returned by
 * GET /api/wedding-crm/customers/:id/full-profile as `associatedCustomers`.
 * Both active and permanently archived journeys stay separately traceable here.
 */
export interface WeddingAssociatedCustomer {
  id: number;
  customer_code: string;
  customer_name?: string;
  mobile_number?: string;
  wedding_date?: string | null;
  customer_status?: string;
  assigned_telecaller?: string;
  expected_shopping_date?: string | null;
  created_at?: string;
  location_name?: string;
  location_code?: string;
  lifecycle_status?: 'ACTIVE' | 'OLD_CUSTOMER' | 'ARCHIVED';
  previous_status?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  previous_customer_id?: number | null;
}

export interface WeddingWhatsAppTemplate {
  key: string;
  label: string;
  category: string;
  text: string;
  store_name: string;
  store_phone: string;
  variables: Record<string, string>;
}

export interface WeddingWhatsAppLog {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_code?: string;
  mobile_number?: string;
  location_id?: number;
  location_name?: string;
  telecaller_id?: number;
  telecaller_name?: string;
  template_type: string;
  message_text: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  error_message?: string;
  created_at: string;
}

export interface WeddingActivityItem {
  id: string | number;
  type: 'CREATED' | 'ASSIGNMENT' | 'CALL' | 'STATUS_CHANGE' | 'WHATSAPP' | 'VISIT' | 'APPOINTMENT' | 'NOTE' | 'AUDIT';
  action: string;
  details?: string;
  outcome?: string;
  remarks?: string;
  old_value?: string;
  new_value?: string;
  performer_name: string;
  performer_id?: number;
  date_time: string;
  meta?: any;
}

export interface TelecallerPerformanceMetric {
  telecaller_id: number;
  telecaller_name: string;
  role_name?: string;
  location_id?: number;
  location_name?: string;
  assignedCustomers: number;
  callsToday: number;
  callsCompleted: number;
  callsPending: number;
  overdue: number;
  connectedCalls: number;
  noAnswer: number;
  followupsScheduled: number;
  shoppingConfirmed: number;
  visitsPlanned: number;
  completedCustomers: number;
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
  // Both are real wedding_call_logs columns returned by SELECT *.
  customer_response?: string;
  call_duration?: string;
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
  'Invalid Number',
  // Terminal journey status — the last step after Visit / Shopping Confirmation.
  // Selecting this moves the customer into the permanent Old Customers archive.
  'Wedding Process Completed'
];

/**
 * Status values the backend treats as "journey complete" (weddingController.js
 * COMPLETION_STATUSES). Choosing one of these moves the customer into the
 * immutable Old Customers archive automatically.
 */
export const COMPLETION_STATUSES = ['Wedding Process Completed', 'Completed'];

/** Final journey status shown in every customer_status picker. */
export const COMPLETION_STATUS = 'Wedding Process Completed';

export function isCompletionStatus(status?: string) {
  return COMPLETION_STATUSES.includes((status || '').trim());
}

/** Server messages mirrored for consistent UI feedback (see weddingController.js). */
export const ARCHIVE_SUCCESS_MESSAGE = 'Customer completed and moved to Old Customers.';
export const ARCHIVE_READONLY_MESSAGE =
  'This customer is in Old Customers. Restore the record before changing its status.';
export const ARCHIVE_PROTECTED_MESSAGE =
  'Completed customer records are permanently protected.';

export const CALL_OUTCOMES = [
  'Connected — Interested',
  'Connected — Follow-up Required',
  'Connected — Shopping Confirmed',
  'Connected — Visit Planned',
  'Connected — Not Interested',
  'No Answer',
  'Busy',
  'Switched Off',
  'Wrong Number',
  'Call Back Requested',
  'Customer Asked to Contact Later',
  'Other',
  // Backwards compatibility legacy values
  'Connected',
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
 * - INTERESTED / NEW LEAD: bg #EDF3F0, text #082821
 * - FOLLOW-UP / CALLBACK / SCHEDULED: bg #EDF3F0, text #123C35
 */
export function getStatusBadge(status?: string) {
  const s = (status || '').toLowerCase().trim();
  // Completed journeys render in the success palette so the archive trigger reads
  // as a positive terminal step rather than an unclassified status.
  if (COMPLETION_STATUSES.map((v) => v.toLowerCase()).includes(s)) {
    return {
      bg: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25',
      dot: 'bg-[#198754]'
    };
  }
  if (s.includes('won') || s.includes('converted') || s.includes('confirm') || s.includes('visited') || s.includes('planned')) {
    return {
      bg: 'bg-[#E8F5EE] text-[#198754] border-[#198754]/25',
      dot: 'bg-[#198754]'
    };
  }
  if (s.includes('interested') || s === 'new lead') {
    return {
      bg: 'bg-[#EDF3F0] text-[#082821] border-[#082821]/25',
      dot: 'bg-[#082821]'
    };
  }
  if (s.includes('follow-up') || s.includes('callback') || s.includes('scheduled')) {
    return {
      bg: 'bg-[#EDF3F0] text-[#123C35] border-[#123C35]/25',
      dot: 'bg-[#123C35]'
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
    bg: 'bg-[#EDF3F0] text-[#65716C] border-[#E1DDD3]',
    dot: 'bg-[#9A858D]'
  };
}
