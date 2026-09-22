import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { permissionsCache } from '../context/PermissionsCache';
import { useRealtimeSection } from '../hooks/useRealtimeSection';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Edit,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  SquareCheck,
  Square,
  Building2,
  Mail,
  Phone,
  Clock,
  TriangleAlert,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  Activity,
  UserCheck,
  UserX,
  FileSpreadsheet
} from 'lucide-react';

interface ModuleDef {
  key: string;
  label: string;
  section: string;
}

interface UserPermission {
  module: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  
  granted_by?: string;
  granted_at?: string;
}

interface UserData {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  role: string;
  active: boolean | number;
  location_id: number | null;
  location_code: string | null;
  location_name?: string | null;
  max_modules: number | null;
  modules_assigned: number;
  last_login_at: string | null;
  created_at: string;
  updated_at?: string;
  assigned_locations?: Array<{ id: number; name: string }>;
  employee_id?: string | null;
  employeeId?: string | null;
  candidate_app_no?: string | null;
  candidateAppNo?: string | null;
  section?: string | null;
  joiningDate?: string | null;
}

interface AuditLog {
  action: string;
  module: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}



const DEFAULT_SYSTEM_ROLES = [
  'Super Admin',
  'Admin',
  'Wedding Collection Manager',
  'Team Lead',
  'Telecaller',
  'HR',
  'Manager',
  'Recruiter',
  'Interviewer',
  'Employee',
  'Greeter',
  'Guest',
  'Telecaller'
];

