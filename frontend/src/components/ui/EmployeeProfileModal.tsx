import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, Mail, MapPin, Briefcase, DollarSign, FileText, User, Layers, Building, Edit3, Save, RotateCcw, Camera, Upload, Download, Eye, Trash2, RefreshCw, ZoomIn, ZoomOut, Maximize2, FileCheck, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ModalPortal from './ModalPortal';
import { API } from '../../services/api';
import { showToast } from '../Toast';
import { formatName } from '../../utils/formatName';

export const STANDARD_DOCUMENT_TYPES = [
  'Aadhaar',
  'PAN',
  'Address Proof',
  'Passport Photo',
  'Educational Certificate',
  'Experience Certificate',
  'Joining Documents',
  'Offer Letter',
  'Other HR Documents'
];

interface EmployeeProfileModalProps {
  employee: any | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function EmployeeProfileModal({ employee, onClose, onUpdated }: EmployeeProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'professional' | 'documents'>('overview');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentEmp, setCurrentEmp] = useState<any | null>(employee);

  // Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);

  // Photo Upload / Replace State
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Document Upload Modal State
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState<boolean>(false);
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('Aadhaar');
  const [docFileToUpload, setDocFileToUpload] = useState<File | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Document View Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [docToView, setDocToView] = useState<any | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Document Replace State
  const [isReplaceDocOpen, setIsReplaceDocOpen] = useState<boolean>(false);
  const [docToReplace, setDocToReplace] = useState<any | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacingDoc, setReplacingDoc] = useState<boolean>(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State (Photo or Document)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'photo' | 'document'; id?: string | number; name?: string } | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Photo Preview State
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState<boolean>(false);

  // Edit Form State
  const [editForm, setEditForm] = useState<any>({});

  const empIdentifier = currentEmp?.id || currentEmp?.appNo || currentEmp?.empNo || currentEmp?.employeeId;

  // Load employee profile & documents
  const loadDocuments = async () => {
    if (!empIdentifier) return;
    setLoadingDocs(true);
    try {
      const res = await API.getEmployeeDocuments(empIdentifier);
      if (res && res.success && Array.isArray(res.documents)) {
        setDocuments(res.documents);
      } else if (Array.isArray(res)) {
        setDocuments(res);
      }
    } catch (err: any) {
      console.warn('[Employee Profile] Could not fetch documents:', err.message);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    setCurrentEmp(employee);
    if (employee) {
      loadDocuments();

      const parseSal = (val: any) => {
        if (!val) return { base: '', inc: '' };
        const s = String(val).trim();
        if (s.includes('|')) {
          const p = s.split('|');
          return { base: p[0] || '', inc: p[1] || '' };
        }
        if (s.includes('+')) {
          const p = s.split('+');
          return { base: p[0] || '', inc: p[1] || '' };
        }
        return { base: s, inc: '' };
      };

      const salObj = parseSal(employee.salary);

      setEditForm({
        name: employee.name || employee.fullName || '',
        phone: employee.phone || '',
        email: employee.email || '',
        gender: employee.gender || 'MALE',
        dob: employee.dob ? employee.dob.split('T')[0] : '',
        bloodGroup: employee.bloodGroup || employee.blood_group || '',
        aadhaarNumber: employee.aadhaarNumber || employee.aadhaar_number || employee.aadharNumber || '',
        desig: employee.desig || employee.designation || '',
        department: employee.department || '',
        section: employee.section || '',
        branch: employee.branch || 'BSC Textiles Davanagere',
        reportingManager: employee.reportingManager || employee.reporting_manager || '',
        status: employee.status || 'Joined',
        salaryBase: salObj.base,
        salaryInc: salObj.inc,
        offeredDoj: employee.offeredDoj || employee.estDoj || employee.actualDoj || '',
        experience: employee.experience || '',
        retailExperience: employee.retailExperience || employee.retail_experience || '',
        qualification: employee.qualification || '',
        previousCompany: employee.previousCompany || employee.previous_company || '',
        previousDesignation: employee.previousDesignation || employee.previous_designation || '',
        previousSalary: employee.previousSalary || employee.previous_salary || '',
        fatherDetails: employee.fatherDetails || employee.father_details || '',
        motherDetails: employee.motherDetails || employee.mother_details || '',
        religion: employee.religion || '',
        caste: employee.caste || '',
        languagesKnown: employee.languagesKnown || employee.languages_known || '',
        remarks: employee.remarks || ''
      });
    }
  }, [employee]);

  if (!currentEmp) return null;

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return API.fileUrl ? API.fileUrl(url) : url;
  };

  const empName = formatName(currentEmp.name || currentEmp.fullName || 'Employee Profile');
  const empCode = currentEmp.employeeCode || currentEmp.empNo || currentEmp.appNo || (currentEmp.id ? `EMP-${currentEmp.id}` : '—');
  const desig = currentEmp.desig || currentEmp.designation || 'Staff Member';
  const dept = currentEmp.department || 'Retail Sales';
  const section = currentEmp.section || 'Unassigned';
  const photo = fileUrl(currentEmp.photoUrl);

  const parseSalary = (val: any) => {
    if (!val) return { base: 0, incentive: 0, total: 0 };
    const str = String(val).trim();
    if (str.includes('|')) {
      const parts = str.split('|');
      const base = parseFloat(parts[0]) || 0;
      const inc = parseFloat(parts[1]) || 0;
      return { base, incentive: inc, total: base + inc };
    }
    if (str.includes('+')) {
      const parts = str.split('+');
      const base = parseFloat(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const inc = parseFloat(parts[1].replace(/[^0-9.]/g, '')) || 0;
      return { base, incentive: inc, total: base + inc };
    }
    const base = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return { base, incentive: 0, total: base };
  };

  const sal = parseSalary(currentEmp.salary);

  // ── PHOTO ACTIONS ─────────────────────────────────────────────────────────
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      showToast('Please select a valid image file (JPG, JPEG, PNG, or WEBP)', 'error');
      e.target.value = '';
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be less than 10MB', 'error');
      e.target.value = '';
      return;
    }

    setUploadingPhoto(true);
    try {
      const res = await API.uploadEmployeePhoto(empIdentifier, file);
      if (res && res.success) {
        showToast('Employee profile photo updated successfully!', 'success');
        const newUrl = res.photoUrl || (res.user && res.user.photoUrl);
        setCurrentEmp((prev: any) => ({
          ...prev,
          photoUrl: newUrl
        }));
        if (onUpdated) onUpdated();
      } else {
        showToast(res?.message || 'Failed to upload photo', 'error');
      }
    } catch (err: any) {
      showToast('Photo upload error: ' + err.message, 'error');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      if (itemToDelete.type === 'photo') {
        const res = await API.removeEmployeePhoto(empIdentifier);
        if (res && res.success) {
          showToast('Employee profile photo removed successfully', 'success');
          setCurrentEmp((prev: any) => ({
            ...prev,
            photoUrl: null
          }));
          if (onUpdated) onUpdated();
        } else {
          showToast(res?.message || 'Failed to remove photo', 'error');
        }
      } else if (itemToDelete.type === 'document' && itemToDelete.id) {
        const res = await API.deleteEmployeeDocument(empIdentifier, itemToDelete.id);
        if (res && res.success) {
          showToast('Document deleted successfully', 'success');
          await loadDocuments();
        } else {
          showToast(res?.message || 'Failed to delete document', 'error');
        }
      }
    } catch (err: any) {
      showToast('Action failed: ' + err.message, 'error');
    } finally {
      setDeleting(false);
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  // ── DOCUMENT ACTIONS ──────────────────────────────────────────────────────
  const handleUploadDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFileToUpload) {
      showToast('Please select a file to upload', 'error');
      return;
    }

    if (docFileToUpload.size > 15 * 1024 * 1024) {
      showToast('File size must be under 15MB', 'error');
      return;
    }

    setUploadingDoc(true);
    try {
      const res = await API.uploadEmployeeDocument(empIdentifier, docFileToUpload, selectedDocType);
      if (res && res.success) {
        showToast('Document uploaded successfully!', 'success');
        setIsUploadDocModalOpen(false);
        setDocFileToUpload(null);
        await loadDocuments();
      } else {
        showToast(res?.message || 'Failed to upload document', 'error');
      }
    } catch (err: any) {
      showToast('Upload failed: ' + err.message, 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleReplaceDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docToReplace || !replaceFile) {
      showToast('Please choose a replacement file', 'error');
      return;
    }

    setReplacingDoc(true);
    try {
      const res = await API.replaceEmployeeDocument(empIdentifier, docToReplace.id, replaceFile, docToReplace.documentType);
      if (res && res.success) {
        showToast('Document replaced successfully!', 'success');
        setIsReplaceDocOpen(false);
        setDocToReplace(null);
        setReplaceFile(null);
        await loadDocuments();
      } else {
        showToast(res?.message || 'Failed to replace document', 'error');
      }
    } catch (err: any) {
      showToast('Replace failed: ' + err.message, 'error');
    } finally {
      setReplacingDoc(false);
    }
  };

  const handleSaveCompleteInfo = async () => {
    setSaving(true);
    try {
      const combinedSalary = editForm.salaryInc
        ? `${editForm.salaryBase}|${editForm.salaryInc}`
        : editForm.salaryBase;

      const appNoKey = currentEmp.appNo || currentEmp.empNo || currentEmp.id;

      const updatedPayload = {
        name: editForm.name,
        fullName: editForm.name,
        phone: editForm.phone.replace(/\D/g, '').length === 10 ? `+91${editForm.phone.replace(/\D/g, '')}` : editForm.phone,
        email: editForm.email,
        gender: editForm.gender,
        dob: editForm.dob,
        bloodGroup: editForm.bloodGroup,
        aadhaarNumber: editForm.aadhaarNumber,
        desig: editForm.desig,
        designation: editForm.desig,
        department: editForm.department,
        section: editForm.section,
        branch: editForm.branch,
        reportingManager: editForm.reportingManager,
        status: editForm.status,
        salary: combinedSalary,
        offeredDoj: editForm.offeredDoj,
        experience: editForm.experience,
        retailExperience: editForm.retailExperience,
        qualification: editForm.qualification,
        previousCompany: editForm.previousCompany,
        previousDesignation: editForm.previousDesignation,
        previousSalary: editForm.previousSalary,
        fatherDetails: editForm.fatherDetails,
        motherDetails: editForm.motherDetails,
        religion: editForm.religion,
        caste: editForm.caste,
        languagesKnown: editForm.languagesKnown,
        remarks: editForm.remarks
      };

      try {
        await API.updateEmployee(empIdentifier, updatedPayload);
      } catch (errEmployeeUpdate) {
        await API.updateCandidate(appNoKey, updatedPayload);
      }

      showToast('Employee information updated successfully everywhere!', 'success');

      setCurrentEmp({
        ...currentEmp,
        ...updatedPayload
      });

      setIsEditing(false);

      if (onUpdated) {
        onUpdated();
      }
    } catch (err: any) {
      showToast('Failed to save employee changes: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (mime?: string, name?: string) => {
    if (mime && mime.startsWith('image/')) return true;
    if (name) {
      const ext = name.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');
    }
    return false;
  };

  const isPdfFile = (mime?: string, name?: string) => {
    if (mime && mime === 'application/pdf') return true;
    if (name && name.toLowerCase().endsWith('.pdf')) return true;
    return false;
  };

  return (
    <>
      <ModalPortal
        isOpen={!!currentEmp}
        onClose={onClose}
        ariaLabel={`Employee Profile - ${empName}`}
      >
        <div className="relative w-full max-w-4xl max-h-[92vh] bg-background rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border-2 border-accent/50 select-text">

        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white p-5 sm:p-6 border-b-2 border-accent/40 relative">
          {/* Action Buttons Header Top Right */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-gold px-3.5 py-1.5 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5"
                title="Edit Employee Information"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Info</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 text-xs font-black rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Cancel Edit</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 shadow-md"
              title="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Enlarged Photo / Avatar with Upload & Action Overlay */}
            <div className="relative shrink-0 group">
              <input
                ref={photoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {photo ? (
                <div className="relative">
                  <img
                    src={photo}
                    alt={empName}
                    onClick={() => setIsPhotoPreviewOpen(true)}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-accent shadow-2xl bg-white p-1 cursor-pointer hover:opacity-95 transition-all"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    style={{ display: 'none' }}
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-primary to-primary-hover text-white font-black text-3xl sm:text-4xl items-center justify-center border-4 border-accent shadow-2xl"
                  >
                    {currentEmp.initials || empName.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-primary to-primary-hover text-white font-black text-3xl sm:text-4xl flex items-center justify-center border-4 border-accent shadow-2xl cursor-pointer hover:border-amber-400 transition-all"
                  title="Click to Upload Profile Photo"
                >
                  {currentEmp.initials || empName.slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Photo Actions Button Bar */}
              <div className="flex items-center justify-center gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[10px] font-black flex items-center gap-1 shadow-xs border border-white/20 transition-all"
                  title={photo ? 'Replace Employee Photo' : 'Upload Employee Photo'}
                >
                  <Camera className="w-3 h-3 text-amber-300" />
                  <span>{uploadingPhoto ? 'Uploading...' : photo ? 'Replace' : 'Upload Photo'}</span>
                </button>

                {photo && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsPhotoPreviewOpen(true)}
                      className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all shadow-xs border border-white/20"
                      title="Preview Photo"
                    >
                      <Eye className="w-3 h-3 text-emerald-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItemToDelete({ type: 'photo', name: 'Profile Photo' });
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="p-1 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white transition-all shadow-xs border border-rose-400/40"
                      title="Remove Profile Photo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Header Text Details */}
            <div className="text-center sm:text-left space-y-1.5 min-w-0 pr-24">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="font-black text-white text-xl sm:text-2xl tracking-tight">{empName}</h2>
                <StatusBadge status={currentEmp.status || 'Joined'} size="sm" />
              </div>

              <div className="text-xs text-amber-400 font-extrabold font-mono flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/20 text-amber-300">{empCode}</span>
                <span className="text-white/50">•</span>
                <span className="text-white font-bold">{desig}</span>
                <span className="text-white/50">•</span>
                <span className="text-white font-normal">Department: {dept}</span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-white/90">
                {currentEmp.phone && (
                  <a href={`tel:${currentEmp.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-amber-300 font-bold border border-white/10">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{currentEmp.phone}</span>
                  </a>
                )}
                {currentEmp.email && (
                  <a href={`mailto:${currentEmp.email}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white/90 font-semibold border border-white/10">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>{currentEmp.email}</span>
                  </a>
                )}
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-emerald-300 font-bold">
                  <Layers className="w-3.5 h-3.5" /> Section: {section}
                </span>
                {currentEmp.branch && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/10 border border-white/10 text-amber-200 font-bold">
                    <Building className="w-3.5 h-3.5" /> {currentEmp.branch}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 p-2 sm:px-6 bg-white border-b border-accent-soft overflow-x-auto text-xs font-bold scrollbar-none sticky top-0 z-10 shadow-xs">
          {[
            { id: 'overview', label: '👤 Employment Overview' },
            { id: 'personal', label: '📋 Personal & Contact' },
            { id: 'professional', label: '💼 Experience & Roles' },
            { id: 'documents', label: `📄 Employee Documents (${documents.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all text-xs font-black ${
                activeTab === t.id
                  ? 'bg-primary text-white shadow-md ring-1 ring-accent/50'
                  : 'text-[#5D4E42] hover:bg-background hover:text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">

          {/* VIEW MODE */}
          {!isEditing ? (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-primary">Base Monthly Salary</span>
                      <div className="text-lg font-mono font-black text-emerald-800">
                        {sal.base > 0 ? `₹ ${sal.base.toLocaleString('en-IN')}` : (currentEmp.salary || '—')}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-primary">Date of Joining (DOJ)</span>
                      <div className="text-base font-extrabold text-primary">
                        {currentEmp.offeredDoj || currentEmp.estDoj || currentEmp.actualDoj || currentEmp.date || '—'}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-1">
                      <span className="text-[10px] uppercase font-black text-primary">Assigned Section</span>
                      <div className="text-base font-extrabold text-amber-700">{section}</div>
                    </div>
                  </div>

                  {/* Compensation Breakdown */}
                  <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-3">
                    <h4 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span>Compensation & Package Breakdown</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-background p-3 rounded-xl border border-accent-soft">
                        <div className="text-[9px] uppercase font-black text-primary mb-0.5">Base Salary</div>
                        <div className="text-base font-bold text-primary font-mono">₹{sal.base.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                        <div className="text-[9px] uppercase font-black text-emerald-800 mb-0.5">Monthly Incentive</div>
                        <div className="text-base font-bold text-emerald-700 font-mono">{sal.incentive > 0 ? `+₹${sal.incentive.toLocaleString('en-IN')}` : 'Included'}</div>
                      </div>
                      <div className="bg-primary p-3 rounded-xl border border-amber-400 shadow-2xs">
                        <div className="text-[9px] uppercase font-black text-white/90 mb-0.5">Total Package</div>
                        <div className="text-base font-black text-white font-mono">₹{sal.total.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Organization Placement */}
                  <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-3">
                    <h4 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                      <Building className="w-4 h-4 text-amber-600" />
                      <span>Store Floor & Department Assignment</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div><span className="text-primary block text-[10.5px] font-bold">Department</span><span className="font-extrabold text-primary text-sm">{dept}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Floor Section</span><span className="font-extrabold text-amber-700 text-sm">{section}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Designation Role</span><span className="font-extrabold text-primary">{desig}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Reporting Manager</span><span className="font-extrabold text-primary">{currentEmp.reportingManager || currentEmp.reporting_manager || 'Store Manager'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Store Branch</span><span className="font-extrabold text-primary">{currentEmp.branch || 'BSC Textiles Davanagere'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Shift Schedule</span><span className="font-extrabold text-emerald-800">General Shift (10:00 AM – 09:00 PM)</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONAL & CONTACT */}
              {activeTab === 'personal' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-4">
                    <h4 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-amber-600" />
                      <span>Personal Profile & Identification</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-primary block text-[10.5px] font-bold">Full Name</span><span className="font-extrabold text-primary text-sm">{empName}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Gender</span><span className="font-extrabold text-primary">{currentEmp.gender || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Date of Birth (DOB)</span><span className="font-extrabold text-primary">{currentEmp.dob || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Blood Group</span><span className="font-black text-rose-700">{currentEmp.bloodGroup || currentEmp.blood_group || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Religion & Caste</span><span className="font-extrabold text-primary">{currentEmp.religion || '—'} {currentEmp.caste ? `(${currentEmp.caste})` : ''}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Languages Spoken</span><span className="font-extrabold text-primary">{currentEmp.languagesKnown || currentEmp.languages_known || 'Kannada, English, Hindi'}</span></div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-4">
                    <h4 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <span>Contact Address & Family Background</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-primary block text-[10.5px] font-bold">Mobile Phone</span><span className="font-extrabold text-primary">{currentEmp.phone || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Email Address</span><span className="font-extrabold text-primary">{currentEmp.email || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Father's Details</span><span className="font-extrabold text-primary">{currentEmp.fatherDetails || currentEmp.father_details || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Mother's Details</span><span className="font-extrabold text-primary">{currentEmp.motherDetails || currentEmp.mother_details || '—'}</span></div>
                      <div className="sm:col-span-2"><span className="text-primary block text-[10.5px] font-bold">Residential Address</span><span className="font-extrabold text-primary">{currentEmp.address || currentEmp.cityState || 'Davanagere, Karnataka'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROFESSIONAL & EXPERIENCE */}
              {activeTab === 'professional' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-4">
                    <h4 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-amber-600" />
                      <span>Work Experience & Prior Employment</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><span className="text-primary block text-[10.5px] font-bold">Total Experience</span><span className="font-extrabold text-primary">{currentEmp.experience || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Retail Industry Experience</span><span className="font-extrabold text-primary">{currentEmp.retailExperience || currentEmp.retail_experience || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Previous Company</span><span className="font-extrabold text-primary">{currentEmp.previousCompany || currentEmp.previous_company || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Previous Role / Designation</span><span className="font-extrabold text-primary">{currentEmp.previousDesignation || currentEmp.previous_designation || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Previous Base Salary</span><span className="font-extrabold text-primary">{currentEmp.previousSalary || currentEmp.previous_salary || '—'}</span></div>
                      <div><span className="text-primary block text-[10.5px] font-bold">Highest Qualification</span><span className="font-extrabold text-primary">{currentEmp.qualification || '—'}</span></div>
                    </div>
                    <div className="pt-2 border-t border-accent-soft/60">
                      <span className="text-primary block text-[10.5px] mb-1 font-bold uppercase">Executive HR Remarks:</span>
                      <div className="p-3.5 rounded-xl bg-background border border-accent-soft text-xs font-semibold text-primary italic">
                        {currentEmp.remarks || 'No executive remarks recorded.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EMPLOYEE DOCUMENTS (PRODUCTION DOCUMENT MANAGEMENT) */}
              {activeTab === 'documents' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Documents Action Bar */}
                  <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-primary uppercase text-xs tracking-wider flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>Authorized Employee Document Vault</span>
                      </h4>
                      <p className="text-[11px] text-[#6B5D50] mt-0.5">
                        Permanent secure repository for KYC, certificates, offer letters and HR documentation.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsUploadDocModalOpen(true)}
                      className="btn-gold px-4 py-2 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Document</span>
                    </button>
                  </div>

                  {/* Documents List */}
                  {loadingDocs ? (
                    <div className="p-12 text-center text-primary font-bold">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
                      <span>Loading employee documents...</span>
                    </div>
                  ) : documents.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {documents.map((doc: any) => {
                        const isImg = isImageFile(doc.mimeType, doc.fileName);
                        const isPdf = isPdfFile(doc.mimeType, doc.fileName);

                        return (
                          <div
                            key={doc.id}
                            className="p-4 rounded-2xl bg-white border border-accent-soft hover:border-accent shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 ${
                                isPdf ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                                isImg ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-blue-50 text-blue-600 border border-blue-200'
                              }`}>
                                <FileText className="w-5 h-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2.5 py-0.5 rounded-md bg-accent/15 text-primary text-[10px] font-black uppercase tracking-wider">
                                    {doc.documentType}
                                  </span>
                                  <span className="text-[10px] text-[#6B5D50] font-mono">
                                    {formatFileSize(doc.fileSize)}
                                  </span>
                                </div>
                                <h5 className="font-extrabold text-primary text-xs tracking-tight truncate mt-0.5" title={doc.fileName}>
                                  {doc.fileName}
                                </h5>
                                <div className="text-[10.5px] text-[#6B5D50] flex items-center gap-2 mt-0.5">
                                  <span>Uploaded: {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}</span>
                                  <span>•</span>
                                  <span>By: {doc.uploadedBy || 'HR Staff'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Document Actions */}
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setDocToView(doc);
                                  setZoomLevel(1);
                                  setIsViewModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-accent/40 bg-white hover:bg-accent/10 text-primary font-bold text-xs flex items-center gap-1 transition-all"
                                title="View Document"
                              >
                                <Eye className="w-3.5 h-3.5 text-accent" />
                                <span>View</span>
                              </button>

                              <a
                                href={API.getEmployeeDocumentDownloadUrl(empIdentifier, doc.id)}
                                download={doc.fileName}
                                className="px-2.5 py-1.5 rounded-lg border border-accent/40 bg-white hover:bg-accent/10 text-primary font-bold text-xs flex items-center gap-1 transition-all"
                                title="Download Document"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Download</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => {
                                  setDocToReplace(doc);
                                  setReplaceFile(null);
                                  setIsReplaceDocOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-accent/30 bg-white hover:bg-amber-50 text-amber-700 transition-all"
                                title="Replace Document"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setItemToDelete({ type: 'document', id: doc.id, name: doc.fileName });
                                  setIsDeleteConfirmOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-all"
                                title="Delete Document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-accent-soft space-y-3">
                      <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                        <FileText className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-primary text-sm">No documents uploaded</h4>
                        <p className="text-xs text-[#6B5D50] mt-0.5">
                          Upload employee Aadhaar, PAN, certificates or offer letters for permanent record.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsUploadDocModalOpen(true)}
                        className="btn-gold px-4 py-2 text-xs font-black rounded-xl shadow-md inline-flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload First Document</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* EDIT FORM MODE */
            <div className="space-y-4 animate-fade-in bg-white p-5 rounded-2xl border border-accent/40 shadow-md">
              <h3 className="font-black text-primary text-sm uppercase tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-600" />
                <span>Edit Complete Employee Record</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Full Employee Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Designation Role</label>
                  <input
                    type="text"
                    value={editForm.desig}
                    onChange={(e) => setEditForm({ ...editForm, desig: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Allocated Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Assigned Floor Section</label>
                  <input
                    type="text"
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-black text-amber-700 outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Base Monthly Salary (₹)</label>
                  <input
                    type="text"
                    value={editForm.salaryBase}
                    onChange={(e) => setEditForm({ ...editForm, salaryBase: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-mono font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Monthly Incentive Bonus (₹)</label>
                  <input
                    type="text"
                    value={editForm.salaryInc}
                    onChange={(e) => setEditForm({ ...editForm, salaryInc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-mono font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Mobile Phone</label>
                  <div className="flex">
                    <span className="px-2 py-2 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-[10px] text-[#5D4E42] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={editForm.phone.replace(/\D/g, '').slice(-10)}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full px-3 py-2 rounded-r-xl rounded-l-none border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Employment Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="Joined">Joined (Active Staff)</option>
                    <option value="Offer Accepted">Offer Accepted</option>
                    <option value="Notice Period">Notice Period</option>
                    <option value="Completed Exit">Completed Exit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-primary uppercase mb-1">Date of Joining (DOJ)</label>
                  <input
                    type="date"
                    value={editForm.offeredDoj}
                    onChange={(e) => setEditForm({ ...editForm, offeredDoj: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">HR Executive Remarks</label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-semibold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-background border-t border-accent-soft flex items-center justify-between">
          <div className="text-[11px] text-primary font-bold">
            BSC Textiles HRMS • AUTHORIZED EMPLOYEE REGISTER
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-accent-soft bg-white font-extrabold text-xs text-[#5D4E42]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCompleteInfo}
                  disabled={saving}
                  className="btn-gold text-xs px-6 py-2 shadow-md flex items-center gap-1.5 font-black"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Updating Database...' : 'Save Employee Details'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="btn-primary text-xs px-6 py-2 shadow-md"
              >
                Close Profile Overview
              </button>
            )}
          </div>
        </div>
      </div>
      </ModalPortal>

      {/* ── PHOTO PREVIEW MODAL ──────────────────────────────────────────────── */}
      <ModalPortal
        isOpen={isPhotoPreviewOpen && !!photo}
        onClose={() => setIsPhotoPreviewOpen(false)}
        zIndex={1200}
        ariaLabel="Employee Profile Photo"
      >
        {photo && (
          <div className="relative max-w-xl w-full bg-white rounded-3xl p-5 border-2 border-accent/40 shadow-2xl flex flex-col items-center">
            <button
              onClick={() => setIsPhotoPreviewOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-black text-primary mb-3">Employee Profile Photo</h3>
            <img
              src={photo}
              alt={empName}
              className="max-h-[60vh] max-w-full rounded-2xl object-contain border-2 border-accent-soft"
            />
            <div className="mt-4 text-center">
              <div className="font-extrabold text-primary text-sm">{empName}</div>
              <div className="text-xs text-[#6B5D50]">{empCode} • {desig}</div>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* ── UPLOAD DOCUMENT MODAL ────────────────────────────────────────────── */}
      <ModalPortal
        isOpen={isUploadDocModalOpen}
        onClose={() => { setIsUploadDocModalOpen(false); setDocFileToUpload(null); }}
        zIndex={1200}
        ariaLabel="Upload Employee Document"
      >
        <div className="relative w-full max-w-md bg-white rounded-3xl p-6 border-2 border-accent shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <h3 className="font-black text-primary text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" />
              <span>Upload Employee Document</span>
            </h3>
            <button
              type="button"
              onClick={() => { setIsUploadDocModalOpen(false); setDocFileToUpload(null); }}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUploadDocumentSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-primary uppercase mb-1">
                Document Type
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40 bg-white"
              >
                {STANDARD_DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-primary uppercase mb-1">
                Select File (PDF, Images, DOCX - Max 15MB)
              </label>
              <input
                ref={docFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setDocFileToUpload(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs text-primary file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer"
              />
              {docFileToUpload && (
                <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selected: {docFileToUpload.name} ({formatFileSize(docFileToUpload.size)})</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => { setIsUploadDocModalOpen(false); setDocFileToUpload(null); }}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-[#5D4E42] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadingDoc || !docFileToUpload}
                className="btn-gold px-5 py-2 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingDoc ? 'Uploading...' : 'Confirm Upload'}</span>
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>

      {/* ── REPLACE DOCUMENT MODAL ───────────────────────────────────────────── */}
      <ModalPortal
        isOpen={isReplaceDocOpen && !!docToReplace}
        onClose={() => { setIsReplaceDocOpen(false); setDocToReplace(null); setReplaceFile(null); }}
        zIndex={1200}
        ariaLabel="Replace Document"
      >
        {docToReplace && (
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 border-2 border-accent shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="font-black text-primary text-base flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                <span>Replace Document</span>
              </h3>
              <button
                type="button"
                onClick={() => { setIsReplaceDocOpen(false); setDocToReplace(null); setReplaceFile(null); }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-black">Current File: {docToReplace.fileName}</div>
              <div className="text-[11px]">Type: {docToReplace.documentType} • The previous version will be retired in audit history.</div>
            </div>

            <form onSubmit={handleReplaceDocumentSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Choose New File
                </label>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs text-primary file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer"
                />
                {replaceFile && (
                  <div className="mt-2 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selected: {replaceFile.name} ({formatFileSize(replaceFile.size)})</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-accent-soft">
                <button
                  type="button"
                  onClick={() => { setIsReplaceDocOpen(false); setDocToReplace(null); setReplaceFile(null); }}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-[#5D4E42] hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replacingDoc || !replaceFile}
                  className="btn-gold px-5 py-2 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{replacingDoc ? 'Replacing...' : 'Confirm Replace'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalPortal>

      {/* ── VIEW DOCUMENT PREVIEW MODAL ───────────────────────────────────────── */}
      <ModalPortal
        isOpen={isViewModalOpen && !!docToView}
        onClose={() => { setIsViewModalOpen(false); setDocToView(null); }}
        zIndex={1200}
        ariaLabel="Document Preview"
      >
        {docToView && (
          <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border-2 border-accent">
            {/* Header */}
            <div className="p-4 bg-primary text-white flex items-center justify-between border-b border-accent/40">
              <div className="min-w-0 pr-4">
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-amber-300 text-[10px] font-black uppercase">
                  {docToView.documentType}
                </span>
                <h4 className="font-black text-sm text-white truncate mt-1">{docToView.fileName}</h4>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isImageFile(docToView.mimeType, docToView.fileName) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                      title="Fit to Screen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                <a
                  href={API.getEmployeeDocumentDownloadUrl(empIdentifier, docToView.id)}
                  download={docToView.fileName}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100 min-h-[50vh]">
              {isImageFile(docToView.mimeType, docToView.fileName) ? (
                <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
                  <img
                    src={API.getEmployeeDocumentViewUrl(empIdentifier, docToView.id)}
                    alt={docToView.fileName}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-h-[68vh] max-w-full rounded-xl object-contain shadow-lg transition-transform duration-150"
                  />
                </div>
              ) : isPdfFile(docToView.mimeType, docToView.fileName) ? (
                <iframe
                  src={API.getEmployeeDocumentViewUrl(empIdentifier, docToView.id)}
                  title={docToView.fileName}
                  className="w-full h-[72vh] rounded-xl border border-gray-300 shadow-md bg-white"
                />
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-md max-w-md space-y-3">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
                  <h4 className="font-extrabold text-primary text-base">Preview unavailable</h4>
                  <p className="text-xs text-[#6B5D50]">
                    This file format cannot be rendered directly in the browser viewer. You can download the file to inspect it.
                  </p>
                  <a
                    href={API.getEmployeeDocumentDownloadUrl(empIdentifier, docToView.id)}
                    download={docToView.fileName}
                    className="btn-gold px-5 py-2 text-xs font-black rounded-xl shadow-md inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Document</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </ModalPortal>

      {/* ── DELETE CONFIRMATION DIALOG ───────────────────────────────────────── */}
      <ModalPortal
        isOpen={isDeleteConfirmOpen && !!itemToDelete}
        onClose={() => { setIsDeleteConfirmOpen(false); setItemToDelete(null); }}
        zIndex={1200}
        ariaLabel="Delete Confirmation"
      >
        {itemToDelete && (
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 border-2 border-rose-300 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-primary text-base">
                Delete this {itemToDelete.type === 'photo' ? 'photo' : 'document'}?
              </h3>
              <p className="text-xs text-[#6B5D50] mt-1">
                {itemToDelete.name ? `"${itemToDelete.name}" will be removed.` : ''} This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsDeleteConfirmOpen(false); setItemToDelete(null); }}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-[#5D4E42] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </ModalPortal>
    </>
  );
}
