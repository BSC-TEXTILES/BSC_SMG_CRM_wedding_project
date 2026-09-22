import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession, apiFetch } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { Settings, Users, Eye, EyeOff, CircleHelp, Tag, Trash2, Shield, ShieldAlert } from 'lucide-react';
import DevToolsMonitoringPanel from '../components/DevToolsMonitoringPanel';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [activeTab, setActiveTab] = useState<'users' | 'pins' | 'security' | 'visibility' | 'questions' | 'roles'>('users');

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Store Operational PINs
  const [greeterPin, setGreeterPin] = useState('');
  const [tvPin, setTvPin] = useState('');
  const [cashPin, setCashPin] = useState('');
  const [showGreeterPin, setShowGreeterPin] = useState(false);
  const [showTvPin, setShowTvPin] = useState(false);
  const [showCashPin, setShowCashPin] = useState(false);
  const [savingPins, setSavingPins] = useState(false);

  // Page Visibility
  const [pageSettings, setPageSettings] = useState<Record<string, boolean>>({});

  // Questions
  const [questions, setQuestions] = useState<any[]>([]);
  const [qDesig, setQDesig] = useState('Sales Executive');
  const [qRound, setQRound] = useState('HR');
  const [qText, setQText] = useState('');
  const [qMax, setQMax] = useState(10);

  // Designations
  const [designations, setDesignations] = useState<string[]>([]);
  const [newDesigInput, setNewDesigInput] = useState('');
  const [pinStatus, setPinStatus] = useState({ greeter: false, tv: false, cash: false });

  const loadAll = useCallback(async () => {
    try {
      const [pData, qData, dData, crmData] = await Promise.all([
        API.getPageSettings(),
        API.call('getAllInterviewQuestions'),
        API.getDesignations(),
        API.getCrmSettings()
      ]);

      if (pData) setPageSettings(pData);
      if (qData && qData.questions) setQuestions(qData.questions);
      if (dData && dData.designations) setDesignations(dData.designations);
      if (crmData && crmData.settings) {
        // PIN values are hashed server-side and never sent to clients - the
        // fields stay empty and only accept a NEW PIN when the admin types one.
        setGreeterPin('');
        setTvPin('');
        setCashPin('');
        setPinStatus({
          greeter: !!crmData.settings.hasGreeterPin,
          tv: !!crmData.settings.hasTvPin,
          cash: !!crmData.settings.hasCashPin
        });
      }
    } catch (err: any) {
      showToast('Error loading settings', 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    if (sess?.role !== 'Admin' && sess?.role !== 'Super Admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSession(sess);
    loadAll();
  }, [navigate, loadAll]);

  // Page Settings Handlers
  const handleSaveVisibility = async () => {
    try {
      await API.savePageSettings(pageSettings);
      showToast('Page visibility saved!', 'success');
    } catch (e: any) {
      showToast('Error saving visibility', 'error');
    }
  };

  // Question Handlers
  const handleAddQuestion = async () => {
    if (!qText.trim()) {
      showToast('Question text required', 'error');
      return;
    }
    try {
      await API.call('addInterviewQuestion', { desig: qDesig, round: qRound, text: qText, max: qMax });
      showToast('Question added!', 'success');
      setQText('');
      loadAll();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await API.call('deleteInterviewQuestion', { id });
      showToast('Question deleted!', 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error deleting question', 'error');
    }
  };

  // Designation Handlers
  const handleAddDesig = async () => {
    if (!newDesigInput.trim()) return;
    try {
      await API.addDesignation(newDesigInput.trim());
      showToast('Designation added!', 'success');
      setNewDesigInput('');
      loadAll();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleDeleteDesig = async (name: string) => {
    try {
      await API.deleteDesignation(name);
      showToast(`Designation ${name} deleted!`, 'success');
      loadAll();
    } catch (e: any) {
      showToast('Error deleting designation', 'error');
    }
  };

  const handleSavePins = async () => {
    // Only PINs with a new value are sent; blank fields mean "unchanged".
    const payload: Record<string, string> = {};
    if (greeterPin.trim()) payload.greeter = greeterPin.trim();
    if (tvPin.trim()) payload.tv = tvPin.trim();
    if (cashPin.trim()) payload.cash = cashPin.trim();
    
    if (Object.keys(payload).length === 0) {
      showToast('Type a new PIN in at least one field first.', 'error');
      return;
    }
    
    // Allow up to 10 chars as per new validation
    if (!Object.values(payload).every(v => /^[a-zA-Z0-9]{4,10}$/.test(v))) {
      showToast('PINs must be 4-10 characters.', 'error');
      return;
    }
    
    setSavingPins(true);
    try {
      // Save each PIN via the new secure kiosk-pins API
      const locationId = session?.locationId || null;
      for (const [pinType, pin] of Object.entries(payload)) {
        await apiFetch('/api/kiosk-pins', {
          method: 'POST',
          body: JSON.stringify({ pinType, pin, locationId })
        });
      }
      
      showToast('Store Operational PINs updated (stored securely)!', 'success');
      setGreeterPin(''); setTvPin(''); setCashPin('');
      loadAll();
    } catch (e: any) {
      showToast('Error updating PINs: ' + (e.message || 'error'), 'error');
    } finally {
      setSavingPins(false);
    }
  };

  const tabs = [
    { key: 'users', label: 'User Accounts & Access', icon: Users },
    { key: 'pins', label: 'Store Kiosk & Cash PINs', icon: Shield },
    { key: 'security', label: 'Security & DevTools Shield', icon: ShieldAlert },
    { key: 'visibility', label: 'Page Visibility Matrix', icon: Eye },
    { key: 'questions', label: 'Interview Question Bank', icon: CircleHelp },
    { key: 'roles', label: 'Designations Master', icon: Tag }
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="System Settings & Governance"
          breadcrumbs={[{ label: tabs.find(t => t.key === activeTab)?.label || 'Settings' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-accent" />
                <span>Enterprise Administration Hub</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">Manage user credentials, role permissions, interview evaluation rubrics &amp; company designations.</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-accent-soft pb-1 overflow-x-auto scrollbar-none text-xs font-bold">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`
                    px-4 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 shadow-xs whitespace-nowrap
                    ${activeTab === t.key 
                      ? 'bg-primary text-white shadow-md font-extrabold' 
                      : 'bg-white text-[#5D4E42] border border-accent-soft hover:bg-background'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              {/* Promotion banner to Full User Management Module */}
              <div className="card-glass p-4 border border-accent/40 bg-gradient-to-r from-accent/10 via-primary/5 to-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-accent flex items-center justify-center font-black shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
                      <span>Full Access Control &amp; User Management Hub</span>
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-accent/20 text-accent uppercase">Production Feature</span>
                    </h4>
                    <p className="text-[11px] text-primary font-medium mt-0.5">
                      Configure granular section-by-section permissions (View, Add, Edit, Delete, Export), manage user limits &amp; audit security events.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/user-management')}
                  className="btn-gold text-xs px-4 py-2 font-extrabold flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  <span>Open User Management</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: STORE PINS */}
          {activeTab === 'pins' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card-glass p-6 space-y-6">
                <div>
                  <h3 className="font-extrabold text-primary text-base flex items-center gap-2">
                    <Shield className="w-5 h-5 text-accent" />
                    <span>Store Operational PINs &amp; Access Controls</span>
                  </h3>
                  <p className="text-xs text-primary font-medium mt-1">
                    Manage security PIN codes for hardware kiosks, TV monitor display, entrance greeter clicker, and daily POS cash settlement desk.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Greeter PIN */}
                  <div className="p-5 rounded-2xl bg-background border border-accent-soft space-y-4">
                    <div>
                      <div className="font-extrabold text-sm text-primary">Entrance Greeter Kiosk PIN</div>
                      <div className="text-[11px] text-primary font-medium mt-0.5">Used by entrance staff on `/greeter` tablet</div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-black uppercase text-primary">Access PIN Code</label>
                      <div className="relative">
                        <input
                          type={showGreeterPin ? "text" : "password"}
                          maxLength={6}
                          value={greeterPin}
                          placeholder={pinStatus.greeter ? 'Configured - type a new PIN to change' : 'Not configured - factory default 1234'}
                          onChange={(e) => setGreeterPin(e.target.value)}
                          className="input-modern font-mono text-sm tracking-wider pr-10 font-black text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGreeterPin(!showGreeterPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showGreeterPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TV Display PIN */}
                  <div className="p-5 rounded-2xl bg-background border border-accent-soft space-y-4">
                    <div>
                      <div className="font-extrabold text-sm text-primary">Live Store TV Screen PIN</div>
                      <div className="text-[11px] text-primary font-medium mt-0.5">Used for launch monitoring on `/tv` monitor</div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-black uppercase text-primary">Access PIN Code</label>
                      <div className="relative">
                        <input
                          type={showTvPin ? "text" : "password"}
                          maxLength={6}
                          value={tvPin}
                          placeholder={pinStatus.tv ? 'Configured - type a new PIN to change' : 'Not configured - factory default 1234'}
                          onChange={(e) => setTvPin(e.target.value)}
                          className="input-modern font-mono text-sm tracking-wider pr-10 font-black text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTvPin(!showTvPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showTvPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Cash Settlement PIN */}
                  <div className="p-5 rounded-2xl bg-background border border-accent-soft space-y-4">
                    <div>
                      <div className="font-extrabold text-sm text-primary">Cash Settlement Desk PIN</div>
                      <div className="text-[11px] text-primary font-medium mt-0.5">Used to unlock `/cash-settlement` daily audit</div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10.5px] font-black uppercase text-primary">Access PIN Code</label>
                      <div className="relative">
                        <input
                          type={showCashPin ? "text" : "password"}
                          maxLength={6}
                          value={cashPin}
                          placeholder={pinStatus.cash ? 'Configured - type a new PIN to change' : 'Not configured - factory default 1234'}
                          onChange={(e) => setCashPin(e.target.value)}
                          className="input-modern font-mono text-sm tracking-wider pr-10 font-black text-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCashPin(!showCashPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showCashPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-accent-soft">
                  <button
                    onClick={handleSavePins}
                    disabled={savingPins}
                    className="btn-primary text-xs shadow-md px-6 py-2.5 flex items-center gap-2"
                  >
                    {savingPins ? 'Saving Operational PINs…' : 'Save Operational PINs'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAGE VISIBILITY */}
          {activeTab === 'visibility' && (
            <div className="card-glass p-6 space-y-5 animate-fade-in">
              <div className="flex justify-between items-center border-b border-accent-soft pb-3">
                <div>
                  <h3 className="font-extrabold text-primary text-base">Role-Based Page Visibility Matrix</h3>
                  <p className="text-xs text-primary font-medium mt-0.5">Control module access permissions per role</p>
                </div>
                <button onClick={handleSaveVisibility} className="btn-primary text-xs shadow-md">
                  Save Visibility Settings
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {['HR', 'Manager', 'Greeter', 'Recruiter', 'Interviewer'].map(roleName => (
                  <div key={roleName} className="p-4 rounded-2xl border border-accent-soft bg-background space-y-3">
                    <div className="font-black text-sm text-primary border-b border-accent-soft pb-2 uppercase tracking-wider">{roleName} Access</div>
                    <div className="space-y-2">
                      {['dashboard', 'candidates', 'offer', 'openings', 'employees', 'dept_hiring', 'section_allocation', 'form', 'broadcast', 'settings'].map(pageKey => {
                        const key = `${roleName.toLowerCase()}_${pageKey}`;
                        const allowed = pageSettings[key] !== false;

                        return (
                          <label key={pageKey} className="flex items-center justify-between p-2 rounded-xl bg-white border border-accent-soft cursor-pointer font-bold text-primary">
                            <span className="capitalize">{pageKey.replace('_', ' ')} Module</span>
                            <input
                              type="checkbox"
                              checked={allowed}
                              onChange={(e) => setPageSettings({ ...pageSettings, [key]: e.target.checked })}
                              className="accent-primary rounded"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUESTIONS */}
          {activeTab === 'questions' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card-glass p-6 space-y-4">
                <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">Add Interview Rubric Question</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <select value={qDesig} onChange={(e) => setQDesig(e.target.value)} className="select-modern font-bold">
                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={qRound} onChange={(e) => setQRound(e.target.value)} className="select-modern font-bold">
                    <option value="HR">HR Round</option>
                    <option value="Round 2">Round 2 Technical</option>
                  </select>
                  <input type="text" placeholder="Question / Evaluation Criteria" value={qText} onChange={(e) => setQText(e.target.value)} className="input-modern sm:col-span-2" />
                </div>
                <div className="flex justify-end">
                  <button onClick={handleAddQuestion} className="btn-primary text-xs shadow-md">
                    Add Question
                  </button>
                </div>
              </div>

              <div className="card-glass p-5 space-y-4">
                <h3 className="font-extrabold text-primary text-sm">Active Evaluation Questions</h3>
                <div className="space-y-2 text-xs">
                  {questions.map((q) => (
                    <div key={q.id} className="p-3.5 rounded-xl border border-accent-soft bg-background flex items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-primary">{q.question}</div>
                        <div className="text-[10px] text-primary font-semibold">{q.designation} · {q.round} · Max Score: {q.max_score || 10}</div>
                      </div>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESIGNATIONS */}
          {activeTab === 'roles' && (
            <div className="card-glass p-6 space-y-5 animate-fade-in">
              <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">Company Designations Master List</h3>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="New Designation Name (e.g. Floor Manager)"
                  value={newDesigInput}
                  onChange={(e) => setNewDesigInput(e.target.value)}
                  className="input-modern max-w-sm"
                />
                <button onClick={handleAddDesig} className="btn-primary text-xs shadow-md">
                  Add Designation
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                {designations.map((d) => (
                  <div key={d} className="p-3 rounded-xl border border-accent-soft bg-background flex items-center justify-between font-bold text-primary">
                    <span>{d}</span>
                    <button onClick={() => handleDeleteDesig(d)} className="text-rose-600 hover:text-rose-800 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* TAB 5: SECURITY & DEVTOOLS SHIELD */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in">
              <DevToolsMonitoringPanel session={session} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
