import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { permissionsCache } from '../context/PermissionsCache';
import { useRealtimeSection } from '../hooks/useRealtimeSection';
import { Users, UserPlus, Shield, ShieldCheck, Key, Lock, Edit, Trash2, Check, X, Search, Filter, RefreshCw, Eye, EyeOff, Copy, SquareCheck, Building2, Mail, Clock, TriangleAlert, Sparkles, SlidersHorizontal, Activity, UserCheck, UserX, FileSpreadsheet, Download, Upload } from 'lucide-react';

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
  can_approve: boolean;
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
  permission_source?: 'bypass' | 'custom' | 'role_default';
  module_keys?: string[];
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
  password?: string;
  deactivated_until?: string | null;
  deactivation_reason?: string | null;
}

interface AuditLog {
  action: string;
  module: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}



const ADMIN_ROLE_LIST = ['Admin', 'Super Admin', 'system administrator'];

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
  'HR Manager',
  'CRM Manager',
  'CRM Executive',
  'VM Extension Telecaller'
];

const DEFAULT_DEPARTMENTS = [
  'Sales',
  'HR',
  'Cashier',
  'Admin',
  'Management',
  'Operations',
  'Marketing',
  'IT',
  'Customer Support',
  'Visual Merchandising',
  'Logistics/Stock',
  'Telecalling',
  'Security'
];

