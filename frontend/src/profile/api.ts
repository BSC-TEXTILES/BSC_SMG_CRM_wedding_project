/**
 * Profile Website API Client
 * 
 * Production-ready Fetch client with:
 * - Proper error propagation & user-friendly messages
 * - Automatic Authorization header inclusion from localStorage/cookies
 * - Multipart file upload helpers
 * - Real API integration without fake mocks
 */

import {
  ProfileData,
  ExperienceItem,
  SkillItem,
  ServiceItem,
  ProjectItem,
  AchievementItem,
  TestimonialItem,
  GalleryItem,
  ContactMessage,
  SocialLink,
  SiteSettings,
  DashboardStats,
  AuditLogItem
} from './types';

const API_BASE = '/api';

/** Helper to retrieve current session token */
function getAuthToken(): string | null {
  try {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  } catch {
    return null;
  }
}

/** Standard request wrapper */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include' // allows session cookies
  });

  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`;
    try {
      const errorJson = await res.json();
      errorMsg = errorJson.message || errorJson.error || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export const ProfileApi = {
  // Public
  getProfile: () => request<ProfileData>('/profile'),
  getExperience: () => request<ExperienceItem[]>('/experience'),
  getSkills: () => request<SkillItem[]>('/skills'),
  getServices: () => request<ServiceItem[]>('/services'),
  getServiceBySlug: (slug: string) => request<ServiceItem>(`/services/${slug}`),
  getProjects: (params?: { category?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.category && params.category !== 'All') q.append('category', params.category);
    if (params?.search) q.append('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<ProjectItem[]>(`/projects${qs}`);
  },
  getProjectBySlug: (slug: string) => request<ProjectItem>(`/projects/${slug}`),
  getAchievements: () => request<AchievementItem[]>('/achievements'),
  getTestimonials: () => request<TestimonialItem[]>('/testimonials'),
  getGallery: () => request<GalleryItem[]>('/gallery'),
  getSocialLinks: () => request<SocialLink[]>('/social-links'),
  getSettings: () => request<SiteSettings>('/settings'),
  submitContact: (data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    subject: string;
    message: string;
    _hp_field?: string;
  }) => request<{ id: number; created_at: string }>('/contact', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Admin Operations
  getAdminStats: () => request<DashboardStats>('/admin/stats'),
  updateProfile: (data: Partial<ProfileData>) => request<ProfileData>('/admin/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Experience Admin
  getAdminExperience: () => request<ExperienceItem[]>('/admin/experience'),
  saveExperience: (data: Partial<ExperienceItem>) => request<ExperienceItem>(
    data.id ? `/admin/experience/${data.id}` : '/admin/experience',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteExperience: (id: number) => request<{ success: boolean }>(`/admin/experience/${id}`, {
    method: 'DELETE'
  }),

  // Skills Admin
  saveSkill: (data: Partial<SkillItem>) => request<SkillItem>(
    data.id ? `/admin/skills/${data.id}` : '/admin/skills',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteSkill: (id: number) => request<{ success: boolean }>(`/admin/skills/${id}`, {
    method: 'DELETE'
  }),

  // Services Admin
  saveService: (data: Partial<ServiceItem>) => request<ServiceItem>(
    data.id ? `/admin/services/${data.id}` : '/admin/services',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteService: (id: number) => request<{ success: boolean }>(`/admin/services/${id}`, {
    method: 'DELETE'
  }),

  // Projects Admin
  getAdminProjects: () => request<ProjectItem[]>('/admin/projects'),
  saveProject: (data: Partial<ProjectItem>) => request<ProjectItem>(
    data.id ? `/admin/projects/${data.id}` : '/admin/projects',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteProject: (id: number) => request<{ success: boolean }>(`/admin/projects/${id}`, {
    method: 'DELETE'
  }),

  // Achievements Admin
  saveAchievement: (data: Partial<AchievementItem>) => request<AchievementItem>(
    data.id ? `/admin/achievements/${data.id}` : '/admin/achievements',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteAchievement: (id: number) => request<{ success: boolean }>(`/admin/achievements/${id}`, {
    method: 'DELETE'
  }),

  // Testimonials Admin
  saveTestimonial: (data: Partial<TestimonialItem>) => request<TestimonialItem>(
    data.id ? `/admin/testimonials/${data.id}` : '/admin/testimonials',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteTestimonial: (id: number) => request<{ success: boolean }>(`/admin/testimonials/${id}`, {
    method: 'DELETE'
  }),

  // Gallery Admin
  saveGalleryItem: (data: Partial<GalleryItem>) => request<GalleryItem>(
    data.id ? `/admin/gallery/${data.id}` : '/admin/gallery',
    {
      method: data.id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    }
  ),
  deleteGalleryItem: (id: number) => request<{ success: boolean }>(`/admin/gallery/${id}`, {
    method: 'DELETE'
  }),

  // Messages Admin
  getContactMessages: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<ContactMessage[]>(`/admin/messages${qs}`);
  },
  updateContactMessage: (id: number, data: { status?: string; internal_notes?: string }) =>
    request<ContactMessage>(`/admin/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteContactMessage: (id: number) => request<{ success: boolean }>(`/admin/messages/${id}`, {
    method: 'DELETE'
  }),

  // Settings & Social
  updateSocialLinks: (links: SocialLink[]) => request<SocialLink[]>('/admin/social-links', {
    method: 'PUT',
    body: JSON.stringify({ links })
  }),
  getAdminSettings: () => request<SiteSettings>('/admin/settings'),
  updateSettings: (settings: Partial<SiteSettings>) => request<SiteSettings>('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  }),
  getAuditLogs: (limit = 100) => request<AuditLogItem[]>(`/admin/audit-logs?limit=${limit}`),

  // File Upload
  uploadMedia: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ url: string; filename: string }>('/admin/upload', {
      method: 'POST',
      body: formData
    });
  }
};
