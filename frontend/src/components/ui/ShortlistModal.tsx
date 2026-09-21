import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Award, Briefcase, DollarSign, Calendar, Sparkles, UserCheck, Layers, Building, CircleHelp, Star, ShieldCheck } from 'lucide-react';
import { API } from '../../services/api';
import { showToast } from '../Toast';
import { BSC_DEPARTMENTS, getSectionsForDepartment } from '../../utils/bscDepartments';

interface ShortlistModalProps {
  candidate: any | null;
  isOpen: boolean;
  onClose: () => void;
  onShortlistConfirmed: () => void;
}

export default function ShortlistModal({ candidate, isOpen, onClose, onShortlistConfirmed }: ShortlistModalProps) {
  const [saving, setSaving] = useState<boolean>(false);

  const fileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return API.fileUrl ? API.fileUrl(url) : url;
  };

  // Screening Questionnaire State
  const [retailExp, setRetailExp] = useState<string>('1-2 Years');
  const [communicationScore, setCommunicationScore] = useState<string>('4 Stars - Good');
  const [expectedSalary, setExpectedSalary] = useState<string>('');
  const [joiningTimeline, setJoiningTimeline] = useState<string>('Immediate (Within 3 Days)');
  const [verificationStatus, setVerificationStatus] = useState<string>('Self-Certified');

  // Allocation State
  const [department, setDepartment] = useState<string>('Mens');
  const [section, setSection] = useState<string>('');
  const [desig, setDesig] = useState<string>('');
  const [branch, setBranch] = useState<string>('BSC EXCLUSIVE DAVANAGERE');
  const [remarks, setRemarks] = useState<string>('');

  useEffect(() => {
    if (candidate) {
      setDesig(candidate.desig || candidate.designation || 'Sales Executive');
      setDepartment(candidate.department || 'Mens');
      setSection(candidate.section || '');
      setExpectedSalary(candidate.previousSalary || candidate.salary || '');
      setRemarks(candidate.remarks || '');
    }
  }, [candidate]);

  if (!isOpen || !candidate) return null;

  const availableSections = getSectionsForDepartment(department);

  const handleConfirmShortlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const answersObj = {
        retailExp,
        communicationScore,
        expectedSalary,
        joiningTimeline,
        verificationStatus
      };

      const compiledRemarks = remarks
        ? `[Shortlist Screening: ${communicationScore} | Exp: ${retailExp}] ${remarks}`
        : `[Shortlist Screening: ${communicationScore} | Exp: ${retailExp}] Shortlisted for ${department} department.`;

      const payload = {
        status: 'Shortlisted',
        desig,
        designation: desig,
        department,
        section: section || null, // Optional floor section
        branch,
        salary: expectedSalary,
        remarks: compiledRemarks,
        shortlistAnswers: JSON.stringify(answersObj)
      };

      await API.updateCandidate(candidate.appNo || candidate.id, payload);

      showToast(`${candidate.name || 'Candidate'} shortlisted successfully!`, 'success');
      onShortlistConfirmed();
      onClose();
    } catch (err: any) {
      showToast('Failed to shortlist candidate: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const photo = fileUrl(candidate.photoUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-primary/70 backdrop-blur-md transition-all animate-fade-in select-text">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-background rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border-2 border-accent/50">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white p-5 sm:p-6 border-b-2 border-accent/40 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20 shadow-md"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {photo ? (
                <img
                  src={photo}
                  alt={candidate.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-accent shadow-md bg-white p-0.5"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-accent font-black text-xl flex items-center justify-center border-2 border-accent shadow-md">
                  {candidate.initials || candidate.name?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider">
                  Candidate Evaluation
                </span>
                <span className="font-mono text-xs text-white/80">{candidate.appNo || candidate.empNo}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">{candidate.name}</h2>
              <p className="text-xs text-white/90 font-semibold mt-0.5">
                Applied Role: <strong className="text-amber-300 font-extrabold">{candidate.desig || 'Staff'}</strong> • Phone: {candidate.phone}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleConfirmShortlist} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          
          {/* Section 1: Screening Questionnaire Card */}
          <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-4">
            <h3 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>1. Candidate Shortlisting & Screening Questions</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Retail Industry Experience
                </label>
                <select
                  value={retailExp}
                  onChange={(e) => setRetailExp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40 bg-background"
                >
                  <option value="Fresh Candidate">Fresh Candidate (No Prior Exp)</option>
                  <option value="< 1 Year">&lt; 1 Year Experience</option>
                  <option value="1-2 Years">1-2 Years Retail Exp</option>
                  <option value="2-5 Years">2-5 Years Textiles / Retail Exp</option>
                  <option value="5+ Years Senior">5+ Years Senior Floor Experience</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Communication & Personality Score
                </label>
                <select
                  value={communicationScore}
                  onChange={(e) => setCommunicationScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40 bg-background"
                >
                  <option value="5 Stars - Exceptional">⭐⭐⭐⭐⭐ 5 Stars (Exceptional)</option>
                  <option value="4 Stars - Good">⭐⭐⭐⭐ 4 Stars (Good Communication)</option>
                  <option value="3 Stars - Average">⭐⭐⭐ 3 Stars (Average / Acceptable)</option>
                  <option value="2 Stars - Needs Training">⭐⭐ 2 Stars (Needs Floor Training)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Expected Monthly Salary (₹)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 18000"
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-mono font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40 bg-background"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Joining Readiness & Notice Period
                </label>
                <select
                  value={joiningTimeline}
                  onChange={(e) => setJoiningTimeline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40 bg-background"
                >
                  <option value="Immediate (Within 3 Days)">Immediate (Within 3 Days)</option>
                  <option value="1 Week">1 Week Notice</option>
                  <option value="15 Days">15 Days Notice</option>
                  <option value="1 Month">1 Month Notice</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Department, Section & Role Allocation Card */}
          <div className="p-5 rounded-2xl bg-white border border-accent-soft shadow-xs space-y-4">
            <h3 className="font-black text-primary uppercase text-xs tracking-wider border-b border-accent-soft pb-2.5 flex items-center gap-2">
              <Building className="w-4 h-4 text-accent" />
              <span>2. Department, Section & Role Assignment</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Target Department
                </label>
                <select
                  value={department}
                  onChange={(e) => { setDepartment(e.target.value); setSection(''); }}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {BSC_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1 flex items-center justify-between">
                  <span>Assigned Floor Section</span>
                  <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">(Optional)</span>
                </label>
                {availableSections.length > 0 ? (
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-accent outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="">-- Leave Optional / Unassigned --</option>
                    {availableSections.map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Optional section (e.g. Ethnic Wear)"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-accent outline-none focus:ring-2 focus:ring-accent/40"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Offered Designation / Role
                </label>
                <input
                  type="text"
                  value={desig}
                  onChange={(e) => setDesig(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-primary uppercase mb-1">
                  Store Branch
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-primary uppercase mb-1">
                Recruiter Screening Remarks & Notes
              </label>
              <textarea
                rows={2}
                placeholder="Enter candidate shortlisting notes, recruiter remarks or special conditions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-accent-soft text-xs font-semibold text-primary outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          </div>

          {/* Modal Sticky Footer */}
          <div className="p-4 bg-background rounded-2xl border border-accent-soft flex items-center justify-between">
            <div className="text-[11px] text-primary font-bold">
              Candidate status updates to <span className="text-primary font-black">Shortlisted</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-accent-soft bg-white font-extrabold text-xs text-[#5D4E42]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-gold text-xs px-6 py-2 shadow-md flex items-center gap-1.5 font-black"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{saving ? 'Shortlisting...' : 'Confirm & Mark Shortlisted'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