const DEFAULT_DESIGNATIONS = [
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
  'HR Manager',
  'CRM Manager',
  'CRM Executive',
  'VM Extension Telecaller',
  'Store Manager',
  'Assistant Store Manager',
  'Sales Executive',
  'HR Executive',
  'Cashier',
  'Head Cashier',
  'Floor Manager',
  'System Admin',
  'Admin Assistant',
  'Team Leader',
  'Security Guard',
  'Visual Merchandiser',
  'Inventory Manager',
  'Accountant'
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
  const [availableDepartments, setAvailableDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [availableDesignations, setAvailableDesignations] = useState<string[]>(DEFAULT_DESIGNATIONS);
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
  const [formLocationIds, setFormLocationIds] = useState<string[]>(['2']);
  const [formSelectedModules, setFormSelectedModules] = useState<string[]>([]);
  const [formSection, setFormSection] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states - CSV bulk import (single import section for this page)
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    fileName?: string; total?: number; imported?: number; skipped?: number; failed?: number;
    results?: Array<{ row: number; status: string; reason?: string; username?: string }>;
  } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Form states - Edit User
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editRole, setEditRole] = useState('HR');
  const [editLocationId, setEditLocationId] = useState<string>('2');
  const [editLocationIds, setEditLocationIds] = useState<string[]>(['2']);
  const [editAllLocations, setEditAllLocations] = useState<boolean>(false);
  const [editMaxModules, setEditMaxModules] = useState<string>('');
  const [editActive, setEditActive] = useState(true);
  const [editSection, setEditSection] = useState('');
  const [editJoiningDate, setEditJoiningDate] = useState('');

  // Password Visibility in User Table
  const [visiblePasswords, setVisiblePasswords] = useState<{ [userId: number]: boolean }>({});
  const [allPasswordsVisible, setAllPasswordsVisible] = useState(false);

  // Deactivate User Modal State
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<UserData | null>(null);
  const [deactivationDuration, setDeactivationDuration] = useState<string>('7_days');
  const [customDeactivateDate, setCustomDeactivateDate] = useState<string>('');
  const [deactivationReason, setDeactivationReason] = useState<string>('');

  const togglePasswordVisibility = (userId: number) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleToggleAllPasswords = () => {
    const nextState = !allPasswordsVisible;
    setAllPasswordsVisible(nextState);
    const updated: { [userId: number]: boolean } = {};
    users.forEach(u => {
      updated[u.id] = nextState;
    });
    setVisiblePasswords(updated);
  };

  // Form state - Reset Password
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showCurrentModalPassword, setShowCurrentModalPassword] = useState(false);

  // State - Permissions Matrix
  const [userPermissions, setUserPermissions] = useState<Record<string, UserPermission>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permSearch, setPermSearch] = useState('');
  // 'role_default' = the account has no saved matrix yet, so the grid shows the
  // modules the role grants by default (what the backend actually enforces).
  const [permSource, setPermSource] = useState<'custom' | 'role_default' | 'bypass'>('custom');

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
    if (!ADMIN_ROLE_LIST.includes(s.role)) {
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
      const [usersRes, modulesRes, locsRes, rolesRes, deptsRes, desigRes] = await Promise.all([
        API.getAdminUsers(),
        API.getAdminModules().catch(() => ({ modules: [] })),
        API.getLocations().catch(() => []),
        API.getRoles().catch(() => ({ roles: [] })),
        API.getDepartments().catch(() => ({ departments: DEFAULT_DEPARTMENTS })),
        API.getDesignations().catch(() => ({ designations: [] }))
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

      const mergeOptions = (defaults: string[], ...lists: any[]) => {
        const seen = new Map<string, string>();
        const push = (v: any) => {
          if (v === null || v === undefined) return;
          const text = String(v).trim();
          if (!text) return;
          const key = text.toLowerCase();
          if (!seen.has(key)) seen.set(key, text);
        };
        defaults.forEach(push);
        lists.forEach(list => Array.isArray(list) && list.forEach(push));
        return Array.from(seen.values());
      };

      const userRows = usersRes?.users ?? (Array.isArray(usersRes) ? usersRes : []);
      const apiDepartments = deptsRes?.departments ?? (Array.isArray(deptsRes) ? deptsRes : []);
      const apiDesignations = desigRes?.designations ?? (Array.isArray(desigRes) ? desigRes : []);

      setAvailableDepartments(mergeOptions(DEFAULT_DEPARTMENTS, apiDepartments, userRows.map((u: any) => u.department)));
      setAvailableDesignations(mergeOptions(DEFAULT_DESIGNATIONS, apiDesignations, userRows.map((u: any) => u.designation)));
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
    const adminCount = users.filter(u => ADMIN_ROLE_LIST.includes(u.role)).length;
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
    setFormLocationIds(['2']);
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
    if (formLocationIds.length === 0) {
      showToast('Select at least one location in Assigned Locations', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const primaryLocationId = parseInt(formLocationIds[0], 10) || null;
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
        allLocations: false,
        locationId: primaryLocationId,
        locationIds: formLocationIds.map(Number),
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

  // ── CSV bulk import ───────────────────────────────────────────────
  const resetImportSelection = () => {
    setImportFile(null);
    setImportError(null);
    setImportResult(null);
  };

  const handlePickImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    if (!/\.csv$/i.test(file.name)) {
      setImportFile(null);
      setImportError('Invalid file format. Please upload the approved CSV file.');
      return;
    }
    setImportFile(file);
  };

  const handleDownloadImportTemplate = async () => {
    try {
      await API.downloadUserImportTemplate();
      showToast('Approved CSV file downloaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not download the approved CSV file. Please try again.', 'error');
    }
  };

  const handleImportCsv = async () => {
    if (!importFile) {
      setImportError('Select the approved CSV file first.');
      return;
    }
    if (!/\.csv$/i.test(importFile.name)) {
      setImportError('Invalid file format. Please upload the approved CSV file.');
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await API.importAdminUsersCsv(importFile);
      const data = (res && res.data) ? res.data : (res || {});
      setImportResult(data);

      const imported = Number(data.imported) || 0;
      const skipped = Number(data.skipped) || 0;
      const failed = Number(data.failed) || 0;
      if (failed > 0) {
        showToast(`Import finished: ${imported} imported, ${skipped} skipped, ${failed} failed`, 'warn');
      } else if (imported > 0) {
        showToast(`Import finished: ${imported} account(s) created`, 'success');
      } else {
        showToast(`Import finished: no accounts created (${skipped} skipped)`, 'info');
      }

      // Clear only the picked file - the result panel must stay visible.
      setImportFile(null);
      setImportError(null);
      // Live refresh of the table and every metric above it - no page reload.
      loadData();
    } catch (err: any) {
      const detail = Array.isArray(err?.errors) && err.errors.length > 0
        ? `${err.message} ${err.errors.join(' ')}`
        : (err.message || 'The import could not be completed. Please try again.');
      setImportError(detail);
      showToast(err.message || 'The import could not be completed. Please try again.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadFailedRows = () => {
    if (!importResult || !Array.isArray(importResult.results)) return;
    const failedRows = importResult.results.filter(r => r && r.status === 'Failed');
    if (failedRows.length === 0) return;
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      ['Row', 'Status', 'Username', 'Reason'].map(esc).join(','),
      ...failedRows.map(r => [r.row, r.status, r.username || '', r.reason || ''].map(esc).join(','))
    ];
    const bom = String.fromCharCode(0xFEFF);
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'User_Import_Failed_Rows.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
    setEditPassword(user.password || '');
    setShowEditPassword(false);
    setEditRole(user.role || 'HR');
    setEditLocationId(user.location_id ? String(user.location_id) : '2');
    const isGlobalScope = user.assigned_locations?.length === 0 && !user.location_id;
    setEditAllLocations(isGlobalScope);
    let assignedIds = user.assigned_locations?.map(l => String(l.id)) || [];
    if (assignedIds.length === 0 && !isGlobalScope) {
      assignedIds = [String(user.location_id || 2)];
    }
    setEditLocationIds(assignedIds);
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
    if (!editAllLocations && editLocationIds.length === 0) {
      showToast('Select at least one location in Assigned Locations', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const primaryLoc = editLocationIds.includes(editLocationId)
        ? editLocationId
        : (editLocationIds[0] || editLocationId);
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
        locationId: editAllLocations ? null : (parseInt(primaryLoc, 10) || null),
        locationIds: editAllLocations ? [] : editLocationIds.map(Number),
        maxModules: editMaxModules ? parseInt(editMaxModules, 10) : null,
        active: editActive
      };

      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      await API.updateAdminUser(selectedUser.id, payload);
      showToast(`User "${selectedUser.username}" profile updated successfully`, 'success');
      setEditModalOpen(false);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...payload, password: editPassword.trim() || u.password } : u));
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

  // Helper: Format remaining deactivation time
  const formatRemainingTime = (deactivatedUntil: string | null | undefined): string | null => {
    if (!deactivatedUntil) return null;
    const target = new Date(deactivatedUntil).getTime();
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) return 'Expiring soon';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days >= 30) {
      const months = Math.floor(days / 30);
      const remDays = days % 30;
      return `${months}mo ${remDays > 0 ? `${remDays}d ` : ''}left`;
    }
    if (days >= 1) {
      const remHours = hours % 24;
      return `${days}d ${remHours > 0 ? `${remHours}h ` : ''}left`;
    }
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };

  // Helper: Get calculated reactivation date string
  const getCalculatedReactivationDate = (duration: string, customDate: string): string => {
    const now = new Date();
    if (duration === '1_day') {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (duration === '7_days' || duration === '1_week') {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (duration === '30_days' || duration === '1_month') {
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (duration === '6_months') {
      return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (duration === 'custom' && customDate) {
      return new Date(customDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    return 'Indefinite (Will remain deactivated until reactivated manually)';
  };

  // Handle Status Button Click
  const handleStatusClick = (user: UserData) => {
    if (user.active) {
      // User is active -> Open Deactivate Modal with duration choices
      setDeactivatingUser(user);
      setDeactivationDuration('7_days');
      setCustomDeactivateDate('');
      setDeactivationReason('');
      setDeactivateModalOpen(true);
    } else {
      // User is deactivated -> Reactivate immediately
      handleReactivate(user);
    }
  };

  // Reactivate user immediately
  const handleReactivate = async (user: UserData) => {
    try {
      await API.toggleAdminUserStatus(user.id);
      showToast(`User "${user.username}" reactivated successfully`, 'success');
      setUsers(prev => prev.map(u => u.id === user.id ? {
        ...u,
        active: true,
        deactivated_until: null,
        deactivation_reason: null
      } : u));
    } catch (err: any) {
      showToast('Error reactivating user: ' + (err.message || 'Server error'), 'error');
    }
  };

  // Confirm Deactivation with duration
  const handleConfirmDeactivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatingUser) return;
    if (deactivationDuration === 'custom' && !customDeactivateDate) {
      showToast('Please select a custom reactivation date and time', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await API.toggleAdminUserStatus(deactivatingUser.id, {
        duration: deactivationDuration,
        customDate: deactivationDuration === 'custom' ? customDeactivateDate : undefined,
        reason: deactivationReason.trim() || undefined
      });

      const deactUntil = res?.deactivated_until;
      const untilText = deactUntil ? ` until ${new Date(deactUntil).toLocaleDateString('en-IN')}` : ' indefinitely';
      showToast(`User "${deactivatingUser.username}" deactivated${untilText}`, 'success');

      setUsers(prev => prev.map(u => u.id === deactivatingUser.id ? {
        ...u,
        active: false,
        deactivated_until: deactUntil,
        deactivation_reason: deactivationReason.trim() || null
      } : u));

      setDeactivateModalOpen(false);
    } catch (err: any) {
      showToast('Error deactivating user: ' + (err.message || 'Server error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (user: UserData) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowNewPassword(false);
    setShowCurrentModalPassword(false);
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
    if (newPassword.trim().length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await API.resetAdminUserPassword(selectedUser.id, newPassword.trim());
      showToast(`Password for "${selectedUser.username}" has been encrypted and updated successfully`, 'success');
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, password: newPassword.trim() } : u));
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
    setPermSource(user.permission_source === 'role_default' ? 'role_default' : 'custom');
    setPermModalOpen(true);
    try {
      const res = await API.getAdminUserPermissions(user.id);
      const permsList: UserPermission[] = res?.permissions || [];
      const permMap: Record<string, UserPermission> = {};

      if (res?.permission_source) {
        setPermSource(res.permission_source);
      }

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
            can_approve: !!found.can_approve
          };
        } else {
          permMap[m.key] = {
            module: m.key,
            can_view: false,
            can_add: false,
            can_edit: false,
            can_delete: false,
            can_export: false,
            can_approve: false
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
        can_approve: false
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
        updated.can_approve = false;
      }

      return { ...prev, [moduleKey]: updated };
    });
  };

  // Toggle row (all permissions for one module)
  const handleToggleRow = (moduleKey: string) => {
    setUserPermissions(prev => {
      const current = prev[moduleKey];
      const allActive = current?.can_view && current?.can_add && current?.can_edit && current?.can_delete && current?.can_export && current?.can_approve;
      const nextVal = !allActive;
      return {
        ...prev,
        [moduleKey]: {
          module: moduleKey,
          can_view: nextVal,
          can_add: nextVal,
          can_edit: nextVal,
          can_delete: nextVal,
          can_export: nextVal,
          can_approve: nextVal
        }
      };
    });
  };

  // Preset: Grant All View
  const handlePresetGrantAllView = () => {
    setUserPermissions(prev => {
      const updated: Record<string, UserPermission> = {};
      modules.forEach(m => {
        const cur = prev[m.key] || { module: m.key, can_view: false, can_add: false, can_edit: false, can_delete: false, can_export: false, can_approve: false };
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
          can_export: true,
          can_approve: true
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
          can_export: false,
          can_approve: false
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

      // If the currently logged in user's permissions were updated, sync session modules immediately
      const current = Auth.get();
      if (current && Number(current.id) === Number(selectedUser.id)) {
        const viewableModules = payload.filter(p => p.can_view).map(p => p.module);
        const updatedSession = { ...current, modules: viewableModules };
        localStorage.setItem('bsc_user_session', JSON.stringify(updatedSession));
        localStorage.setItem('user', JSON.stringify(updatedSession));
        window.dispatchEvent(new Event('bsc_auth_changed'));
      }

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

  // Human-readable list of the modules an account can actually open — used as
  // the hover tooltip of the "Modules Assigned" cell.
  const describeUserModules = (user: UserData): string => {
    if (user.permission_source === 'bypass') return 'Admin role — full access to every module';
    const keys = user.module_keys || [];
    if (keys.length === 0) return 'No modules assigned to this account';
    const labels = keys.map(k => modules.find(m => m.key === k)?.label || k);
    const origin = user.permission_source === 'role_default'
      ? `Granted by the ${user.role} role default (not yet locked in the Access Control Matrix):`
      : 'Configured in the Access Control Matrix:';
    return `${labels.length} module(s) — ${origin}\n${labels.join('\n')}`;
  };

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <Topbar
          title="User Management & Access Control"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="w-full min-w-0 max-w-full px-4 sm:px-5 lg:px-6 py-4 sm:py-5 lg:py-6 space-y-5 sm:space-y-6 flex-1 overflow-y-auto">
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

          {/* CSV Bulk Import - the single import section for this page */}
          {session && ADMIN_ROLE_LIST.includes(session.role) && (
            <div className="card-glass p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-black text-primary">Bulk Import Users (CSV)</h3>
                  </div>
                  <p className="text-xs text-primary/60 mt-1">
                    Upload the approved CSV file to create several accounts at once. The header row is
                    validated against the approved format before a single row is written.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadImportTemplate}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-white border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-accent" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handlePickImportFile}
                />
                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  disabled={importing}
                  className="px-3.5 py-2 rounded-xl bg-white border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3.5 h-3.5 text-accent" />
                  <span>Choose CSV File</span>
                </button>

                <span className="text-xs font-bold text-primary truncate max-w-[260px]">
                  {importFile ? importFile.name : 'No file selected'}
                </span>

                <button
                  type="button"
                  onClick={handleImportCsv}
                  disabled={!importFile || importing}
                  className="btn-gold text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Import</span>
                    </>
                  )}
                </button>

                {!importing && (importFile || importResult) && (
                  <button
                    type="button"
                    onClick={resetImportSelection}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-primary/60 hover:text-primary transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {importError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 whitespace-pre-wrap">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="rounded-xl border border-accent/25 bg-white/70 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold">
                    <span className="text-primary">Total Rows: {importResult.total ?? 0}</span>
                    <span className="text-green-700">Imported: {importResult.imported ?? 0}</span>
                    <span className="text-amber-700">Skipped: {importResult.skipped ?? 0}</span>
                    <span className="text-red-700">Failed: {importResult.failed ?? 0}</span>
                    {(importResult.failed ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadFailedRows}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-white border border-accent/25 text-primary text-[11px] font-black hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-accent" />
                        <span>Download Failed Rows</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-auto rounded-xl border border-accent/15">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-primary/5">
                        <tr className="text-[10px] uppercase tracking-wider text-primary/70">
                          <th className="p-2.5 font-black">Row</th>
                          <th className="p-2.5 font-black">Status</th>
                          <th className="p-2.5 font-black">Username</th>
                          <th className="p-2.5 font-black">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(importResult.results || []).map((r, i) => (
                          <tr key={`${r.row}-${i}`} className="border-t border-accent/10 text-xs">
                            <td className="p-2.5 font-mono text-primary">{r.row}</td>
                            <td className="p-2.5 font-bold">
                              <span className={
                                r.status === 'Imported' ? 'text-green-700'
                                  : r.status === 'Skipped' ? 'text-amber-700'
                                    : 'text-red-700'
                              }>{r.status}</span>
                            </td>
                            <td className="p-2.5 text-primary/80 break-all">{r.username || '-'}</td>
                            <td className="p-2.5 text-primary/70">{r.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

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
                    <th className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span>Password</span>
                        <button
                          type="button"
                          onClick={handleToggleAllPasswords}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-accent/30 text-primary hover:bg-accent/15 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title={allPasswordsVisible ? "Hide all passwords" : "Show all passwords"}
                        >
                          {allPasswordsVisible ? <EyeOff className="w-3 h-3 text-accent" /> : <Eye className="w-3 h-3 text-accent" />}
                          <span className="hidden sm:inline">{allPasswordsVisible ? 'Hide All' : 'View All'}</span>
                        </button>
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Modules Assigned</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent/10 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-primary/60">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
                        <p className="font-bold">Loading user database...</p>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-primary/60">
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

                      const isAdmin = ADMIN_ROLE_LIST.includes(user.role);
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

                          {/* Password Display & Visibility Toggle */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/5 border border-accent/20 select-all min-w-[70px] inline-block text-center">
                                {visiblePasswords[user.id] ? (user.password || 'password123') : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(user.id)}
                                className="p-1.5 rounded-lg text-primary/60 hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                                title={visiblePasswords[user.id] ? 'Hide password' : 'View password'}
                              >
                                {visiblePasswords[user.id] ? <EyeOff className="w-3.5 h-3.5 text-accent" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              {visiblePasswords[user.id] && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(user.password || 'password123');
                                    showToast(`Password copied for @${user.username}`, 'success');
                                  }}
                                  className="p-1.5 rounded-lg text-primary/60 hover:text-green-600 hover:bg-green-50 transition-colors cursor-pointer"
                                  title="Copy password to clipboard"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(user)}
                                className="p-1.5 rounded-lg text-primary/60 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Update Password"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-600" />
                              </button>
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
                              <div className="inline-flex flex-col items-center" title={describeUserModules(user)}>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-primary/10 text-primary">
                                  <SquareCheck className="w-3.5 h-3.5 text-accent" />
                                  <span>{user.modules_assigned || 0} Modules</span>
                                </span>
                                <span className={`text-[10px] font-bold mt-0.5 ${user.permission_source === 'role_default' ? 'text-amber-600' : 'text-primary/50'}`}>
                                  {user.permission_source === 'role_default' ? 'Role Default' : 'Custom Matrix'}
                                </span>
                                {user.max_modules && (
                                  <span className="text-[10px] text-primary/50 font-bold">
                                    Limit: {user.max_modules} max
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStatusClick(user)}
                                disabled={isBuiltinAdmin}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs ${
                                  user.active
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300'
                                    : 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-300'
                                } ${isBuiltinAdmin ? 'opacity-75 cursor-not-allowed' : ''}`}
                                title={isBuiltinAdmin ? 'System Admin cannot be deactivated' : (user.active ? 'Click to deactivate (select duration)' : 'Click to reactivate immediately')}
                              >
                                <span className={`w-2 h-2 rounded-full ${user.active ? 'bg-green-600 animate-pulse' : 'bg-red-600'}`} />
                                <span>{user.active ? 'Active' : 'Inactive'}</span>
                              </button>

                              {/* Timing information for deactivated users */}
                              {!user.active && (
                                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                  {user.deactivated_until ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[9.5px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded"
                                      title={`Deactivated until ${new Date(user.deactivated_until).toLocaleString('en-IN')}`}
                                    >
                                      <Clock className="w-2.5 h-2.5 text-red-600" />
                                      <span>{formatRemainingTime(user.deactivated_until)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                                      Indefinite
                                    </span>
                                  )}
                                  {user.deactivation_reason && (
                                    <span className="text-[8.5px] text-gray-400 font-medium max-w-[110px] truncate" title={user.deactivation_reason}>
                                      {user.deactivation_reason}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
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
                    {availableDepartments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
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
                    {availableDesignations.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
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
                    Assigned Locations *
                  </label>
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-primary">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
                        let result = '';
                        for (let i = 0; i < 10; i++) {
                          result += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        setEditPassword(result);
                        setShowEditPassword(true);
                      }}
                      className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-accent" />
                      <span>Generate</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary cursor-pointer"
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Department</label>
                  <select
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium bg-white"
                  >
                    <option value="">Select Department...</option>
                    {(editDepartment && !availableDepartments.some(d => d.toLowerCase() === editDepartment.trim().toLowerCase())
                      ? [editDepartment.trim(), ...availableDepartments]
                      : availableDepartments
                    ).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Designation</label>
                  <select
                    value={editDesignation}
                    onChange={e => setEditDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-medium bg-white"
                  >
                    <option value="">Select Designation...</option>
                    {(editDesignation && !availableDesignations.some(d => d.toLowerCase() === editDesignation.trim().toLowerCase())
                      ? [editDesignation.trim(), ...availableDesignations]
                      : availableDesignations
                    ).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
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
                  <div className="flex flex-wrap gap-3">
                    {(locations.length > 0 ? locations : [
                      { id: 1, location_name: 'Belagavi', location_code: 'BEL' },
                      { id: 2, location_name: 'Davanagere', location_code: 'DAV' },
                      { id: 3, location_name: 'Shivamogga', location_code: 'SHI' }
                    ]).map((loc: any) => (
                      <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editLocationIds.includes(String(loc.id))}
                          onChange={(e) => {
                            setEditAllLocations(false);
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

            {/* Role-default notice */}
            {permSource === 'role_default' && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] font-semibold text-amber-800 flex items-start gap-2 shrink-0">
                <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>@{selectedUser.username}</strong> has no saved matrix yet — the ticks below are the
                  modules the <strong>{selectedUser.role}</strong> role grants by default, which is exactly what
                  the backend enforces. Saving locks these in as a custom matrix.
                </span>
              </div>
            )}

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
                    <th className="py-2.5 px-2 text-center">Approve</th>
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
                      can_approve: false
                    };

                    const isAllChecked = perm.can_view && perm.can_add && perm.can_edit && perm.can_delete && perm.can_export && perm.can_approve;

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

                        {/* Approve */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCell(m.key, 'can_approve')}
                            className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                              perm.can_approve ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title="Toggle Approve access"
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

      {/* ── RESET / UPDATE PASSWORD MODAL ────────────────────────────────────── */}
      {resetPwdModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card-glass bg-white rounded-2xl w-full max-w-md shadow-2xl border border-accent/30 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center font-black shadow-xs">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Update User Password</h3>
                  <p className="text-xs text-white/80">Set a new password for @{selectedUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPwdModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit}>
              <div className="p-5 space-y-4">
                {/* User info banner */}
                <div className="p-3.5 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-primary">{selectedUser.fullName || selectedUser.username}</div>
                    <div className="text-[11px] text-primary/60 font-medium">@{selectedUser.username} • {selectedUser.role}</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>AES-256 Encrypted</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-primary/50 block mb-0.5">Current Password</span>
                    <div className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-primary bg-white px-2.5 py-1 rounded-lg border border-[#DFDDD7] inline-flex items-center gap-1 shadow-2xs">
                        <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{showCurrentModalPassword ? (selectedUser.password || 'password123') : '••••••••'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCurrentModalPassword(!showCurrentModalPassword)}
                        className="p-1 rounded-lg hover:bg-black/5 text-primary/50 hover:text-accent transition-colors cursor-pointer"
                        title={showCurrentModalPassword ? 'Hide current password' : 'View decrypted password'}
                      >
                        {showCurrentModalPassword ? <EyeOff className="w-3.5 h-3.5 text-accent" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* New Password input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-primary">New Password *</label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span>Generate Strong</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      autoFocus
                      className="w-full pl-3 pr-10 py-2.5 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-accent/50 text-primary font-mono font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 hover:text-primary cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <p className="text-[10.5px] text-primary/60">
                      Password must be at least 6 characters.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Stored AES-256 Encrypted</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-primary/5 border-t border-accent/20 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetPwdModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || newPassword.trim().length < 6}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  <span>{submitting ? 'Updating Password...' : 'Save & Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TIMED ACCOUNT DEACTIVATION MODAL ────────────────────────────── */}
      {deactivateModalOpen && deactivatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="card-glass bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-red-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black shadow-xs">
                  <UserX className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Deactivate User Account</h3>
                  <p className="text-xs text-white/80">Configure deactivation duration for @{deactivatingUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeactivateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeactivation}>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Target User Info */}
                <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-red-950">{deactivatingUser.fullName || deactivatingUser.username}</div>
                    <div className="text-[11px] text-red-700 font-semibold">@{deactivatingUser.username} • {deactivatingUser.role}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-800 border border-green-300">
                    Currently Active
                  </span>
                </div>

                {/* Duration Selection */}
                <div>
                  <label className="block text-xs font-bold text-primary mb-2">
                    Select Deactivation Period *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { key: '1_day', label: '1 Day', sub: '24 Hours', icon: '⚡' },
                      { key: '7_days', label: '7 Days', sub: '1 Week', icon: '📅' },
                      { key: '30_days', label: '30 Days', sub: '1 Month', icon: '🗓️' },
                      { key: '6_months', label: '6 Months', sub: 'Half Year', icon: '⏳' },
                      { key: 'indefinite', label: 'Permanent', sub: 'Until Reactivated', icon: '🛑' },
                      { key: 'custom', label: 'Custom Date', sub: 'Pick Date & Time', icon: '📆' }
                    ].map(opt => {
                      const isSelected = deactivationDuration === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setDeactivationDuration(opt.key)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-red-500 bg-red-50/80 ring-2 ring-red-400/40 shadow-xs'
                              : 'border-[#DFDDD7] bg-[#F6F4EF]/60 hover:bg-white hover:border-red-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-base">{opt.icon}</span>
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-red-600 bg-red-600' : 'border-gray-400 bg-white'
                            }`}>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                          </div>
                          <div>
                            <div className={`text-xs font-black ${isSelected ? 'text-red-900' : 'text-primary'}`}>
                              {opt.label}
                            </div>
                            <div className="text-[10px] text-gray-500 font-medium">
                              {opt.sub}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Date Input (if Custom selected) */}
                {deactivationDuration === 'custom' && (
                  <div className="p-3 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] animate-in fade-in duration-150">
                    <label className="block text-xs font-bold text-primary mb-1">
                      Custom Reactivation Date &amp; Time *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={customDeactivateDate}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      onChange={e => setCustomDeactivateDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white text-primary font-medium"
                    />
                  </div>
                )}

                {/* Reason Input */}
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">
                    Reason for Deactivation (Optional)
                  </label>
                  <input
                    type="text"
                    value={deactivationReason}
                    onChange={e => setDeactivationReason(e.target.value)}
                    placeholder="e.g. Vacation leave, Temporary disciplinary hold, Seasonal break"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-accent/30 focus:outline-none focus:ring-2 focus:ring-red-400 text-primary font-medium placeholder:text-primary/40"
                  />
                </div>

                {/* Live Reactivation Date Preview Banner */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-900 block">Automatic Reactivation Schedule:</span>
                    <span className="text-amber-800 font-medium">
                      {getCalculatedReactivationDate(deactivationDuration, customDeactivateDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-primary/5 border-t border-accent/20 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeactivateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/25 text-primary text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  <span>{submitting ? 'Deactivating...' : 'Confirm Deactivation'}</span>
                </button>
              </div>
            </form>
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
