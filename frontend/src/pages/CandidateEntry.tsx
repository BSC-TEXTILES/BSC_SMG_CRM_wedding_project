import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { optimizeFile } from '../utils/fileOptimizer';
import { 
  User, Phone, Mail, MapPin, Calendar, Briefcase, Award, 
  FileText, ShieldCheck, CircleCheck, Upload, Sparkles, ArrowRight, ArrowLeft, Image as ImageIcon, FileCheck
} from 'lucide-react';

export default function CandidateEntryPage() {
  const [step, setStep] = useState(1);
  const [designations, setDesignations] = useState<string[]>([]);
  const [dupWarn, setDupWarn] = useState('');
  const [editAppNo, setEditAppNo] = useState<string | null>(null);

  // Form Fields - Step 1
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [dob, setDob] = useState('');
  const [offeredDoj, setOfferedDoj] = useState('');
  const [desig, setDesig] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [retailExperience, setRetailExperience] = useState('');
  const [previousCompany, setPreviousCompany] = useState('');
  const [previousDesignation, setPreviousDesignation] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [fatherDetails, setFatherDetails] = useState('');
  const [motherDetails, setMotherDetails] = useState('');
  const [religion, setReligion] = useState('');
  const [caste, setCaste] = useState('');
  const [religionCaste, setReligionCaste] = useState('');
  const [languagesKnown, setLanguagesKnown] = useState<string[]>([]);
  const [previousSalary, setPreviousSalary] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');

  // Files
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);

  const [existingResume, setExistingResume] = useState('');
  const [existingPhoto, setExistingPhoto] = useState('');
  const [existingAadhaar, setExistingAadhaar] = useState('');

  const [declaration, setDeclaration] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Submitting Registration...');
  const [successAppNo, setSuccessAppNo] = useState('');

  useEffect(() => {
    API.getPublicDesignations().then(res => {
      if (res && res.designations) setDesignations(res.designations);
    }).catch(() => {});

    // Check Edit Mode
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
      setEditAppNo(editId);
      setLoading(true);
      API.call('getCandidates', { appNo: editId }).then(res => {
        if (res.candidates && res.candidates.length > 0) {
          const c = res.candidates[0];
          setName(c.name || '');
          setEmail(c.email || '');
          setPhone(c.phone || '');
          setAddress(c.address || '');
          setGender(c.gender || '');
          setBloodGroup(c.bloodGroup || '');
          setDob(c.dob ? c.dob.split('T')[0] : '');
          setOfferedDoj(c.offeredDoj ? c.offeredDoj.split('T')[0] : '');
          setDesig(c.desig || '');
          setQualification(c.qualification || '');
          setExperience(c.experience || '');
          setRetailExperience(c.retailExperience || '');
          setPreviousCompany(c.previousCompany || '');
          setPreviousDesignation(c.previousDesignation || '');
          setPreviousSalary(c.previousSalary || c.currentSalary || c.current_salary || '');
          setExpectedSalary(c.expectedSalary || c.expected_salary || '');
          setAadhaarNumber(c.aadhaarNumber || '');
          setFatherDetails(c.fatherDetails || '');
          setMotherDetails(c.motherDetails || '');
          setReligionCaste(c.religionCaste || '');
          if (c.religionCaste) {
            const parts = c.religionCaste.split(' / ');
            setReligion(parts[0] || c.religionCaste);
            setCaste(parts[1] || '');
          }
          setLanguagesKnown(c.languagesKnown ? (typeof c.languagesKnown === 'string' ? (c.languagesKnown.startsWith('[') ? JSON.parse(c.languagesKnown) : [c.languagesKnown]) : c.languagesKnown) : []);
          setDeclaration(true);
          setExistingResume(c.resumeUrl || '');
          setExistingPhoto(c.photoUrl || '');
          setExistingAadhaar(c.aadharUrl || c.aadhaarUrl || '');
        }
        setLoading(false);
      }).catch(err => {
        showToast('Failed to load candidate data', 'error');
        setLoading(false);
      });
    }
  }, []);

  const checkDuplicate = async (ph: string) => {
    if (ph.length < 10) {
      setDupWarn('');
      return;
    }
    try {
      const d = await API.checkDuplicate(ph);
      if (d.exists) {
        setDupWarn(`⚠️ This phone number was already registered by ${d.name} (${d.appNo}, applied ${d.appliedOn}).`);
      } else {
        setDupWarn('');
      }
    } catch (e) {}
  };

  const handleLangToggle = (lang: string) => {
    setLanguagesKnown(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleGoStep2 = () => {
    if (!name.trim() || !phone.trim() || !dob || !gender || !address.trim() || !desig || !qualification || !experience || !aadhaarNumber || !bloodGroup || !religion || !caste.trim()) {
      showToast('Please fill out all mandatory fields marked with (*)', 'error');
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (!declaration) {
      showToast('You must agree to the declaration', 'error');
      return;
    }
    if (!editAppNo && (!resumeFile || !photoFile || !aadhaarFile)) {
      showToast('Please upload all mandatory documents', 'error');
      return;
    }

    setLoading(true);
    setLoadingText('Optimizing documents...');
    try {
      let resumeUrl = existingResume;
      let photoUrl = existingPhoto;
      let aadhaarUrl = existingAadhaar;

      let targetAppNo = editAppNo;
      if (!targetAppNo) {
        const genRes = await API.getNextAppNo();
        targetAppNo = genRes.appNo;
      }

      if (resumeFile || photoFile || aadhaarFile) {
        const formData = new FormData();
        if (name) formData.append('name', name);
        
        try {
          if (resumeFile) {
            const optimizedResume = await optimizeFile(resumeFile, 'Resume');
            formData.append('resume', optimizedResume);
          }
          if (photoFile) {
            const optimizedPhoto = await optimizeFile(photoFile, 'Candidate Photo');
            formData.append('photo', optimizedPhoto);
          }
          if (aadhaarFile) {
            const optimizedAadhaar = await optimizeFile(aadhaarFile, 'Aadhaar Document');
            formData.append('aadhar', optimizedAadhaar);
          }
        } catch (optimizationError: any) {
          // If any file fails the 800KB validation, we stop the whole process and alert the user
          showToast(optimizationError.message, 'error');
          setLoading(false);
          return;
        }
        
        setLoadingText('Uploading files to server...');
        const uploadRes = await API.uploadDocuments(formData, name, targetAppNo);
        if (uploadRes.success) {
          if (uploadRes.resumeUrl) resumeUrl = uploadRes.resumeUrl;
          if (uploadRes.photoUrl) photoUrl = uploadRes.photoUrl;
          if (uploadRes.aadhaarUrl) aadhaarUrl = uploadRes.aadhaarUrl;
        }
      }

      setLoadingText('Finalizing Registration...');
      const payload = {
        name,
        email,
        phone: phone.length === 10 ? `+91${phone}` : phone,
        address,
        gender,
        bloodGroup,
        dob,
        offeredDoj,
        desig,
        qualification,
        experience,
        retailExperience,
        previousCompany,
        previousDesignation,
        previousSalary,
        expectedSalary,
        aadhaarNumber,
        fatherDetails,
        motherDetails,
        religion,
        caste,
        religionCaste,
        languagesKnown,
        resumeUrl,
        photoUrl,
        aadhaarUrl,
        source: 'Walk-in',
        status: 'New'
      };

      if (editAppNo) {
        const res = await API.call('updateCandidateFull', { appNo: targetAppNo, updates: payload });
        if (!res || res.success === false) {
          throw new Error(res?.message || 'Update failed. Please try again.');
        }
        showToast('Registration details updated successfully!', 'success');
        setSuccessAppNo(targetAppNo);
      } else {
        const res = await API.addCandidate({ appNo: targetAppNo, ...payload });
        setSuccessAppNo(res.appNo || targetAppNo);
        showToast(`Registration Successful! App No: ${res.appNo || targetAppNo}`, 'success');
      }

      setStep(3);
      window.scrollTo(0, 0);
    } catch (err: any) {
      showToast('Error submitting registration: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const defaultPositions = ['Sales Executive', 'Cashier', 'Billing Executive', 'HR', 'Store Assistant', 'Stock Executive', 'Visual Merchandiser', 'Floor Manager', 'Security', 'Housekeeping', 'Helper', 'Other'];
  const POSITIONS = Array.from(new Set([...(designations || []), ...defaultPositions])).filter(Boolean);
  const QUALIFICATIONS = ['SSLC', 'PUC', 'Diploma', 'Graduate', 'Other'];
  const EXP_LEVELS = ['Fresher', 'Less than 1 Year', '1–2 Years', '2–5 Years', 'More than 5 Years'];
  const LANGUAGES = ['Kannada', 'English', 'Hindi', 'Telugu', 'Tamil', 'Marathi', 'Others'];

  return (
    <div className="min-h-screen bg-background pb-12">
      <ToastContainer />

      {/* Modern Header */}
      <header className="bg-primary p-4 sm:p-5 text-white shadow-lg sticky top-0 z-30 border-b border-accent/30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BSC Logo" className="w-11 h-11 object-contain rounded-xl bg-white p-1 shadow-md border border-black/20" />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight">BSC Candidate Registration</h1>
              <div className="text-[10px] text-accent font-bold uppercase tracking-widest mt-0.5">
                BSC EXCLUSIVE DAVANAGERE
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-black/10 px-3 py-1.5 rounded-full border border-black/10">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Official Recruitment Portal</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Step Stepper Indicator */}
        {step !== 3 && (
          <div className="card-glass p-4 text-xs font-extrabold space-y-2">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary' : 'text-emerald-700'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 1 ? 'bg-primary text-white shadow-md ring-2 ring-accent' : 'bg-emerald-600 text-white'}`}>
                  {step > 1 ? '✓' : '1'}
                </span>
                <span className="hidden sm:inline">Step 1: Personal &amp; Career Info</span>
                <span className="sm:hidden">Step 1</span>
              </div>

              <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary' : 'text-[#6B5D50]'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === 2 ? 'bg-primary text-white shadow-md ring-2 ring-accent' : 'bg-background border border-accent-soft'}`}>
                  2
                </span>
                <span className="hidden sm:inline">Step 2: Documents &amp; Declaration</span>
                <span className="sm:hidden">Step 2</span>
              </div>
            </div>

            {/* Animated Progress Bar Line */}
            <div className="h-1.5 w-full bg-accent-soft rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>
        )}

        {/* STEP 1 FORM */}
        {step === 1 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">
                  1. Personal &amp; Contact Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Full Name (As per Aadhaar) *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Mobile Phone Number *</label>
                  <div className="flex">
                    <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setPhone(v); checkDuplicate(v); }}
                      placeholder="10-digit mobile number"
                      className="input-modern rounded-l-none"
                    />
                  </div>
                  {dupWarn && (
                    <div className="p-2.5 mt-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
                      {dupWarn}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="select-modern">
                    <option value="">Select Gender</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Blood Group *</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="select-modern">
                    <option value="">Select Blood Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not Known'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1">Complete Residential Address *</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House No, Street, Area, City, Pin Code"
                  className="textarea-modern"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Aadhaar Number (12 Digits) *</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="12-digit Aadhaar number"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Religion *</label>
                  <select value={religion} onChange={(e) => setReligion(e.target.value)} className="select-modern">
                    <option value="">Select Religion</option>
                    {['Hindu', 'Muslim', 'Christian', 'Jain', 'Sikh', 'Buddhist', 'Other'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Caste / Category *</label>
                  <input
                    type="text"
                    value={caste}
                    onChange={(e) => setCaste(e.target.value)}
                    placeholder="e.g. General, OBC, SC, ST, Cat-1, 2A, 3B..."
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Father's Name &amp; Occupation (Optional)</label>
                  <input
                    type="text"
                    value={fatherDetails}
                    onChange={(e) => setFatherDetails(e.target.value)}
                    placeholder="Father details"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Mother's Name &amp; Occupation (Optional)</label>
                  <input
                    type="text"
                    value={motherDetails}
                    onChange={(e) => setMotherDetails(e.target.value)}
                    placeholder="Mother details"
                    className="input-modern"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-2">Languages Known *</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <label key={lang} className="flex items-center gap-1.5 bg-background border border-accent-soft px-3.5 py-2 rounded-xl cursor-pointer font-semibold text-xs text-primary hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={languagesKnown.includes(lang)}
                        onChange={() => handleLangToggle(lang)}
                        className="rounded accent-primary"
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2: Professional Information */}
            <div className="space-y-4 pt-4 border-t border-accent-soft">
              <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">
                  2. Position &amp; Professional Details
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Position Applied For *</label>
                  <select value={desig} onChange={(e) => setDesig(e.target.value)} className="select-modern font-extrabold">
                    <option value="">Select Desired Role</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Highest Qualification *</label>
                  <select value={qualification} onChange={(e) => setQualification(e.target.value)} className="select-modern">
                    <option value="">Select Qualification</option>
                    {QUALIFICATIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Total Work Experience *</label>
                  <select value={experience} onChange={(e) => setExperience(e.target.value)} className="select-modern">
                    <option value="">Select Experience Level</option>
                    {EXP_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Earliest Date of Joining (Earliest Availability)</label>
                  <input
                    type="date"
                    value={offeredDoj}
                    onChange={(e) => setOfferedDoj(e.target.value)}
                    className="input-modern"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-primary">Prior work experience? *</label>
                <div className="space-y-2">
                  {[
                    'Yes, in a clothing/apparel store',
                    'Yes, in another type of retail store',
                    'Worked but not in the retail field',
                    'No, fresher / no prior work experience'
                  ].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 p-3 rounded-xl border border-accent-soft bg-background cursor-pointer text-xs font-semibold text-primary hover:bg-white transition-colors">
                      <input
                        type="radio"
                        name="retailExp"
                        value={opt}
                        checked={retailExperience === opt}
                        onChange={(e) => setRetailExperience(e.target.value)}
                        className="accent-primary"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Previous Company / Store Name</label>
                  <input
                    type="text"
                    value={previousCompany}
                    onChange={(e) => setPreviousCompany(e.target.value)}
                    placeholder="Previous employer name"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Previous Designation / Role</label>
                  <input
                    type="text"
                    value={previousDesignation}
                    onChange={(e) => setPreviousDesignation(e.target.value)}
                    placeholder="Previous role title"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Previous Salary (₹ Monthly)</label>
                  <input
                    type="text"
                    value={previousSalary}
                    onChange={(e) => setPreviousSalary(e.target.value)}
                    placeholder="e.g. 18000"
                    className="input-modern font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Expected Salary (₹ Monthly)</label>
                  <input
                    type="text"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g. 22000"
                    className="input-modern font-bold text-emerald-800"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t border-accent-soft">
              <button
                type="button"
                onClick={handleGoStep2}
                className="btn-primary flex items-center gap-2 shadow-md"
              >
                <span>Proceed to Step 2: Documents</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 FORM */}
        {step === 2 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">
                3. Mandatory Document Uploads &amp; Declaration
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Photo Upload */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-accent-soft bg-background text-center space-y-2 hover:border-primary transition-colors">
                <ImageIcon className="w-8 h-8 text-accent mx-auto" />
                <div className="font-extrabold text-xs text-primary">Candidate Passport Photo *</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="photo-input"
                />
                <label htmlFor="photo-input" className="inline-block px-3 py-1.5 rounded-lg bg-white border border-accent-soft text-xs font-bold text-primary cursor-pointer hover:bg-primary hover:text-white transition-colors">
                  {photoFile ? photoFile.name : (existingPhoto ? 'Change Photo' : 'Choose Image')}
                </label>
              </div>

              {/* Aadhaar Upload */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-accent-soft bg-background text-center space-y-2 hover:border-primary transition-colors">
                <FileCheck className="w-8 h-8 text-accent mx-auto" />
                <div className="font-extrabold text-xs text-primary">Aadhaar Card (Front/Back) *</div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAadhaarFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="aadhar-input"
                />
                <label htmlFor="aadhar-input" className="inline-block px-3 py-1.5 rounded-lg bg-white border border-accent-soft text-xs font-bold text-primary cursor-pointer hover:bg-primary hover:text-white transition-colors">
                  {aadhaarFile ? aadhaarFile.name : (existingAadhaar ? 'Change Aadhaar' : 'Choose Document')}
                </label>
              </div>

              {/* Resume Upload */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-accent-soft bg-background text-center space-y-2 hover:border-primary transition-colors">
                <FileText className="w-8 h-8 text-accent mx-auto" />
                <div className="font-extrabold text-xs text-primary">Resume / CV Document *</div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="resume-input"
                />
                <label htmlFor="resume-input" className="inline-block px-3 py-1.5 rounded-lg bg-white border border-accent-soft text-xs font-bold text-primary cursor-pointer hover:bg-primary hover:text-white transition-colors">
                  {resumeFile ? resumeFile.name : (existingResume ? 'Change Resume' : 'Choose File')}
                </label>
              </div>
            </div>

            {/* Declaration Checkbox */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-primary">
                <input
                  type="checkbox"
                  checked={declaration}
                  onChange={(e) => setDeclaration(e.target.checked)}
                  className="mt-0.5 rounded accent-primary"
                />
                <span>
                  I hereby declare that all information provided in this registration form is true, correct, and complete to the best of my knowledge. I understand that any false statement or omission may lead to immediate disqualification.
                </span>
              </label>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Step 1</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-gold flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <span>{loadingText}</span>
                ) : (
                  <>
                    <span>Complete Candidate Registration</span>
                    <CircleCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 SUCCESS SCREEN */}
        {step === 3 && (
          <div className="card-glass p-8 sm:p-12 text-center space-y-5 animate-fade-in shadow-2xl my-8">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CircleCheck className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-primary tracking-tight">Registration Successfully Submitted! 🎉</h2>
              <p className="text-sm text-primary font-medium mt-1">Thank you for submitting your application to BSC The Textile Mall.</p>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 inline-block">
              <span className="text-xs uppercase font-black text-primary block">Application Reference Number</span>
              <span className="text-2xl font-mono font-black text-primary tracking-wider">{successAppNo}</span>
            </div>

            <div className="pt-4 border-t border-accent-soft flex justify-center gap-3">
              <button
                onClick={() => window.location.href = '/wedding-registration'}
                className="btn-primary text-xs"
              >
                Register a Wedding
              </button>
              <button
                onClick={() => window.location.href = '/candidate-entry'}
                className="btn-secondary text-xs"
              >
                Add Another Candidate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
