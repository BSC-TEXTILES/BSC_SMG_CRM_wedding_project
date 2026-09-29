import React, { useState } from 'react';
import { X, UserPlus, Building2, Layers, Briefcase, MapPin, Phone, Mail, Lock, Key, Check } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { API } from '../../services/api';
import { showToast } from '../Toast';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingSections?: string[];
  existingDepartments?: string[];
}

const DEFAULT_SECTIONS = [
  'Ground Floor Silk',
  'Menswear',
  'First Floor',
  'Ethnic Wear',
  'Ladies Section',
  'Kids Ethnic',
  'Brands',
  'Warehouse',
  'Telecalling',
  'General Floor'
];

const DEFAULT_DEPARTMENTS = [
  'Sales',
  'Bridal & Silk',
  'Store Operations',
  'Inventory',
  'Telecalling',
  'CRM & Calling',
  'Customer Service',
  'HR',
  'Management'
];

const DEFAULT_DESIGNATIONS = [
  'Sales Executive',
  'Senior Sales Executive',
  'Floor Supervisor',
  'Store Keeper',
  'Telecaller',
  'Senior Telecaller',
  'Customer Greeter',
  'Store Assistant',
  'Staff Member'
];

const ROLES = [
  { value: 'Staff', label: 'Floor Staff' },
  { value: 'Sales', label: 'Sales Executive' },
  { value: 'Telecaller', label: 'Telecaller' },
  { value: 'Floor Manager', label: 'Floor Manager' },
  { value: 'Manager', label: 'Store Manager' },
  { value: 'HR', label: 'HR Executive' }
];

const LOCATIONS = [
  { id: 2, name: 'Davanagere (Store #2)' },
  { id: 1, name: 'Belagavi (Store #1)' },
  { id: 3, name: 'Shivamogga (Store #3)' }
];

export default function AddEmployeeModal({
  isOpen,
  onClose,
  onSuccess,
  existingSections = [],
  existingDepartments = []
}: AddEmployeeModalProps) {
  const [fullName, setFullName] = useState('');
  const [section, setSection] = useState('');
  const [customSection, setCustomSection] = useState('');
  const [department, setDepartment] = useState('Sales');
  const [customDept, setCustomDept] = useState('');
  const [designation, setDesignation] = useState('Sales Executive');
  const [role, setRole] = useState('Staff');
  const [locationId, setLocationId] = useState<number>(2);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('BSC@Staff2026');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Combine default sections and sections passed from props
  const allSections = Array.from(new Set([...DEFAULT_SECTIONS, ...existingSections])).filter(Boolean).sort();
  const allDepartments = Array.from(new Set([...DEFAULT_DEPARTMENTS, ...existingDepartments])).filter(Boolean).sort();

  const handleNameChange = (val: string) => {
    setFullName(val);
    if (!username || username === autoUsername(fullName)) {
      setUsername(autoUsername(val));
    }
  };

  function autoUsername(name: string) {
    const clean = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '.');
    return clean ? `${clean.slice(0, 15)}_${Math.floor(100 + Math.random() * 900)}` : '';
  }

  const resetForm = () => {
    setFullName('');
    setSection('');
    setCustomSection('');
    setDepartment('Sales');
    setCustomDept('');
    setDesignation('Sales Executive');
    setRole('Staff');
    setLocationId(2);
    setPhone('');
    setEmail('');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setUsername('');
    setPassword('BSC@Staff2026');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Employee Full Name is required.');
      return;
    }

    const finalSection = section === '__custom__' ? customSection.trim() : section.trim();
    const finalDept = department === '__custom__' ? customDept.trim() : department.trim();

    if (!finalSection) {
      setErrorMsg('Please specify or select an assigned Section.');
      return;
    }

    const finalUsername = username.trim() || autoUsername(fullName) || `staff_${Date.now()}`;
    const finalPassword = password.trim() || 'BSC@Staff2026';

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        fullName: fullName.trim(),
        name: fullName.trim(),
        section: finalSection,
        department: finalDept || 'Store Operations',
        designation: designation.trim() || 'Staff',
        role: role || 'Staff',
        locationId: Number(locationId),
        phone: phone.trim() ? (phone.trim().replace(/\D/g, '').length === 10 ? `+91${phone.trim().replace(/\D/g, '')}` : phone.trim()) : null,
        email: email.trim() || null,
        joiningDate: joiningDate || null,
        username: finalUsername,
        password: finalPassword
      };

      const res = await API.createEmployee(payload);
      if (res && res.success !== false) {
        showToast(`Employee "${fullName.trim()}" added to ${finalSection}!`, 'success');
        resetForm();
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res?.message || 'Failed to create employee. Please try again.');
      }
    } catch (err: any) {
      console.error('[AddEmployeeModal] Error:', err);
      setErrorMsg(err.message || 'Unable to save employee to database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} ariaLabel="Add New Employee">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-accent/40 select-text">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 text-amber-300 border border-white/20 flex items-center justify-center font-black shadow-md">
              <UserPlus className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Add New Employee
              </h2>
              <p className="text-xs text-white/80 font-medium mt-0.5">
                Assign name, section, and department in the Employee Master Directory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div className="space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-accent block">
              1. Workforce Information
            </span>

            <div>
              <label className="block text-xs font-bold text-primary mb-1">
                Employee Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl border border-accent-soft bg-[#FBFBFA] text-xs font-bold text-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Section Assignment */}
              <div>
                <label className="block text-xs font-bold text-primary mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>Assigned Section <span className="text-rose-500">*</span></span>
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                >
                  <option value="">Select Section</option>
                  {allSections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__custom__">+ Enter Custom Section...</option>
                </select>

                {section === '__custom__' && (
                  <input
                    type="text"
                    required
                    value={customSection}
                    onChange={(e) => setCustomSection(e.target.value)}
                    placeholder="Enter custom section name"
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                )}
              </div>

              {/* Department Assignment */}
              <div>
                <label className="block text-xs font-bold text-primary mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  <span>Department <span className="text-rose-500">*</span></span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                >
                  {allDepartments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__custom__">+ Enter Custom Department...</option>
                </select>

                {department === '__custom__' && (
                  <input
                    type="text"
                    required
                    value={customDept}
                    onChange={(e) => setCustomDept(e.target.value)}
                    placeholder="Enter custom department name"
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-primary mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-accent" />
                  <span>Designation</span>
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Sales Executive"
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-primary mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Store Location */}
              <div>
                <label className="block text-xs font-bold text-primary mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  <span>Store Location</span>
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {LOCATIONS.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-xs font-bold text-primary mb-1">
                  Joining Date
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Optional Contact & Credentials */}
          <div className="space-y-3 pt-3 border-t border-accent-soft/70">
            <span className="text-[11px] font-black uppercase tracking-wider text-accent block">
              2. Contact & System Account (Optional)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-primary mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-accent" />
                  <span>Phone Number</span>
                </label>
                <div className="flex">
                  <span className="px-3 py-2 bg-accent-soft/40 border border-r-0 border-accent-soft rounded-l-xl text-xs font-bold text-primary/70 flex items-center">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 rounded-r-xl border border-accent-soft bg-white text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-accent" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@bsctextiles.com"
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-accent/5 p-3.5 rounded-2xl border border-accent/20">
              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-accent" />
                  <span>Login Username</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Auto-generated username"
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-mono font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  <span>Default Password</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-white text-xs font-mono font-bold text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-accent-soft flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-accent-soft text-primary text-xs font-bold hover:bg-card cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-gold text-xs px-6 py-2.5 font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Saving Employee...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save to Employee Directory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
