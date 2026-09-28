/**
 * TypeScript types for the Profile Website
 */

export interface StatItem {
  label: string;
  value: string;
  suffix?: string;
}

export interface CoreValue {
  title: string;
  description: string;
}

export interface ProfileData {
  id: number;
  full_name: string;
  founder?: string;
  professional_title: string;
  short_bio: string;
  full_bio: string;
  profile_image: string;
  cover_image: string;
  location: string;
  email: string;
  phone: string;
  website: string;
  availability: string;
  resume_url?: string;
  mission: string;
  vision: string;
  core_values: CoreValue[];
  highlights: string[];
  stats: StatItem[];
  updated_at?: string;
}

export interface ExperienceItem {
  id: number;
  company: string;
  position: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  employment_type: string;
  responsibilities: string[];
  achievements: string[];
  skills_used: string[];
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SkillItem {
  id: number;
  name: string;
  category: string;
  proficiency: number; // 1-100
  years_of_experience: number;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceItem {
  id: number;
  title: string;
  slug: string;
  short_description: string;
  detailed_description: string;
  icon_name: string;
  features: string[];
  starting_price: string;
  cta_text: string;
  cta_link: string;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectItem {
  id: number;
  title: string;
  slug: string;
  cover_image: string;
  gallery: string[];
  category: string;
  short_description: string;
  full_description: string;
  client_name: string;
  role: string;
  completion_date: string;
  project_url: string;
  technologies: string[];
  results: string[];
  is_featured: boolean;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AchievementItem {
  id: number;
  title: string;
  category: string;
  organization: string;
  issue_date: string;
  description: string;
  badge_image?: string;
  credential_url?: string;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TestimonialItem {
  id: number;
  client_name: string;
  position: string;
  company: string;
  avatar_url: string;
  testimonial_text: string;
  rating: number; // 1-5
  date_given: string;
  is_featured: boolean;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  media_type: 'photo' | 'video';
  media_url: string;
  thumbnail_url?: string;
  category: string;
  caption: string;
  aspect_ratio: string;
  display_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'contacted' | 'archived';
  internal_notes?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at?: string;
}

export interface SocialLink {
  id: number;
  platform: string;
  label: string;
  url: string;
  icon_name: string;
  is_active: boolean;
  display_order: number;
}

export interface AuditLogItem {
  id: number;
  user_id?: number;
  username: string;
  action: string;
  module: string;
  record_id?: string;
  details?: string;
  ip_address?: string;
  status: string;
  created_at: string;
}

export interface SiteSettings {
  site_title: string;
  meta_description: string;
  keywords: string;
  canonical_url: string;
  og_image: string;
  contact_email: string;
  contact_phone: string;
  theme_default: 'light' | 'dark';
  enable_cookie_consent: boolean;
  maintenance_mode?: boolean;
}

export interface DashboardStats {
  total_projects: number;
  published_projects: number;
  draft_projects: number;
  total_services: number;
  published_services: number;
  total_testimonials: number;
  total_gallery_items: number;
  total_messages: number;
  unread_messages: number;
  recent_messages: ContactMessage[];
  recent_activity: AuditLogItem[];
}
