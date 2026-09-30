/**
 * Shared types for the Wedding Status Pipeline workspace.
 *
 * Shapes mirror GET /wedding-crm/pipeline/board (weddingController.getPipelineBoard).
 * Stage membership is decided by the backend and sent per row as `stage_key`,
 * so the UI can never silently drop a customer whose status is unfamiliar.
 */

export type StageKey =
  | 'new'
  | 'contacted'
  | 'follow_up'
  | 'shopping_planned'
  | 'visited'
  | 'won'
  | 'not_moving'
  | 'other';

export interface PipelineStage {
  key: StageKey;
  label: string;
  order: number;
  count: number;
}

export interface PipelineCustomer {
  id: number;
  customer_code: string;
  customer_name: string;
  mobile_number: string;
  email?: string | null;
  location_id: number;
  location_name?: string | null;
  location_code?: string | null;

  customer_status: string;
  stage_key: StageKey;
  call_status?: string | null;
  priority?: string | null;

  wedding_date?: string | null;
  expected_shopping_date?: string | null;
  preferred_shopping_category?: string | null;
  estimated_family_size?: number | null;

  assigned_telecaller?: string | null;
  assigned_telecaller_id?: number | null;

  follow_up_date?: string | null;
  preferred_call_time?: string | null;
  preferred_followup_time?: string | null;

  total_calls_count?: number;
  last_call_date?: string | null;
  last_call_outcome?: string | null;
  last_contacted_by?: string | null;

  calls_logged?: number;
  followups_logged?: number;
  feedback_count?: number;
  latest_feedback?: string | null;
  visits_count?: number;
  notes_count?: number;
  /** Positive when the follow-up date is in the past. */
  overdue_days?: number | null;

  bride_name?: string | null;
  groom_name?: string | null;
  wedding_venue?: string | null;
  wedding_city?: string | null;
  budget?: string | null;
  budget_range?: string | null;
  lead_source?: string | null;
  customer_notes?: string | null;
  shopping_requirements?: unknown;

  created_at?: string;
  updated_at?: string;
}

/**
 * Board quick actions. 'visit', 'shopping' and 'convert' drive the order-style
 * journey: record a store visit, update shopping progress, mark the wedding won.
 */
export type QuickActionKind = 'call' | 'feedback' | 'follow_up' | 'note' | 'stage' | 'visit' | 'shopping' | 'convert';

/** Ordered funnel used by the progress tracker. 'not_moving'/'other' are off-funnel. */
export const FUNNEL_STAGE_ORDER: StageKey[] = [
  'new',
  'contacted',
  'follow_up',
  'shopping_planned',
  'visited',
  'won'
];

export interface PipelineBoardResponse {
  success: boolean;
  customers: PipelineCustomer[];
  total: number;
  stages: PipelineStage[];
  /** Server-side IST calendar day (YYYY-MM-DD); do not substitute the browser date. */
  today: string;
}

/** Human label per stage_key, so any screen can name a stage from a row alone. */
export const STAGE_LABELS: Record<StageKey, string> = {
  new: 'New Lead',
  contacted: 'Contacted',
  follow_up: 'Follow-Up',
  shopping_planned: 'Shopping Planned',
  visited: 'Visited Store',
  won: 'Won / Converted',
  not_moving: 'Not Moving Forward',
  other: 'Needs Review'
};

/** Column styling per stage. Kept here so cards and headers cannot drift apart. */
export const STAGE_PRESENTATION: Record<StageKey, { accent: string; chip: string; headerBg: string }> = {
  new: { accent: 'border-[#E8D9D4]', chip: 'bg-[#EDE7F6] text-[#6A2853]', headerBg: 'bg-[#FFFAF7]' },
  contacted: { accent: 'border-[#E8C7A8]', chip: 'bg-[#C58A18] text-white', headerBg: 'bg-[#FFF4D6]' },
  follow_up: { accent: 'border-[#D89AA3]', chip: 'bg-[#4A173A] text-white', headerBg: 'bg-[#F6E2E5]' },
  shopping_planned: { accent: 'border-[#B76E79]', chip: 'bg-[#B76E79] text-white', headerBg: 'bg-[#FFF7F2]' },
  visited: { accent: 'border-[#E8C7A8]', chip: 'bg-[#6A2853] text-white', headerBg: 'bg-[#FFFAF7]' },
  won: { accent: 'border-[#198754]/40', chip: 'bg-[#198754] text-white', headerBg: 'bg-[#E8F5EE]' },
  not_moving: { accent: 'border-[#6F5963]/30', chip: 'bg-[#6F5963] text-white', headerBg: 'bg-[#F4F2F0]' },
  other: { accent: 'border-[#B42318]/30', chip: 'bg-[#B42318] text-white', headerBg: 'bg-[#FDE8E7]' }
};

/** Statuses offered by "Move Stage", grouped the way the pipeline reads. */
export const STAGE_TARGET_STATUSES: Record<StageKey, string[]> = {
  new: ['New'],
  contacted: ['Contacted', 'Interested'],
  follow_up: ['Follow-up Pending', 'No Response'],
  shopping_planned: ['Shopping Date Confirmed'],
  visited: ['Visited Store'],
  won: ['Converted', 'Wedding Process Completed'],
  not_moving: ['Not Interested', 'Cancelled', 'Closed'],
  other: []
};