export default function UserManagementPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Users & Modules
  const [users, setUsers] = useState<UserData[]>([]);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [availableRoles, setAvailableRoles] = useState<string[]>(DEFAULT_SYSTEM_ROLES);
  const [locationFilter, setLocationFilter] = useState('ALL');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Active target user
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  // Form states - Create User
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formRole, setFormRole] = useState('HR');
  const [formLocationId, setFormLocationId] = useState<string>('2');
  const [formLocationIds, setFormLocationIds] = useState<string[]>(['2']);
  const [formAllLocations, setFormAllLocations] = useState<boolean>(false);
  const [formSelectedModules, setFormSelectedModules] = useState<string[]>([]);
  const [formSection, setFormSection] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states - Edit User
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editRole, setEditRole] = useState('HR');
  const [editLocationId, setEditLocationId] = useState<string>('2');
  const [editLocationIds, setEditLocationIds] = useState<string[]>(['2']);
  const [editAllLocations, setEditAllLocations] = useState<boolean>(false);
  const [editMaxModules, setEditMaxModules] = useState<string>('');
  const [editActive, setEditActive] = useState(true);
  const [editSection, setEditSection] = useState('');
  const [editJoiningDate, setEditJoiningDate] = useState('');

  // Form state - Reset Password
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // State - Permissions Matrix
  const [userPermissions, setUserPermissions] = useState<Record<string, UserPermission>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  // State - User Activity
  const [userActivity, setUserActivity] = useState<AuditLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [userConsent, setUserConsent] = useState<any>(null);

  // State - Inline Location Edit
  const [editingLocationUserId, setEditingLocationUserId] = useState<number | null>(null);
  const [savingLocationUserId, setSavingLocationUserId] = useState<number | null>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Check auth
  useEffect(() => {
    const s = Auth.get();
    if (!s) {
      navigate('/login');
      return;
    }
    setSession(s);
    if (!['Admin', 'Super Admin'].includes(s.role)) {
      showToast('Access Denied: Administrator role required', 'error');
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [navigate]);

  // Click-outside handler for inline location dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setEditingLocationUserId(null);
      }
    };
    if (editingLocationUserId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingLocationUserId]);

  // Load all initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, modulesRes, locsRes, rolesRes] = await Promise.all([
        API.getAdminUsers(),
        API.getAdminModules().catch(() => ({ modules: [] })),
        API.getLocations().catch(() => []),
        API.getRoles().catch(() => ({ roles: [] }))
      ]);

      if (usersRes?.users) {
        setUsers(usersRes.users);
      } else if (Array.isArray(usersRes)) {
        setUsers(usersRes);
      }

      if (modulesRes?.modules && modulesRes.modules.length > 0) {
        setModules(modulesRes.modules);
      } else {
        // Fallback standard module registry
        setModules([
          { key: 'dashboard', label: 'Dashboard', section: 'Core Workspace' },
          { key: 'wedding_crm', label: 'Wedding Follow-up CRM', section: 'Store Operations' },
          { key: 'wedding_registration', label: 'Wedding Customer Registration', section: 'Store Operations' },
          { key: 'telecaller_desk', label: 'Telecaller Calling Desk', section: 'Store Operations' },
          { key: 'telecaller_dashboard', label: 'Telecaller Dashboard', section: 'Store Operations' },
          { key: 'footfall', label: 'Hourly Footfall', section: 'Store Operations' },
          { key: 'feedback_collection', label: 'Feedback Collection', section: 'Store Operations' },
          { key: 'feedback_list', label: 'Feedback Call Queue', section: 'Store Operations' },
          { key: 'feedback_qr', label: 'Feedback QR Code', section: 'Store Operations' },
          { key: 'divert', label: 'Sourcing Diverts', section: 'Store Operations' },
          { key: 'candidates', label: 'Candidate CRM', section: 'Core Workspace' },
          { key: 'offer', label: 'Wedding Operations', section: 'Core Workspace' },
          { key: 'openings', label: 'Manpower Planning', section: 'Core Workspace' },
          { key: 'employees', label: 'Employee Directory', section: 'Talent Management' },
          { key: 'dept_hiring', label: 'Department Hiring Status', section: 'Talent Management' },
          { key: 'section_allocation', label: 'Section Allocation', section: 'Talent Management' },
          { key: 'broadcast', label: 'Broadcast Center', section: 'Administration' },
          { key: 'settings', label: 'System Settings', section: 'Administration' },
          { key: 'daily_mcheck', label: 'Daily MCheck', section: 'Daily Operations' },
          { key: 'mcheck_reports', label: 'MCheck Reports', section: 'Daily Operations' },
          { key: 'mcheck_history', label: 'MCheck History', section: 'Daily Operations' },
          { key: 'user_management', label: 'User Management', section: 'Administration' }
        ]);
      }

      if (Array.isArray(locsRes)) {
        setLocations(locsRes);
      } else if (locsRes?.locations && Array.isArray(locsRes.locations)) {
        setLocations(locsRes.locations);
      }

      if (rolesRes?.roles && Array.isArray(rolesRes.roles) && rolesRes.roles.length > 0) {
        const parsed = rolesRes.roles.map((r: any) => typeof r === 'string' ? r : (r.name || r.roleName || '')).filter(Boolean);
        if (parsed.length > 0) {
          setAvailableRoles(Array.from(new Set([...DEFAULT_SYSTEM_ROLES, ...parsed])));
        }
      } else if (Array.isArray(rolesRes) && rolesRes.length > 0) {
        const parsed = rolesRes.map((r: any) => typeof r === 'string' ? r : (r.name || r.roleName || '')).filter(Boolean);
        if (parsed.length > 0) {
          setAvailableRoles(Array.from(new Set([...DEFAULT_SYSTEM_ROLES, ...parsed])));
        }
      }
    } catch (err: any) {
      showToast('Error loading user management data: ' + (err.message || 'Server error'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time Section Updates: silently refresh users & matrix data when any user/permissions change
  useRealtimeSection(['user', 'permissions'], () => {
    loadData();
  });

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Role filter
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && !u.active) return false;
      if (statusFilter === 'INACTIVE' && u.active) return false;

      // Location filter
      if (locationFilter !== 'ALL') {
        if (locationFilter === 'GLOBAL' && u.location_id !== null) return false;
        if (locationFilter !== 'GLOBAL' && String(u.location_id) !== locationFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = u.username?.toLowerCase().includes(q);
        const matchName = u.fullName?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchDept = u.department?.toLowerCase().includes(q);
        const matchDesig = u.designation?.toLowerCase().includes(q);
        const matchRole = u.role?.toLowerCase().includes(q);
        return matchUser || matchName || matchEmail || matchDept || matchDesig || matchRole;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, locationFilter, searchQuery]);

  // Quick stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.active).length;
    const inactive = total - active;
    const adminCount = users.filter(u => ['Admin', 'Super Admin'].includes(u.role)).length;
    return { total, active, inactive, adminCount };
  }, [users]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormUsername('');
    setFormPassword('');
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormDepartment('');
    setFormDesignation('');
    setFormEmployeeId('');
    setFormRole('HR');
    setFormLocationId('2');
    setFormLocationIds(['2']);
    setFormAllLocations(false);
    setFormSelectedModules([]);
    setFormSection('');
    setFormJoiningDate('');
    setShowPassword(false);
    setCreateModalOpen(true);
  };

  // Submit Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim() || !formPassword.trim() || !formRole) {
      showToast('Username, Password, and Role are mandatory', 'error');
      return;
    }
    if (formPassword.trim().length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        username: formUsername.trim(),
        password: formPassword.trim(),
        role: formRole,
        fullName: formFullName.trim() || formUsername.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim().length === 10 ? `+91${formPhone.trim()}` : formPhone.trim() || null,
        department: formDepartment.trim() || null,
        designation: formDesignation.trim() || null,
        employeeId: formEmployeeId.trim() || null,
        section: formSection.trim() || null,
        joiningDate: formJoiningDate || null,
        allLocations: formAllLocations,
        locationId: formAllLocations ? null : (parseInt(formLocationId, 10) || null),
        locationIds: formAllLocations ? [] : formLocationIds.map(Number),
        permissions: formSelectedModules.map(m => ({ module: m, can_view: true }))
      };

      await API.createAdminUser(payload);
      showToast(`User account "${formUsername.trim()}" created successfully`, 'success');
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        showToast('Validation failed: ' + err.errors.join(', '), 'error');
      } else {
        showToast('Failed to create user: ' + (err.message || 'Server error'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserData) => {
    setSelectedUser(user);
    setEditFullName(user.fullName || '');
    setEditEmail(user.email || '');
    setEditPhone(user.phone || '');
    setEditDepartment(user.department || '');
    setEditDesignation(user.designation || '');
    setEditEmployeeId(user.employee_id || user.employeeId || '');
    setEditRole(user.role || 'HR');
    setEditLocationId(user.location_id ? String(user.location_id) : '2');
    setEditLocationIds(user.assigned_locations?.map(l => String(l.id)) || [String(user.location_id || 2)]);
    setEditAllLocations(user.assigned_locations?.length === 0 && !user.location_id);
    setEditMaxModules(user.max_modules !== null && user.max_modules !== undefined ? String(user.max_modules) : '');
    setEditActive(!!user.active);
    setEditSection(user.section || '');
    setEditJoiningDate(user.joiningDate || '');
    setEditModalOpen(true);
  };

  // Submit Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const payload: any = {
        fullName: editFullName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim().length === 10 ? `+91${editPhone.trim()}` : editPhone.trim() || null,
        department: editDepartment.trim() || null,
        designation: editDesignation.trim() || null,
        employeeId: editEmployeeId.trim() || null,
        section: editSection.trim() || null,
        joiningDate: editJoiningDate || null,
        role: editRole,
        allLocations: editAllLocations,
        locationId: editAllLocations ? null : (parseInt(editLocationId, 10) || null),
        locationIds: editAllLocations ? [] : editLocationIds.map(Number),
        maxModules: editMaxModules ? parseInt(editMaxModules, 10) : null,
        active: editActive
      };

      await API.updateAdminUser(selectedUser.id, payload);
      showToast(`User "${selectedUser.username}" profile updated successfully`, 'success');
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        showToast('Validation failed: ' + err.errors.join(', '), 'error');
      } else {
        showToast('Failed to update user: ' + (err.message || 'Server error'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle User Active Status
  const handleToggleStatus = async (user: UserData) => {
    try {
      const res = await API.toggleAdminUserStatus(user.id);
      const newStatus = res?.active;
      showToast(`User "${user.username}" is now ${newStatus ? 'Active' : 'Inactive'}`, 'success');
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newStatus } : u));
    } catch (err: any) {
      showToast('Error toggling status: ' + (err.message || 'Server error'), 'error');
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (user: UserData) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowNewPassword(false);
    setResetPwdModalOpen(true);
  };

  // Generate random strong password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(result);
    setShowNewPassword(true);
  };

  // Submit Password Reset
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (newPassword.trim().length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await API.resetAdminUserPassword(selectedUser.id, newPassword.trim());
      showToast(`Password for "${selectedUser.username}" has been reset securely`, 'success');
      setResetPwdModalOpen(false);
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        showToast('Validation failed: ' + err.errors.join(', '), 'error');
      } else {
        showToast('Failed to reset password: ' + (err.message || 'Server error'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (user: UserData) => {
    setSelectedUser(user);
    setDeleteConfirmOpen(true);
  };

  // Submit Delete User
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await API.deleteAdminUser(selectedUser.id);
      showToast(`User "${selectedUser.username}" removed permanently`, 'success');
      setDeleteConfirmOpen(false);
      loadData();
    } catch (err: any) {
      showToast('Failed to delete user: ' + (err.message || 'Server error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Permissions Matrix Modal
  const handleOpenPermissions = async (user: UserData) => {
    setSelectedUser(user);
    setPermSearch('');
    setPermModalOpen(true);
    try {
      const res = await API.getAdminUserPermissions(user.id);
      const permsList: UserPermission[] = res?.permissions || [];
      const permMap: Record<string, UserPermission> = {};

      modules.forEach(m => {
        const found = permsList.find(p => p.module === m.key);
        if (found) {
          permMap[m.key] = {
            module: m.key,
            can_view: !!found.can_view,
            can_add: !!found.can_add,
            can_edit: !!found.can_edit,
            can_delete: !!found.can_delete,
            can_export: !!found.can_export,
            
          };
        } else {
          permMap[m.key] = {
            module: m.key,
            can_view: false,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_export: false,
            
          };
        }
      });

      setUserPermissions(permMap);
    } catch (err: any) {
      showToast('Failed to load user permissions: ' + (err.message || 'Error'), 'error');
    }
  };

  // Toggle single cell permission
  const handleToggleCell = (moduleKey: string, action: keyof Omit<UserPermission, 'module' | 'granted_by' | 'granted_at'>) => {
    setUserPermissions(prev => {
      const current = prev[moduleKey] || {
        module: moduleKey,
        can_view: false,
        can_add: false,
        can_edit: false,
        can_delete: false,
        can_export: false,
        
      };

      const updated = { ...current, [action]: !current[action] };

      // If granting any operational action (add/edit/delete/export/approve), automatically ensure can_view is true
      if (action !== 'can_view' && updated[action]) {
        updated.can_view = true;
      }
      // If unchecking can_view, revoke operational actions as well
      if (action === 'can_view' && !updated.can_view) {
        updated.can_add = false;
        updated.can_edit = false;
        updated.can_delete = false;
        updated.can_export = false;
      }

      return { ...prev, [moduleKey]: updated };
    });
  };

  // Toggle row (all permissions for one module)
  const handleToggleRow = (moduleKey: string) => {
    setUserPermissions(prev => {
      const current = prev[moduleKey];
      const allActive = current?.can_view && current?.can_add && current?.can_edit && current?.can_delete && current?.can_export;
      const nextVal = !allActive;
      return {
        ...prev,
        [moduleKey]: {
          module: moduleKey,
          can_view: nextVal,
          can_add: nextVal,
          can_edit: nextVal,
          can_delete: nextVal,
          can_export: nextVal
        }
      };
    });
  };

  // Preset: Grant All View
  const handlePresetGrantAllView = () => {
    setUserPermissions(prev => {
      const updated: Record<string, UserPermission> = {};
      modules.forEach(m => {
        const cur = prev[m.key] || { module: m.key, can_view: false, can_add: false, can_edit: false, can_delete: false, can_export: false,  };
        updated[m.key] = { ...cur, can_view: true };
      });
      return updated;
    });
  };

  // Preset: Full Control on All
  const handlePresetFullControl = () => {
    setUserPermissions(prev => {
      const updated: Record<string, UserPermission> = {};
      modules.forEach(m => {
        updated[m.key] = {
          module: m.key,
          can_view: true,
          can_add: true,
          can_edit: true,
          can_delete: true,
          can_export: true
        };
      });
      return updated;
    });
  };

  // Preset: Clear All
  const handlePresetRevokeAll = () => {
    setUserPermissions(prev => {
      const updated: Record<string, UserPermission> = {};
      modules.forEach(m => {
        updated[m.key] = {
          module: m.key,
          can_view: false,
          can_add: false,
          can_edit: false,
          can_delete: false,
          can_export: false
        };
      });
      return updated;
    });
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    // Check max_modules limit
    const activeViewModules = Object.values(userPermissions).filter(p => p.can_view).length;
    if (selectedUser.max_modules && activeViewModules > selectedUser.max_modules) {
      showToast(`User is restricted to a maximum of ${selectedUser.max_modules} modules (currently selected: ${activeViewModules})`, 'error');
      return;
    }

    setSavingPermissions(true);
    try {
      const payload = Object.values(userPermissions);
      await API.updateAdminUserPermissions(selectedUser.id, payload);
      permissionsCache.invalidate();
      window.dispatchEvent(new Event('permissions-updated'));
      showToast(`Permissions matrix for "${selectedUser.username}" saved successfully`, 'success');
      setPermModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast('Failed to save permissions: ' + (err.message || 'Server error'), 'error');
    } finally {
      setSavingPermissions(false);
    }
  };

  // Open User Activity Drawer/Modal
  const handleOpenActivity = async (user: UserData) => {
    setSelectedUser(user);
    setActivityModalOpen(true);
    setLoadingActivity(true);
    setUserConsent(null);
    try {
      const res = await API.getAdminUser(user.id);
      setUserActivity(res?.recentActivity || []);
      // Load consent status for this user
      try {
        const consentRes = await API.getUserConsents({ username: user.username, limit: 1 });
        if (consentRes?.success && consentRes.data?.data?.length > 0) {
          setUserConsent(consentRes.data.data[0]);
        }
      } catch {}
    } catch (err: any) {
      showToast('Failed to load user activity: ' + (err.message || 'Error'), 'error');
    } finally {
      setLoadingActivity(false);
    }
  };

  // Inline Location Change
  const handleChangeLocation = async (user: UserData, newLocationId: number | null) => {
    if (user.location_id === newLocationId) {
      setEditingLocationUserId(null);
      return;
    }
    setSavingLocationUserId(user.id);
    try {
      const payload: any = {
        allLocations: newLocationId === null,
        locationId: newLocationId === null ? null : newLocationId,
        locationIds: newLocationId === null ? [] : [newLocationId]
      };
      await API.updateAdminUser(user.id, payload);
      const locLabel = newLocationId === null
        ? 'All Locations'
        : locations.find(l => l.id === newLocationId)?.location_name || 'Unknown';
      showToast(`Location for "${user.username}" changed to ${locLabel}`, 'success');
      setUsers(prev => prev.map(u => {
        if (u.id !== user.id) return u;
        const locObj = newLocationId === null
          ? null
          : locations.find(l => l.id === newLocationId);
        return {
          ...u,
          location_id: newLocationId,
          location_code: locObj ? locObj.location_code : null,
          location_name: locObj ? locObj.location_name : null,
          assigned_locations: newLocationId === null ? [] : (locObj ? [{ id: locObj.id, name: locObj.location_name }] : [])
        };
      }));
      setEditingLocationUserId(null);
    } catch (err: any) {
      showToast('Failed to update location: ' + (err.message || 'Server error'), 'error');
    } finally {
      setSavingLocationUserId(null);
    }
  };

  // Filtered module list for permissions modal
  const filteredPermModules = useMemo(() => {
    if (!permSearch.trim()) return modules;
    const q = permSearch.toLowerCase().trim();
    return modules.filter(m => m.label.toLowerCase().includes(q) || m.section.toLowerCase().includes(q) || m.key.toLowerCase().includes(q));
  }, [modules, permSearch]);

  const assignedCount = useMemo(() => {
    return Object.values(userPermissions).filter(p => p.can_view).length;
  }, [userPermissions]);

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="User Management & Access Control"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest mb-1.5 shadow-xs">
                <Shield className="w-3.5 h-3.5 text-accent" />
                <span>Centralized Access Control &amp; Governance</span>
              </div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                <span>User Accounts &amp; Granular Permission Matrix</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">
                Provision new user accounts, enforce module-level access, reset passwords &amp; audit security events in real time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-white border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Refresh list"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-accent ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn-gold text-xs px-4 py-2 flex items-center gap-2 shadow-sm font-extrabold cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New User</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-primary/60 uppercase tracking-wider">Total Users</p>
                <p className="text-2xl font-black text-primary mt-1">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider">Active Accounts</p>
                <p className="text-2xl font-black text-green-700 mt-1">{stats.active}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Deactivated</p>
                <p className="text-2xl font-black text-red-600 mt-1">{stats.inactive}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                <UserX className="w-5 h-5" />
              </div>
            </div>

            <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-accent uppercase tracking-wider">Admin Roles</p>
                <p className="text-2xl font-black text-primary mt-1">{stats.adminCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="card-glass p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-primary/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, username, role, department..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/80 border border-accent/20 focus:outline-none focus:ring-2 focus:ring-accent/40 text-primary font-medium placeholder:text-primary/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role filter */}
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-xl border border-accent/20">
                <Filter className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] font-bold text-primary">Role:</span>
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="text-xs bg-transparent text-primary font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  {availableRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-xl border border-accent/20">
                <span className="text-[11px] font-bold text-primary">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="text-xs bg-transparent text-primary font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              {/* Location filter */}
              <div className="flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded-xl border border-accent/20">
                <Building2 className="w-3.5 h-3.5 text-accent" />
                <span className="text-[11px] font-bold text-primary">Location:</span>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="text-xs bg-transparent text-primary font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Locations</option>
                  <option value="GLOBAL">Global / All Stores</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={String(loc.id)}>{loc.location_name || loc.location_code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* User Accounts Table */}
          <div className="card-glass overflow-hidden border border-accent/20 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary/5 text-primary text-[11px] font-black uppercase tracking-wider border-b border-accent/20">
                    <th className="py-3 px-4">User Account</th>
                    <th className="py-3 px-4">Role &amp; Location</th>
                    <th className="py-3 px-4">Department &amp; Title</th>
                    <th className="py-3 px-4 text-center">Modules Assigned</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent/10 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-primary/60">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
                        <p className="font-bold">Loading user database...</p>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-primary/60">
                        <Users className="w-8 h-8 text-accent/50 mx-auto mb-2" />
                        <p className="font-bold text-sm text-primary">No users found matching your criteria</p>
                        <p className="text-xs text-primary/50 mt-1">Try resetting the search filters or create a new user.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const initials = (user.fullName || user.username)
                        .split(' ')
                        .slice(0, 2)
                        .map(n => n[0])
                        .join('')
                        .toUpperCase();

                      const isAdmin = ['Admin', 'Super Admin'].includes(user.role);
                      const isBuiltinAdmin = ['admin', 'admin@bsctextiles.com'].includes(user.username.toLowerCase());

                      return (
                        <tr key={user.id} className="hover:bg-accent/5 transition-colors">
                          {/* User Account */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary text-accent flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="font-extrabold text-primary flex items-center gap-1.5">
                                  <span>{user.fullName || user.username}</span>
                                  {isBuiltinAdmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-accent/20 text-accent uppercase">
                                      System
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-primary/60 font-medium flex items-center gap-2 mt-0.5">
                                  <span>@{user.username}</span>
                                  {user.email && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-accent" />
                                        {user.email}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role & Location */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black w-fit uppercase tracking-wider ${
                                isAdmin
                                  ? 'bg-accent/20 text-accent border border-accent/30'
                                  : user.role === 'HR'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : user.role === 'Manager'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}>
                                {isAdmin && <Shield className="w-3 h-3" />}
                                {user.role}
                              </span>
                              <span className="text-[11px] font-semibold text-primary flex items-center gap-1 relative">
                                <Building2 className="w-3 h-3 text-accent" />
                                {editingLocationUserId === user.id ? (
                                  <div ref={locationDropdownRef} className="relative">
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-accent/30 shadow-xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-150">
                                      <button
                                        type="button"
                                        onClick={() => handleChangeLocation(user, null)}
                                        disabled={savingLocationUserId === user.id}
                                        className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center gap-2 hover:bg-accent/10 transition-colors cursor-pointer ${
                                          (user.location_id === null && (!user.assigned_locations || user.assigned_locations.length === 0))
                                            ? 'bg-accent/15 text-accent' : 'text-primary'
                                        }`}
                                      >
                                        <span>🌐</span>
                                        <span>All Locations</span>
                                        {savingLocationUserId === user.id && <RefreshCw className="w-3 h-3 animate-spin ml-auto" />}
                                      </button>
                                      {(locations.length > 0 ? locations : []).map((loc: any) => (
                                        <button
                                          key={loc.id}
                                          type="button"
                                          onClick={() => handleChangeLocation(user, loc.id)}
                                          disabled={savingLocationUserId === user.id}
                                          className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center gap-2 hover:bg-accent/10 transition-colors cursor-pointer ${
                                            String(user.location_id) === String(loc.id)
                                              ? 'bg-accent/15 text-accent' : 'text-primary'
                                          }`}
                                        >
                                          <span>📍</span>
                                          <span>{loc.location_name}</span>
                                          <span className="text-[10px] text-primary/50 ml-auto">{loc.location_code}</span>
                                          {savingLocationUserId === user.id && <RefreshCw className="w-3 h-3 animate-spin ml-auto" />}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingLocationUserId(user.id)}
                                    disabled={isAdmin}
                                    className={`hover:bg-accent/10 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer text-left ${
                                      isAdmin ? 'cursor-not-allowed opacity-75' : 'hover:underline decoration-dotted underline-offset-2'
                                    }`}
                                    title={isAdmin ? 'Admin locations are managed via role' : 'Click to change location'}
                                  >
                                    {isAdmin || (!user.location_id && (!user.assigned_locations || user.assigned_locations.length === 0))
                                      ? 'Global (All Stores)'
                                      : (user.assigned_locations && user.assigned_locations.length > 0
                                        ? user.assigned_locations.map(l => l.name).join(', ')
                                        : (user.location_name || user.location_code || 'Assigned Store'))}
                                  </button>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Department & Designation */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-primary">
                              {user.designation || '—'}
                            </div>
                            <div className="text-[11px] text-primary/60">
                              {user.department || 'General Operations'}
                            </div>
                          </td>

                          {/* Modules Assigned */}
                          <td className="py-3 px-4 text-center">
                            {isAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-green-50 text-green-700 border border-green-200">
                                <Check className="w-3 h-3" />
                                <span>All Modules (Bypass)</span>
                              </span>
                            ) : (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-primary/10 text-primary">
                                  <SquareCheck className="w-3.5 h-3.5 text-accent" />
                                  <span>{user.modules_assigned || 0} Modules</span>
                                </span>
                                {user.max_modules && (
                                  <span className="text-[10px] text-primary/50 font-bold mt-0.5">
                                    Limit: {user.max_modules} max
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isBuiltinAdmin}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                                user.active
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              } ${isBuiltinAdmin ? 'opacity-75 cursor-not-allowed' : ''}`}
                              title={isBuiltinAdmin ? 'System Admin cannot be deactivated' : 'Click to toggle status'}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${user.active ? 'bg-green-600' : 'bg-red-600'}`} />
                              <span>{user.active ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>

                          {/* Last Login */}
                          <td className="py-3 px-4 text-primary text-[11px]">
                            {user.last_login_at ? (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-accent" />
                                <span>{new Date(user.last_login_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            ) : (
                              <span className="text-primary/40 font-italic">Never logged in</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Manage Permissions */}
                              <button
                                type="button"
                                onClick={() => handleOpenPermissions(user)}
                                className="p-1.5 rounded-lg text-primary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                                title="Configure Module Access Matrix"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>

                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(user)}
                                className="p-1.5 rounded-lg text-primary hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Edit User Information"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(user)}
                                className="p-1.5 rounded-lg text-primary hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Reset User Password"
                              >
                                <Key className="w-4 h-4" />
                              </button>

                              {/* Audit Activity */}
                              <button
                                type="button"
                                onClick={() => handleOpenActivity(user)}
                                className="p-1.5 rounded-lg text-primary hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                                title="View User Audit Log"
                              >
                                <Activity className="w-4 h-4" />
                              </button>

                              {/* Delete User */}
                              {!isBuiltinAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(user)}
                                  className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                  title="Delete User Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-primary/5 border-t border-accent/10 flex items-center justify-between text-xs text-primary/60 font-semibold">
              <span>Showing {filteredUsers.length} of {users.length} registered accounts</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                Backend-Enforced Authentication &amp; Audit Trail
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* ── CREATE USER MODAL ────────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="card-glass bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-accent/30 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center font-black">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Create New User</h3>
                  <p className="text-xs text-white/90">Provision login credentials and initial role privileges</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="e.g. jsmith or hr_davanagere"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={e => setFormFullName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formRole}
                    onChange={e => {
                      setFormRole(e.target.value);
                      // Admin roles default to global access — still adjustable below
                      if (['Admin', 'Super Admin'].includes(e.target.value)) setFormAllLocations(true);
                      else setFormAllLocations(false);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-bold bg-white"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    placeholder="user@bsctextiles.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Phone Number</label>
                  <div className="flex">
                    <span className="px-2.5 py-2 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit mobile number"
                      className="w-full px-3 py-2 text-xs rounded-xl rounded-l-none border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={formEmployeeId}
                    onChange={e => setFormEmployeeId(e.target.value)}
                    placeholder="e.g. EMP-001"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Department</label>
                  <select
                    value={formDepartment}
                    onChange={e => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium bg-white"
                  >
                    <option value="">Select Department...</option>
                    <option value="Sales">Sales</option>
                    <option value="HR">HR</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Admin">Admin</option>
                    <option value="Management">Management</option>
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                    <option value="IT">IT</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Visual Merchandising">Visual Merchandising</option>
                    <option value="Logistics/Stock">Logistics/Stock</option>
                    <option value="Telecalling">Telecalling</option>
                    <option value="Security">Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Designation</label>
                  <select
                    value={formDesignation}
                    onChange={e => setFormDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium bg-white"
                  >
                    <option value="">Select Designation...</option>
                    <option value="Store Manager">Store Manager</option>
                    <option value="Assistant Store Manager">Assistant Store Manager</option>
                    <option value="Sales Executive">Sales Executive</option>
                    <option value="HR Executive">HR Executive</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Head Cashier">Head Cashier</option>
                    <option value="Floor Manager">Floor Manager</option>
                    <option value="Greeter">Greeter</option>
                    <option value="System Admin">System Admin</option>
                    <option value="Admin Assistant">Admin Assistant</option>
                    <option value="Telecaller">Telecaller</option>
                    <option value="Team Leader">Team Leader</option>
                    <option value="Security Guard">Security Guard</option>
                    <option value="Visual Merchandiser">Visual Merchandiser</option>
                    <option value="Inventory Manager">Inventory Manager</option>
                    <option value="Accountant">Accountant</option>
                  </select>
</div>
            </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Section / Floor</label>
                  <input
                    type="text"
                    value={formSection}
                    onChange={e => setFormSection(e.target.value)}
                    placeholder="e.g. Ground Floor Saree, Silk Section, Cash Counter"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Date of Joining</label>
                  <input
                    type="date"
                    value={formJoiningDate}
                    onChange={e => setFormJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
                    Assigned Locations
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAllLocations}
                        onChange={(e) => {
                          setFormAllLocations(e.target.checked);
                          if (e.target.checked) setFormLocationIds([]);
                        }}
                        className="w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-bold text-primary">All Locations</span>
                    </label>
                  </div>
                  {!formAllLocations && (
                    <div className="flex flex-wrap gap-3">
                      {(locations.length > 0 ? locations : [
                        { id: 1, location_name: 'Belagavi', location_code: 'BEL' },
                        { id: 2, location_name: 'Davanagere', location_code: 'DAV' },
                        { id: 3, location_name: 'Shivamogga', location_code: 'SHI' }
                      ]).map((loc: any) => (
                        <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formLocationIds.includes(String(loc.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormLocationIds(prev => [...prev, String(loc.id)]);
                              } else {
                                setFormLocationIds(prev => prev.filter(id => id !== String(loc.id)));
                              }
                            }}
                            className="w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent"
                          />
                          <span className="text-xs font-semibold text-primary">{loc.location_name} ({loc.location_code})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-end mb-1">
                    <div>
                      <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">Initial Module Access</label>
                      <p className="text-[10px] text-primary/50 mt-0.5">Select modules the user can access</p>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-primary hover:text-accent transition-colors">
                      <input
                        type="checkbox"
                        checked={formSelectedModules.length === modules.length && modules.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setFormSelectedModules(modules.map(m => m.key));
                          else setFormSelectedModules([]);
                        }}
                        className="w-3 h-3 rounded border-accent-soft text-primary focus:ring-accent"
                      />
                      Select All
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-accent/20 rounded-xl">
                    {modules.map((m) => (
                      <label key={m.key} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={formSelectedModules.includes(m.key)}
                          onChange={(e) => {
                            if (e.target.checked) setFormSelectedModules(prev => [...prev, m.key]);
                            else setFormSelectedModules(prev => prev.filter(key => key !== m.key));
                          }}
                          className="w-3.5 h-3.5 rounded border-accent-soft text-primary focus:ring-accent"
                        />
                        <span className="text-[10px] font-semibold text-primary">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-accent/20 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{submitting ? 'Provisioning...' : 'Save User Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ──────────────────────────────────────────────── */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="card-glass bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-accent/30 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center font-black">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Edit User: @{selectedUser.username}</h3>
                  <p className="text-xs text-white/90">Update profile details, role assignments, or active status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={e => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Role</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-bold bg-white"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Phone</label>
                  <div className="flex">
                    <span className="px-2.5 py-2 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-3 py-2 text-xs rounded-xl rounded-l-none border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={editEmployeeId}
                    onChange={e => setEditEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Department</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Designation</label>
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={e => setEditDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
</div>
            </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Section / Floor</label>
                  <input
                    type="text"
                    value={editSection}
                    onChange={e => setEditSection(e.target.value)}
                    placeholder="e.g. Ground Floor Saree, Silk Section, Cash Counter"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Date of Joining</label>
                  <input
                    type="date"
                    value={editJoiningDate}
                    onChange={e => setEditJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
                    Assigned Locations
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editAllLocations}
                        onChange={(e) => {
                          setEditAllLocations(e.target.checked);
                          if (e.target.checked) setEditLocationIds([]);
                        }}
                        className="w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent"
                      />
                      <span className="text-xs font-bold text-primary">All Locations</span>
                    </label>
                  </div>
                  {!editAllLocations && (
                    <div className="flex flex-wrap gap-3">
                      {(locations.length > 0 ? locations : []).map((loc: any) => (
                        <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editLocationIds.includes(String(loc.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditLocationIds(prev => [...prev, String(loc.id)]);
                              } else {
                                setEditLocationIds(prev => prev.filter(id => id !== String(loc.id)));
                              }
                            }}
                            className="w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent"
                          />
                          <span className="text-xs font-semibold text-primary">{loc.location_name} ({loc.location_code})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Max Modules Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editMaxModules}
                    onChange={e => setEditMaxModules(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                </div>
              </div>

              {/* Status checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={e => setEditActive(e.target.checked)}
                    className="rounded border-accent/40 text-accent focus:ring-accent w-4 h-4"
                  />
                  <span className="text-xs font-bold text-primary">Account is Active (Allow Login)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-accent/20 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{submitting ? 'Saving...' : 'Update User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ─────────────────────────────────────────── */}
      {resetPwdModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card-glass bg-white rounded-2xl w-full max-w-md shadow-2xl border border-accent/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center font-black">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Reset Password</h3>
                  <p className="text-xs text-white/90">Set a new password for @{selectedUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPwdModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-primary">New Password</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-accent hover:underline font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  This action is recorded in the security audit log. The user will be required to log in with this new credential.
                </div>
              </div>

              <div className="pt-3 border-t border-accent/20 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetPwdModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>{submitting ? 'Resetting...' : 'Confirm Reset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── GRANULAR PERMISSIONS MATRIX MODAL ────────────────────────────── */}
      {permModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="card-glass bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-accent/30 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-primary text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center font-black">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Access Control Matrix: @{selectedUser.username}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent/20 text-accent uppercase">
                      {selectedUser.role}
                    </span>
                  </h3>
                  <p className="text-xs text-white/90">
                    Granular permission levels per section: View, Create, Modify, Delete, Export &amp; Authorize
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPermModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets & Filter Toolbar */}
            <div className="p-4 bg-primary/5 border-b border-accent/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-primary uppercase tracking-wider">Quick Presets:</span>
                <button
                  type="button"
                  onClick={handlePresetGrantAllView}
                  className="px-2.5 py-1 rounded-lg bg-white border border-accent/30 text-primary text-xs font-bold hover:bg-accent/10 transition-colors cursor-pointer shadow-xs"
                >
                  Grant All View
                </button>
                <button
                  type="button"
                  onClick={handlePresetFullControl}
                  className="px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/40 text-primary text-xs font-extrabold hover:bg-accent/25 transition-colors cursor-pointer shadow-xs"
                >
                  Full Control All
                </button>
                <button
                  type="button"
                  onClick={handlePresetRevokeAll}
                  className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer shadow-xs"
                >
                  Revoke All
                </button>
              </div>

              {/* Module counter and search */}
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  <span>Selected:</span>
                  <span className="font-extrabold text-accent">{assignedCount}</span>
                  {selectedUser.max_modules && (
                    <span>/ {selectedUser.max_modules} max limit</span>
                  )}
                </div>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-primary/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={permSearch}
                    onChange={e => setPermSearch(e.target.value)}
                    placeholder="Filter modules..."
                    className="w-full pl-8 pr-3 py-1 text-xs rounded-xl bg-white border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary/5 text-primary text-[11px] font-black uppercase tracking-wider border-b border-accent/20 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
                    <th className="py-2.5 px-3">Module Name</th>
                    <th className="py-2.5 px-3">Section</th>
                    <th className="py-2.5 px-2 text-center">View</th>
                    <th className="py-2.5 px-2 text-center">Add</th>
                    <th className="py-2.5 px-2 text-center">Edit</th>
                    <th className="py-2.5 px-2 text-center">Delete</th>
                    <th className="py-2.5 px-2 text-center">Export</th>
                    
                    <th className="py-2.5 px-2 text-center">Row Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent/10 text-xs">
                  {filteredPermModules.map(m => {
                    const perm = userPermissions[m.key] || {
                      module: m.key,
                      can_view: false,
                      can_add: false,
                      can_edit: false,
                      can_delete: false,
                      can_export: false,
                      
                    };

                    const isAllChecked = perm.can_view && perm.can_add && perm.can_edit && perm.can_delete && perm.can_export ;

                    return (
                      <tr key={m.key} className={`hover:bg-accent/5 transition-colors ${perm.can_view ? 'bg-primary/2' : ''}`}>
                        <td className="py-2 px-3 font-extrabold text-primary">
                          {m.label}
                        </td>
                        <td className="py-2 px-3 text-primary/60 text-[11px]">
                          {m.section}
                        </td>

                        {/* View */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCell(m.key, 'can_view')}
                            className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                              perm.can_view ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title="Toggle View access"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Add */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCell(m.key, 'can_add')}
                            className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                              perm.can_add ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title="Toggle Add access"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Edit */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCell(m.key, 'can_edit')}
                            className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                              perm.can_edit ? 'bg-black text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title="Toggle Edit access"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Delete */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCell(m.key, 'can_delete')}
                            className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                              perm.can_delete ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title="Toggle Delete access"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Export */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCell(m.key, 'can_export')}
                            className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                              perm.can_export ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title="Toggle Export access"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Row Action: All/None */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleRow(m.key)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded text-primary hover:bg-accent/15 cursor-pointer"
                          >
                            {isAllChecked ? 'Revoke' : 'All'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-primary/5 border-t border-accent/20 flex items-center justify-between shrink-0">
              <div className="text-xs text-primary">
                Changes apply instantly across current and subsequent sessions.
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPermModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {savingPermissions ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{savingPermissions ? 'Saving Matrix...' : 'Save Matrix Permissions'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── USER AUDIT ACTIVITY MODAL ────────────────────────────────────── */}
      {activityModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card-glass bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-accent/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-5 bg-primary text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center font-black">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Security &amp; Action Log: @{selectedUser.username}</h3>
                  <p className="text-xs text-white/90">Recent transactions and access events recorded in audit log</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivityModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {/* Consent Status */}
              {userConsent && (
                <div className="p-3 rounded-xl bg-primary/5 border border-accent/15">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span className="text-xs font-black text-primary uppercase tracking-wider">Consent Status</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="font-bold text-primary/60">Privacy Policy:</span>
                      <span className={`ml-2 font-bold ${userConsent.privacy_policy_accepted ? 'text-green-700' : 'text-red-600'}`}>
                        {userConsent.privacy_policy_accepted ? `Accepted (v${userConsent.privacy_policy_version})` : 'Not Accepted'}
                      </span>
                      {userConsent.privacy_policy_accepted_at && (
                        <div className="text-[10px] text-primary/40 mt-0.5">
                          {new Date(userConsent.privacy_policy_accepted_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-primary/60">Terms:</span>
                      <span className={`ml-2 font-bold ${userConsent.terms_accepted ? 'text-green-700' : 'text-red-600'}`}>
                        {userConsent.terms_accepted ? `Accepted (v${userConsent.terms_version})` : 'Not Accepted'}
                      </span>
                      {userConsent.terms_accepted_at && (
                        <div className="text-[10px] text-primary/40 mt-0.5">
                          {new Date(userConsent.terms_accepted_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {loadingActivity ? (
                <div className="py-12 text-center text-primary/60">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
                  <p className="font-bold text-xs">Querying audit logs...</p>
                </div>
              ) : userActivity.length === 0 ? (
                <div className="py-12 text-center text-primary/60">
                  <Activity className="w-8 h-8 text-accent/50 mx-auto mb-2" />
                  <p className="font-bold text-sm text-primary">No audit log records found for this user</p>
                  <p className="text-xs text-primary/50 mt-1">Actions performed by this account will appear here.</p>
                </div>
              ) : (
                userActivity.map((log, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-primary/5 border border-accent/15 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="font-extrabold text-primary flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-primary text-accent text-[10px] font-black uppercase">
                          {log.action}
                        </span>
                        {log.module && (
                          <span className="text-[11px] text-primary font-semibold">
                            Module: {log.module}
                          </span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-primary font-medium mt-1">
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-primary/50 font-bold">
                        {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {log.ip_address && (
                        <div className="text-[9px] text-primary/40 mt-0.5">
                          IP: {log.ip_address}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-primary/5 border-t border-accent/20 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActivityModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
      {deleteConfirmOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card-glass bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-red-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-red-600 text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black">
                <TriangleAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Delete User Account</h3>
                <p className="text-xs text-white/90">Permanent deletion</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-primary font-medium">
                Are you sure you want to permanently delete user account <strong className="text-red-700">@{selectedUser.username}</strong> ({selectedUser.fullName})?
              </p>
              <p className="text-[11px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                All associated user permissions and active login sessions will be terminated immediately. This action cannot be undone.
              </p>
            </div>

            <div className="p-4 bg-primary/5 border-t border-accent/20 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>{submitting ? 'Deleting...' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
