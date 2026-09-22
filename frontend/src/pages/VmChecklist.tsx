import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import {
  ClipboardList,
  CheckCircle,
  CircleX,
  CircleMinus,
  Save,
  ArrowLeft,
  Store,
  Check,
  Building2,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Plus,
  FolderPlus,
  Tag,
  MapPin,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react';
import { API, Auth } from '../services/api';
import { showToast } from '../components/Toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from 'recharts';

export interface FloorItem {
  id?: string;
  name: string;
  label: string;
  description: string;
  badge?: string;
  sections: string[];
  isCustom?: boolean;
  createdAt?: string;
}

// Built-in Floor and Section Definitions
export const DEFAULT_VM_FLOORS: Record<string, FloorItem> = {
  'Ground Floor': {
    name: 'Ground Floor',
    label: 'Ground Floor',
    description: 'Main Entrance & Saree Galleria',
    badge: '1 Section',
    sections: ['Normal Sarees']
  },
  'First Floor': {
    name: 'First Floor',
    label: 'First Floor',
    description: 'High-Value Silk & Luxury Sarees',
    badge: '1 Section',
    sections: ['Silk Sarees (Upto Lakhs)']
  },
  'Second Floor': {
    name: 'Second Floor',
    label: 'Second Floor',
    description: 'Ladies Wear and Kids Wear',
    badge: '1 Section',
    sections: ['Ladies Wear and Kids Wear']
  },
  'Third Floor': {
    name: 'Third Floor',
    label: 'Third Floor',
    description: 'Mens Wear and Home Furnishing',
    badge: '1 Section',
    sections: ['Mens Wear and Home Furnishing']
  }
};

// Exact 10 Visual Merchandising Questions
export const DEFAULT_VM_QUESTIONS = [
  { id: 'vm_q1', title: 'Is the entire section clean, neat, and well-maintained?' },
  { id: 'vm_q2', title: 'Are products arranged according to category, colour, and size?' },
  { id: 'vm_q3', title: 'Are all racks, shelves, tables, and displays properly aligned?' },
  { id: 'vm_q4', title: 'Are new arrivals and the latest collections displayed prominently?' },
  { id: 'vm_q5', title: 'Are mannequins styled according to the current theme?' },
  { id: 'vm_q6', title: 'Are price tags, product labels, and signage correctly placed and visible?' },
  { id: 'vm_q7', title: 'Are promotional and offer displays updated and correctly positioned?' },
  { id: 'vm_q8', title: 'Is the colour blocking and overall visual theme maintained?' },
  { id: 'vm_q9', title: 'Are folded, hanging, and stacked products properly presented?' },
  { id: 'vm_q10', title: 'Does the section meet the daily VM standard and look attractive to customers?' }
];

export default function VmChecklist() {
  const session = Auth.get();
  const isAdmin = !session || session.role === 'Admin' || session.role === 'Super Admin';

  // Floor & Section Hierarchy State
  const [floorsData, setFloorsData] = useState<Record<string, FloorItem>>(DEFAULT_VM_FLOORS);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Audit Form State
  const [shift, setShift] = useState<string>('Opening');
  const [points, setPoints] = useState<any[]>(DEFAULT_VM_QUESTIONS);
  const [scores, setScores] = useState<Record<string, { score: string; remarks: string }>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Analytics Filter State
  const [filterFloor, setFilterFloor] = useState<string>('All');
  const [filterSection, setFilterSection] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterInspector, setFilterInspector] = useState<string>('All');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Admin Floor Creation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [newFloorDesc, setNewFloorDesc] = useState('');
  const [newSectionInput, setNewSectionInput] = useState('');
  const [newSectionsList, setNewSectionsList] = useState<string[]>([]);
  const [creatingFloor, setCreatingFloor] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Admin Floor Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [floorToDelete, setFloorToDelete] = useState<{ key: string; info: FloorItem } | null>(null);
  const [deletingFloor, setDeletingFloor] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const floorRes = await API.getVmFloors();
      if (floorRes && Array.isArray(floorRes.floors)) {
        const merged: Record<string, FloorItem> = { ...DEFAULT_VM_FLOORS };
        floorRes.floors.forEach((f: any) => {
          merged[f.name] = {
            id: f.id,
            name: f.name,
            label: f.name,
            description: f.description || '',
            sections: f.sections || [],
            isCustom: true,
            badge: `${f.sections.length} Section${f.sections.length > 1 ? 's' : ''}`
          };
        });
        setFloorsData(merged);
      }
    } catch (e) {
      console.error(e);
    }

    try {
      const res = await API.getVmPoints();
      if (res && res.points && res.points.length >= 11) {
        setPoints(res.points);
        initScores(res.points);
      } else {
        setPoints(DEFAULT_VM_QUESTIONS);
        initScores(DEFAULT_VM_QUESTIONS);
      }
    } catch {
      setPoints(DEFAULT_VM_QUESTIONS);
      initScores(DEFAULT_VM_QUESTIONS);
    }

    try {
      const subRes = await API.getVmSubmissions();
      if (subRes && subRes.submissions) {
        setSubmissions(subRes.submissions);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSectionToModal = () => {
    const val = newSectionInput.trim();
    if (!val) return;
    if (newSectionsList.includes(val)) {
      setNewSectionInput('');
      return;
    }
    setNewSectionsList([...newSectionsList, val]);
    setNewSectionInput('');
  };

  const handleRemoveSectionFromModal = (sec: string) => {
    setNewSectionsList(newSectionsList.filter((s) => s !== sec));
  };

  const handleCreateFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newFloorName.trim()) {
      setCreateError('Floor name is required');
      return;
    }
    if (newSectionsList.length === 0) {
      setCreateError('Please add at least one section for this floor');
      return;
    }

    setCreatingFloor(true);
    try {
      const res = await API.createVmFloor({
        name: newFloorName.trim(),
        description: newFloorDesc.trim(),
        sections: newSectionsList
      });

      if (res && res.success && res.floor) {
        setFloorsData((prev) => ({
          ...prev,
          [res.floor.name]: {
            ...res.floor,
            label: res.floor.name,
            badge: `${res.floor.sections.length} Section${res.floor.sections.length > 1 ? 's' : ''}`,
            isCustom: true
          }
        }));
        setIsCreateModalOpen(false);
        setNewFloorName('');
        setNewFloorDesc('');
        setNewSectionsList([]);
        setSubmittedMsg(`Custom Floor '${res.floor.name}' created successfully!`);
      } else {
        setCreateError(res?.message || 'Failed to create floor');
      }
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || 'Server error creating floor');
    } finally {
      setCreatingFloor(false);
    }
  };

  const handleDeleteFloor = async () => {
    if (!floorToDelete || deletingFloor) return;
    setDeleteError(null);
    setDeletingFloor(true);
    try {
      const payload = floorToDelete.info.id ? { id: floorToDelete.info.id } : { name: floorToDelete.key };
      const res = await API.deleteVmFloor(payload);
      if (res && res.success !== false) {
        setFloorsData((prev) => {
          const next = { ...prev };
          delete next[floorToDelete.key];
          return next;
        });
        if (selectedFloor === floorToDelete.key) {
          resetAllSelections();
        }
        setIsDeleteModalOpen(false);
        setFloorToDelete(null);
        setSubmittedMsg(`Floor '${floorToDelete.key}' deleted successfully.`);
      } else {
        setDeleteError(res?.message || 'Failed to delete floor');
      }
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Server error deleting floor');
    } finally {
      setDeletingFloor(false);
    }
  };

  const initScores = (qList: any[]) => {
    const initial: Record<string, { score: string; remarks: string }> = {};
    qList.forEach((p: any) => {
      initial[p.id] = { score: 'Pass', remarks: '' };
    });
    setScores(initial);
  };

  const resetAllSelections = () => {
    setSelectedFloor(null);
    setSelectedSection(null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const resetSectionOnly = () => {
    setSelectedSection(null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const handleFloorChangeFromControls = (newFloor: string) => {
    setSelectedFloor(newFloor);
    const availableSections = floorsData[newFloor]?.sections || [];
    setSelectedSection(availableSections[0] || null);
    setSubmittedMsg(null);
    initScores(points);
  };

  const handleSectionChangeFromControls = (newSection: string) => {
    setSelectedSection(newSection);
    setSubmittedMsg(null);
    initScores(points);
  };

  // Submit Audit Checklist
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloor || !selectedSection) return;

    setSubmitting(true);
    setSubmittedMsg(null);

    const total = points.length;
    const passCount = Object.values(scores).filter((s) => s.score === 'Pass').length;
    const scorePercent = total > 0 ? (passCount / total) * 100 : 100;

    const entries = points.map((p) => ({
      pointId: p.id,
      pointTitle: p.title,
      score: scores[p.id]?.score || 'Pass',
      remarks: scores[p.id]?.remarks || ''
    }));

    const auditorName = session?.fullName || session?.username || 'VM Inspector';

    try {
      await API.submitVm({
        shift,
        floor: selectedFloor,
        section: selectedSection,
        scorePercent,
        submittedBy: auditorName,
        entries
      });
      showToast('Visual Merchandising Checklist submitted successfully.', 'success');
      setSubmittedMsg(
        `Visual Merchandising Checklist submitted successfully for ${selectedFloor} —  ${selectedSection}! Score: ${scorePercent.toFixed(0)}%`
      );
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast('Unable to submit VM checklist: ' + (err.message || 'Server error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const passCount = Object.values(scores).filter((s) => s.score === 'Pass').length;
  const failCount = Object.values(scores).filter((s) => s.score === 'Fail').length;
  const naCount = Object.values(scores).filter((s) => s.score === 'NA').length;
  const currentScorePercent = points.length > 0 ? Math.round((passCount / points.length) * 100) : 100;

  // Analytics Filter & Aggregation Logic
  const filteredSubmissions = submissions.filter(sub => {
    if (filterFloor !== 'All' && sub.floor !== filterFloor) return false;
    if (filterSection !== 'All' && sub.section !== filterSection) return false;
    if (filterInspector !== 'All' && sub.submittedBy !== filterInspector) return false;
    if (filterStatus !== 'All') {
      const score = Number(sub.scorePercent || 0);
      const stat = score === 100 ? 'Passed' : score >= 80 ? 'Review' : 'Failed';
      if (filterStatus !== stat) return false;
    }
    if (filterDateFrom) {
      const subDate = sub.entryDate || (sub.createdAt ? sub.createdAt.split('T')[0] : '');
      if (subDate < filterDateFrom) return false;
    }
    if (filterDateTo) {
      const subDate = sub.entryDate || (sub.createdAt ? sub.createdAt.split('T')[0] : '');
      if (subDate > filterDateTo) return false;
    }
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      if (!sub.floor?.toLowerCase().includes(sq) && 
          !sub.section?.toLowerCase().includes(sq) && 
          !sub.submittedBy?.toLowerCase().includes(sq)) {
        return false;
      }
    }
    return true;
  });

  // VM Dashboard Metrics (Filtered)
  const totalFloors = Object.keys(floorsData).length;
  const totalSections = Object.values(floorsData).reduce((acc, floor) => acc + (floor.sections?.length || 0), 0);
  const totalInspections = filteredSubmissions.length;
  const completedInspections = filteredSubmissions.filter(s => Number(s.scorePercent) === 100).length;
  const pendingInspections = filteredSubmissions.filter(s => Number(s.scorePercent) < 100 && Number(s.scorePercent) >= 80).length;
  const failedInspections = filteredSubmissions.filter(s => Number(s.scorePercent) < 80).length;
  const latestInspection = filteredSubmissions.length > 0 ? (filteredSubmissions[0].createdAt ? new Date(filteredSubmissions[0].createdAt).toLocaleDateString() : filteredSubmissions[0].entryDate) : 'N/A';
  const attentionSectionsCount = Array.from(new Set(filteredSubmissions.filter(s => Number(s.scorePercent) < 100).map(s => s.section || 'General'))).length;
  const averageScore = totalInspections > 0 ? Math.round(filteredSubmissions.reduce((acc, curr) => acc + Number(curr.scorePercent || 0), 0) / totalInspections) : 0;

  // Chart Data: Audit Status Distribution
  const statusData = [
    { name: 'Passed', value: completedInspections, fill: '#2D8659' },
    { name: 'Review', value: pendingInspections, fill: '#B8860B' },
    { name: 'Failed', value: failedInspections, fill: '#C0392B' }
  ].filter(d => d.value > 0);

  // Chart Data: Floor-wise Performance
  const floorDataMap: Record<string, { totalScore: number; count: number }> = {};
  filteredSubmissions.forEach(sub => {
    const f = sub.floor || 'Unknown';
    if (!floorDataMap[f]) floorDataMap[f] = { totalScore: 0, count: 0 };
    floorDataMap[f].totalScore += Number(sub.scorePercent || 0);
    floorDataMap[f].count += 1;
  });
  const floorChartData = Object.keys(floorDataMap).map(f => ({
    name: f,
    score: Math.round(floorDataMap[f].totalScore / floorDataMap[f].count),
    inspections: floorDataMap[f].count
  }));

  // Chart Data: Section-wise Performance
  const sectionDataMap: Record<string, { totalScore: number; count: number; lastDate: string }> = {};
  filteredSubmissions.forEach(sub => {
    const s = sub.section || 'Unknown';
    if (!sectionDataMap[s]) sectionDataMap[s] = { totalScore: 0, count: 0, lastDate: sub.entryDate };
    sectionDataMap[s].totalScore += Number(sub.scorePercent || 0);
    sectionDataMap[s].count += 1;
    if (!sectionDataMap[s].lastDate || new Date(sub.entryDate) > new Date(sectionDataMap[s].lastDate)) {
        sectionDataMap[s].lastDate = sub.entryDate;
    }
  });
  const sectionChartData = Object.keys(sectionDataMap).map(s => ({
    name: s,
    score: Math.round(sectionDataMap[s].totalScore / sectionDataMap[s].count),
    lastDate: sectionDataMap[s].lastDate
  }));

  // Chart Data: Question-wise Performance
  const questionMap: Record<string, { title: string; pass: number; total: number }> = {};
  DEFAULT_VM_QUESTIONS.forEach(q => {
    questionMap[q.id] = { title: q.title, pass: 0, total: 0 };
  });
  filteredSubmissions.forEach(sub => {
    if (sub.entries && Array.isArray(sub.entries)) {
      sub.entries.forEach((e: any) => {
        if (questionMap[e.pointId]) {
          questionMap[e.pointId].total += 1;
          if (e.score === 'Pass') {
            questionMap[e.pointId].pass += 1;
          }
        }
      });
    }
  });
  const questionChartData = Object.keys(questionMap).map((qId, idx) => {
    const q = questionMap[qId];
    return {
      id: qId,
      number: `Q${idx + 1}`,
      title: q.title,
      passPercent: q.total > 0 ? Math.round((q.pass / q.total) * 100) : 0,
      total: q.total
    };
  });

  // Chart Data: VM Trend Chart
  const trendMap: Record<string, { totalScore: number; count: number }> = {};
  [...filteredSubmissions].reverse().forEach(sub => {
    const d = sub.entryDate || (sub.createdAt ? sub.createdAt.split('T')[0] : 'Unknown');
    if (!trendMap[d]) trendMap[d] = { totalScore: 0, count: 0 };
    trendMap[d].totalScore += Number(sub.scorePercent || 0);
    trendMap[d].count += 1;
  });
  const trendChartData = Object.keys(trendMap).map(d => ({
    date: d,
    score: Math.round(trendMap[d].totalScore / trendMap[d].count),
    count: trendMap[d].count
  }));

  const uniqueInspectors = Array.from(new Set(submissions.map(s => s.submittedBy))).filter(Boolean);

  // Floor-wise Progress Bars Data (Overall + each floor)
  const floorProgressData = [
    { name: 'Overall VM Score', score: averageScore },
    { name: 'Ground Floor', score: floorChartData.find(f => f.name === 'Ground Floor')?.score || 0 },
    { name: 'First Floor', score: floorChartData.find(f => f.name === 'First Floor')?.score || 0 },
    { name: 'Second Floor', score: floorChartData.find(f => f.name === 'Second Floor')?.score || 0 },
    { name: 'Third Floor', score: floorChartData.find(f => f.name === 'Third Floor')?.score || 0 },
  ].filter(f => f.score > 0 || f.name === 'Overall VM Score');

  // Total questions assessed across all filtered submissions
  const totalQuestionsAssessed = filteredSubmissions.reduce((acc, sub) => {
    return acc + (sub.entries?.length || 11);
  }, 0);
  const totalQuestionsPassed = filteredSubmissions.reduce((acc, sub) => {
    return acc + (sub.entries?.filter((e: any) => e.score === 'Pass').length || 0);
  }, 0);
  const totalQuestionsAttention = totalQuestionsAssessed - totalQuestionsPassed;

  return (
    <DashboardLayout
      title="Visual Merchandising Checklist"
      subtitle="Store Floor Styling & Display Standards Audit Desk"
    >
      <div className="space-y-6">
        
        {/* VIEW 1: FLOOR SELECTION (Initial State) */}
        <div className="space-y-6 animate-fade-in">
            {/* Step 1 Header Banner */}
            <div className="card-glass p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary text-accent flex items-center justify-center font-black shrink-0 shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <span>Step 1 of 2</span>
                    <span>•</span>
                    <span>Store Floor Directory</span>
                  </div>
                  <h2 className="text-xl font-black text-primary tracking-tight">Select Store Floor</h2>
                  <p className="text-xs text-primary font-medium mt-0.5">
                    Choose a store floor to begin the Visual Merchandising Audit inspection.
                  </p>
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 border border-primary/20 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Floor</span>
                </button>
              )}
            </div>

            {/* Notification Banner */}
            {submittedMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{submittedMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmittedMsg(null)}
                  className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Floor Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(floorsData).sort((a, b) => { const order = ["Ground Floor", "First Floor", "Second Floor", "Third Floor"]; const aIdx = order.indexOf(a[0]); const bIdx = order.indexOf(b[0]); return (aIdx !== -1 ? aIdx : 99) - (bIdx !== -1 ? bIdx : 99); }).map(([floorKey, floorInfo]) => (
                <div
                  key={floorKey}
                  onClick={() => setSelectedFloor(floorKey)}
                  className="card-glass p-5 text-left hover:border-accent hover:shadow-xl transition-all duration-200 group cursor-pointer flex flex-col justify-between h-64 relative overflow-hidden bg-white border border-accent/25"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary group-hover:bg-accent/20 group-hover:text-accent-hover transition-colors">
                        {floorInfo.sections.length} Section{floorInfo.sections.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-base text-primary group-hover:text-accent-hover transition-colors flex items-center gap-1.5">
                        <span>{floorInfo.label}</span>
                      </h3>
                      <p className="text-[11px] text-primary font-medium mt-0.5 line-clamp-2">
                        {floorInfo.description}
                      </p>
                    </div>

                    {/* Section Details Pills - Shows all details for this floor */}
                    <div className="pt-2 border-t border-accent-soft/60 space-y-1.5">
                      <div className="text-[9.5px] font-black uppercase text-primary/50 tracking-wider">
                        Included Sections:
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                        {floorInfo.sections.map((sec) => (
                          <span
                            key={sec}
                            className="px-2 py-0.5 rounded-md bg-background text-primary text-[10px] font-bold border border-accent-soft shrink-0"
                          >
                            {sec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-accent-soft/60 flex items-center justify-between text-xs font-black">
                    <span className="text-accent flex items-center gap-1">
                      View Sections
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFloorToDelete({ key: floorKey, info: floorInfo });
                          setDeleteError(null);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-text-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                        title={`Delete ${floorInfo.label}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>





        {/* VIEW 2: SECTION SELECTION (Floor Selected, Section Not Selected) */}
        {selectedFloor && (
          <div className="space-y-6 animate-fade-in pt-4 border-t border-accent-soft/50">
            {/* Header & Back Action */}
            <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={resetAllSelections}
                  className="p-2.5 rounded-xl border border-accent/40 bg-white hover:bg-accent/10 text-primary transition-all cursor-pointer shadow-xs"
                  title="Back to Floor Selection"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="text-xs font-black text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <span>Floor: {selectedFloor}</span>
                    <span>•</span>
                    <span>Step 2 of 2</span>
                  </div>
                  <h2 className="text-xl font-black text-primary tracking-tight">
                    Select Section on {selectedFloor}
                  </h2>
                  <p className="text-xs text-primary font-medium mt-0.5">
                    Showing only sections assigned to {selectedFloor}. Select one to load the 11 VM evaluation check points.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={resetAllSelections}
                className="btn-outline text-xs px-4 py-2 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Switch Floor</span>
              </button>
            </div>

            {/* Sections Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {floorsData[selectedFloor]?.sections.map((secName) => (
                <button
                  type="button"
                  key={secName}
                  onClick={() => {
                    setSelectedSection(secName);
                    initScores(points);
                  }}
                  className="card-glass p-6 text-left hover:border-accent hover:shadow-xl transition-all duration-200 group cursor-pointer flex flex-col justify-between h-44 bg-white border border-accent/25"
                >
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent-hover flex items-center justify-center font-black">
                      <Store className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-base text-primary group-hover:text-accent-hover transition-colors">
                      {secName}
                    </h3>
                    <p className="text-[11px] text-primary font-medium">
                      {selectedFloor} Department Section
                    </p>
                  </div>

                  <div className="pt-2 border-t border-accent-soft/60 flex items-center justify-between text-xs font-black text-accent">
                    <span>Audit Section (11 Points)</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: 11 QUESTIONS EVALUATION CHECKLIST (Floor & Section Selected) */}
        {selectedFloor && selectedSection && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in pt-4 border-t border-accent-soft/50">
            {/* Active Audit Location Banner & Controls Bar */}
            <div className="card-glass p-5 space-y-4 border-2 border-accent/40 bg-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-accent-soft/60">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary text-accent flex items-center justify-center font-black shadow-md shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary flex items-center gap-1">
                        <MapPin className="w-3 h-3 inline" /> {selectedFloor}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/20 text-accent-hover font-bold flex items-center gap-1">
                        <Tag className="w-3 h-3 inline" /> {selectedSection}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        11 VM Questions Active
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-primary tracking-tight mt-1">
                      Visual Merchandising Audit: {selectedSection}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={resetSectionOnly}
                    className="px-3 py-1.5 rounded-xl border border-accent/40 text-primary text-xs font-bold hover:bg-accent/10 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Store className="w-3.5 h-3.5 text-accent" />
                    <span>Change Section</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetAllSelections}
                    className="px-3 py-1.5 rounded-xl border border-primary/20 text-primary text-xs font-bold hover:bg-primary/5 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>Change Floor</span>
                  </button>
                </div>
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-1">
                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider">
                    Store Floor
                  </label>
                  <select
                    value={selectedFloor}
                    onChange={(e) => handleFloorChangeFromControls(e.target.value)}
                    className="select-modern font-bold text-xs mt-1 w-full"
                  >
                    {Object.keys(floorsData).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider">
                    Floor Section
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => handleSectionChangeFromControls(e.target.value)}
                    className="select-modern font-bold text-xs mt-1 w-full"
                  >
                    {floorsData[selectedFloor]?.sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase text-primary tracking-wider">
                    Audit Shift
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="select-modern font-bold text-xs mt-1 w-full"
                  >
                    <option value="Opening">Opening Audit (10 AM)</option>
                    <option value="Mid-Day">Mid-Day Check (3 PM)</option>
                    <option value="Closing">Closing Audit (9 PM)</option>
                  </select>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-gold text-xs py-2.5 px-6 font-extrabold flex items-center justify-center gap-2 w-full cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{submitting ? 'Submitting Report…' : 'Submit Audit Report'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Success Banner */}
            {submittedMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{submittedMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={resetSectionOnly}
                  className="px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-extrabold transition-colors cursor-pointer shrink-0"
                >
                  Audit Next Section &rarr;
                </button>
              </div>
            )}

            {/* Real-time Audit Score Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card-glass p-4 bg-white border border-accent-soft flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-primary/60">Compliance Score</div>
                  <div className="text-xl font-black text-primary font-mono mt-0.5">{currentScorePercent}%</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent font-black flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>

              <div className="card-glass p-4 bg-white border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-800/80">Passed</div>
                  <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">{passCount} / 11</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
              </div>

              <div className="card-glass p-4 bg-white border border-rose-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-rose-800/80">Failed</div>
                  <div className="text-xl font-black text-rose-700 font-mono mt-0.5">{failCount} / 11</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 font-black flex items-center justify-center">
                  <CircleX className="w-5 h-5" />
                </div>
              </div>

              <div className="card-glass p-4 bg-white border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase text-gray-600">N/A</div>
                  <div className="text-xl font-black text-gray-700 font-mono mt-0.5">{naCount} / 11</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 font-black flex items-center justify-center">
                  <CircleMinus className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 11 Visual Merchandising Check Points List */}
            <div className="card-glass p-6 space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-accent-soft pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider">
                    Visual Merchandising Checklist Evaluation (11 Points)
                  </h3>
                  <p className="text-xs text-primary font-medium mt-0.5">
                    Evaluating section standard compliance for: <strong className="text-primary">{selectedFloor} — {selectedSection}</strong>
                  </p>
                </div>
                <span className="text-xs font-bold text-accent">
                  {Object.keys(scores).length} of 11 Rated
                </span>
              </div>

              <div className="space-y-3.5">
                {points.map((p, idx) => {
                  const current = scores[p.id] || { score: 'Pass', remarks: '' };
                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-background/50 border border-accent-soft hover:border-accent/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-xs sm:text-sm text-primary leading-snug">
                            {p.title}
                          </span>
                        </div>
                      </div>

                      {/* Evaluation Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {(['Pass', 'Fail', 'NA'] as const).map((sc) => {
                          const selected = current.score === sc;
                          return (
                            <button
                              type="button"
                              key={sc}
                              onClick={() =>
                                setScores({
                                  ...scores,
                                  [p.id]: { ...current, score: sc }
                                })
                              }
                              className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${selected
                                ? sc === 'Pass'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : sc === 'Fail'
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                    : 'bg-gray-700 text-white border-gray-700 shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                              {sc === 'Pass' ? '✓ Pass' : sc === 'Fail' ? '✗ Fail' : '—  N/A'}
                            </button>
                          );
                        })}
                      </div>

                      {/* Remarks Input */}
                      <div className="w-full md:w-72 shrink-0">
                        <input
                          type="text"
                          placeholder="Remarks / Defect note..."
                          value={current.remarks}
                          onChange={(e) =>
                            setScores({
                              ...scores,
                              [p.id]: { ...current, remarks: e.target.value }
                            })
                          }
                          className="input-modern text-xs w-full bg-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Submit Action */}
              <div className="pt-4 border-t border-accent-soft flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetSectionOnly}
                  className="px-4 py-2 rounded-xl border border-accent/40 text-primary text-xs font-bold hover:bg-accent/10 transition-all cursor-pointer flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Choose Another Section</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-gold text-xs py-2.5 px-6 font-extrabold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Submitting Report…' : 'Submit Audit Report'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* AREAS REQUIRING ATTENTION */}
        <div className="space-y-4 pt-8 border-t border-accent-soft/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-rose-700 tracking-tight flex items-center gap-2">
                <CircleMinus className="w-5 h-5" />
                Areas Requiring Attention
              </h3>
              <p className="text-xs text-primary font-medium">Sections and questions that consistently score low.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-glass p-4 bg-white border-rose-200">
              <h4 className="text-xs font-black uppercase text-rose-800 mb-3">Lowest Performing Sections</h4>
              <div className="space-y-2">
                {sectionChartData.filter(s => s.score < 80).sort((a,b) => a.score - b.score).slice(0, 3).map((sec, i) => (
                  <div key={i} className="flex justify-between items-center text-xs font-bold text-primary p-2 bg-rose-50 rounded-lg border border-rose-100">
                    <span>{sec.name}</span>
                    <span className="text-rose-700">{sec.score}%</span>
                  </div>
                ))}
                {sectionChartData.filter(s => s.score < 80).length === 0 && <p className="text-xs text-primary/60 p-2 italic">All sections are performing well above 80%!</p>}
              </div>
            </div>
            <div className="card-glass p-4 bg-white border-amber-200">
              <h4 className="text-xs font-black uppercase text-amber-800 mb-3">Lowest Performing Questions</h4>
              <div className="space-y-2">
                {questionChartData.filter(q => q.passPercent < 80).sort((a,b) => a.passPercent - b.passPercent).slice(0, 3).map((q, i) => (
                  <div key={i} className="flex justify-between items-start text-xs font-bold text-primary p-2 bg-amber-50 rounded-lg border border-amber-100 gap-2">
                    <span className="truncate flex-1" title={q.title}><span className="text-amber-700 mr-1">{q.number}</span>{q.title}</span>
                    <span className="text-amber-700 whitespace-nowrap">{q.passPercent}% Pass</span>
                  </div>
                ))}
                {questionChartData.filter(q => q.passPercent < 80).length === 0 && <p className="text-xs text-primary/60 p-2 italic">All questions have a pass rate above 80%!</p>}
              </div>
            </div>
          </div>
        </div>

        {/* SAVED RECORDS DASHBOARD */}
        <div className="space-y-4 pt-8 border-t border-accent-soft/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-primary tracking-tight">Recent Inspections</h3>
              <p className="text-xs text-primary font-medium">History of saved Visual Merchandising checklists (filtered by selection).</p>
            </div>
            <div className="px-3 py-1 bg-accent/10 text-accent font-bold text-[10px] uppercase rounded-full tracking-widest">
              {filteredSubmissions.length} Records
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="card-glass p-8 text-center bg-white">
              <ClipboardList className="w-10 h-10 text-primary/30 mx-auto mb-3" />
              <h4 className="text-sm font-black text-primary mb-1">No Inspections Found</h4>
              <p className="text-xs text-primary/60">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSubmissions.slice(0, 24).map((sub: any) => {
                const subScore = Number(sub.scorePercent || 0);
                const isPerfect = subScore >= 80;
                const d = new Date(sub.entryDate || sub.createdAt).toLocaleDateString();
                const totalQ = sub.entries ? sub.entries.length : 11;
                const passedQ = sub.entries ? sub.entries.filter((e: any) => e.score === 'Pass').length : Math.round((subScore / 100) * 11);
                
                return (
                  <div key={sub.id} className="card-glass p-4 bg-white border border-accent/20 relative overflow-hidden group cursor-pointer hover:border-accent transition-colors" onClick={() => {
                    // Clicking to view inspection detail could populate the form or open a modal.
                    setSelectedFloor(sub.floor);
                    setSelectedSection(sub.section);
                    setShift(sub.shift);
                    if (sub.entries) {
                        const newScores: any = {};
                        sub.entries.forEach((e: any) => { newScores[e.pointId] = { score: e.score, remarks: e.remarks || '' }; });
                        setScores(newScores);
                    }
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }}>
                    <div className={`absolute top-0 left-0 w-1 h-full ${subScore >= 80 ? 'bg-emerald-500' : subScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-[10px] font-black uppercase text-primary/60">{d}</div>
                      <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${subScore >= 80 ? 'bg-emerald-100 text-emerald-700' : subScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {subScore}% {subScore >= 80 ? 'Pass' : subScore >= 50 ? 'Review' : 'Failed'}
                      </div>
                    </div>
                    <div className="font-extrabold text-sm text-primary mb-1">{sub.floor}</div>
                    <div className="text-xs font-bold text-accent mb-2">{sub.section || 'General Section'}</div>
                    <div className="text-[10px] font-bold text-primary mb-3">
                      {passedQ} / {totalQ} Questions Passed
                    </div>
                    <div className="pt-3 border-t border-accent-soft/60 flex justify-between items-center text-[10px] font-medium text-primary">
                      <span>{sub.shift || 'Opening'} Shift</span>
                      <span className="font-bold">{sub.submittedBy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        
        {/* --- VM ANALYTICS DASHBOARD --- */}
        <div className="space-y-6">
          {/* Dashboard Header & Filters */}
          <div className="card-glass p-5 bg-gradient-to-r from-primary/5 via-accent/5 to-white border-2 border-accent/30 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Visual Merchandising Analytics
                </h2>
                <p className="text-xs text-primary font-medium mt-0.5">
                  Real-time insights and performance metrics derived from actual saved inspections.
                </p>
              </div>
              <div className="w-full md:w-64">
                <input
                  type="text"
                  placeholder="Search floor, section, or inspector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-modern text-xs w-full bg-white shadow-sm"
                />
              </div>
            </div>

{/* Filter Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-4 border-t border-accent-soft/60">
              <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)} className="select-modern text-xs bg-white">
                <option value="All">All Floors</option>
                {Object.keys(floorsData).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="select-modern text-xs bg-white">
                <option value="All">All Sections</option>
                {(filterFloor === 'All' ? Object.values(floorsData).flatMap(f => f.sections) : floorsData[filterFloor]?.sections || []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-modern text-xs bg-white">
                <option value="All">All Statuses</option>
                <option value="Passed">Passed (100%)</option>
                <option value="Review">Review (80-99%)</option>
                <option value="Failed">Failed (&lt;80%)</option>
              </select>
              <select value={filterInspector} onChange={e => setFilterInspector(e.target.value)} className="select-modern text-xs bg-white">
                <option value="All">All Inspectors</option>
                {uniqueInspectors.map(ins => <option key={ins} value={ins}>{ins}</option>)}
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="input-modern text-xs bg-white"
                placeholder="From Date"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="input-modern text-xs bg-white"
                placeholder="To Date"
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setFilterFloor('All'); setFilterSection('All'); setFilterStatus('All'); setFilterInspector('All'); setFilterDateFrom(''); setFilterDateTo(''); setSearchQuery(''); }} className="btn-outline text-[10px] uppercase font-bold py-2 px-3 w-full justify-center">
                  Clear Filters
                </button>
              </div>
            </div>
            </div>
          </div>

          {/* Overall Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
            <div className="card-glass p-3 bg-white border-accent-soft text-center flex flex-col justify-center">
              <span className="text-[9px] font-black uppercase text-primary/60">Average VM Score</span>
              <span className="text-2xl font-black text-primary mt-1">{averageScore}%</span>
            </div>
            <div className="card-glass p-3 bg-white border-accent-soft text-center">
              <span className="text-[9px] font-black uppercase text-primary/60">Total Floors</span>
              <span className="text-xl font-black text-primary mt-1">{totalFloors}</span>
            </div>
            <div className="card-glass p-3 bg-white border-accent-soft text-center">
              <span className="text-[9px] font-black uppercase text-primary/60">Sections</span>
              <span className="text-xl font-black text-primary mt-1">{totalSections}</span>
            </div>
            <div className="card-glass p-3 bg-white border-accent-soft text-center">
              <span className="text-[9px] font-black uppercase text-primary/60">Total Audits</span>
              <span className="text-xl font-black text-primary mt-1">{totalInspections}</span>
            </div>
            <div className="card-glass p-3 bg-emerald-50 border-emerald-200 text-center">
              <span className="text-[9px] font-black uppercase text-emerald-800">Passed Audits</span>
              <span className="text-xl font-black text-emerald-700 mt-1">{completedInspections}</span>
            </div>
            <div className="card-glass p-3 bg-amber-50 border-amber-200 text-center">
              <span className="text-[9px] font-black uppercase text-amber-800">Pending Audits</span>
              <span className="text-xl font-black text-amber-700 mt-1">{pendingInspections}</span>
            </div>
            <div className="card-glass p-3 bg-rose-50 border-rose-200 text-center">
              <span className="text-[9px] font-black uppercase text-rose-800">Failed Audits</span>
              <span className="text-xl font-black text-rose-700 mt-1">{failedInspections}</span>
            </div>
            <div className="card-glass p-3 bg-blue-50 border-blue-200 text-center">
              <span className="text-[9px] font-black uppercase text-blue-800">Attention Sections</span>
              <span className="text-xl font-black text-blue-700 mt-1">{attentionSectionsCount}</span>
            </div>
            <div className="card-glass p-3 bg-white border-accent-soft text-center flex flex-col justify-center">
              <span className="text-[9px] font-black uppercase text-primary/60">Latest Audit</span>
              <span className="text-[11px] font-black text-primary mt-1">{latestInspection}</span>
            </div>
          </div>

          {/* Charts Row 1: Overall Score & Floor Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overall VM Score Ring */}
            <div className="card-glass p-5 bg-white border-accent/20 flex flex-col items-center justify-center text-center col-span-1">
              <h3 className="text-sm font-black uppercase text-primary mb-6">Overall VM Score</h3>
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#F5F0EB" strokeWidth="8" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke={averageScore >= 80 ? '#2D8659' : averageScore >= 50 ? '#B8860B' : '#C0392B'} strokeWidth="8" strokeDasharray={`${(averageScore / 100) * 283} 283`} strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-primary">{averageScore}%</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-md ${averageScore >= 80 ? 'bg-emerald-100 text-emerald-800' : averageScore >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                    {averageScore >= 80 ? 'Pass' : averageScore >= 50 ? 'Review' : 'Failed'}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center w-full">
                <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="text-xs font-black text-primary/60">Total Questions</div>
                  <div className="text-lg font-black text-primary">{totalQuestionsAssessed}</div>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="text-xs font-black text-emerald-800">Passed</div>
                  <div className="text-lg font-black text-emerald-700">{totalQuestionsPassed}</div>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                  <div className="text-xs font-black text-rose-800">Attention</div>
                  <div className="text-lg font-black text-rose-700">{totalQuestionsAttention}</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-primary/60 font-medium">
                Based on <strong className="text-primary">{totalInspections}</strong> filtered audits.
              </div>
            </div>

            {/* Floor-wise Performance Chart */}
            <div className="card-glass p-5 bg-white border-accent/20 col-span-1 lg:col-span-2">
              <h3 className="text-sm font-black uppercase text-primary mb-4">Floor-wise Performance</h3>
              <div className="h-56 flex items-center justify-center">
                {floorChartData.length === 0 ? (
                  <span className="text-xs text-primary/50 font-bold">No data available</span>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={floorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8DDD4" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5D50', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5D50' }} domain={[0, 100]} />
                    <Tooltip cursor={{ fill: '#FBF8F5' }} contentStyle={{ borderRadius: '12px', border: '1px solid #E8DDD4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {floorChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#2D8659' : entry.score >= 50 ? '#B8860B' : '#C0392B'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row 2: Status Distribution & VM Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card-glass p-5 bg-white border-accent/20">
              <h3 className="text-sm font-black uppercase text-primary mb-2">Audit Status Distribution</h3>
              <div className="h-52 flex items-center justify-center">
                {statusData.length === 0 ? (
                  <span className="text-xs text-primary/50 font-bold">No data available</span>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card-glass p-5 bg-white border-accent/20 col-span-1 lg:col-span-2">
              <h3 className="text-sm font-black uppercase text-primary mb-2">VM Score Trend</h3>
              <div className="h-52 flex items-center justify-center">
                {trendChartData.length === 0 ? (
                  <span className="text-xs text-primary/50 font-bold">No data available</span>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8DDD4" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5D50' }} minTickGap={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B5D50' }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="score" stroke="#D4A58A" strokeWidth={3} dot={{ r: 3, fill: '#D4A58A' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Floor-wise Progress Bars */}
          <div className="card-glass p-5 bg-white border-accent/20">
            <h3 className="text-sm font-black uppercase text-primary mb-4">Overall Progress Bars</h3>
            <div className="space-y-4">
              {floorProgressData.map((floor, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-primary">
                    <span className="truncate pr-2">{floor.name}</span>
                    <span className={floor.score >= 80 ? 'text-emerald-700' : floor.score >= 50 ? 'text-amber-700' : 'text-rose-700'}>{floor.score}%</span>
                  </div>
                  <div className="w-full bg-border-soft rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full ${floor.score >= 80 ? 'bg-status-success' : floor.score >= 50 ? 'bg-status-warning' : 'bg-status-danger'}`} style={{ width: `${floor.score}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Bars: Section & Question Wise */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-glass p-5 bg-white border-accent/20">
              <h3 className="text-sm font-black uppercase text-primary mb-4">Section-wise Performance</h3>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {sectionChartData.length === 0 && <p className="text-xs text-primary/50">No sections match criteria.</p>}
                {sectionChartData.map((sec, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-primary">
                      <span className="truncate pr-2">{sec.name}</span>
                      <span className={sec.score >= 80 ? 'text-emerald-700' : sec.score >= 50 ? 'text-amber-700' : 'text-rose-700'}>
                        {sec.score}% {sec.score >= 80 ? 'Pass' : sec.score >= 50 ? 'Review' : 'Failed'}
                      </span>
                    </div>
                    <div className="w-full bg-border-soft rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${sec.score >= 80 ? 'bg-status-success' : sec.score >= 50 ? 'bg-status-warning' : 'bg-status-danger'}`} style={{ width: `${sec.score}%` }}></div>
                    </div>
                    {sec.lastDate && (
                      <div className="text-[10px] text-primary/50 font-medium">
                        Last inspected: {sec.lastDate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glass p-5 bg-white border-accent/20">
              <h3 className="text-sm font-black uppercase text-primary mb-4">Question-wise Performance</h3>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {questionChartData.map((q) => (
                  <div key={q.id} className="space-y-1.5">
                    <div className="flex justify-between items-start text-xs font-bold text-primary gap-2">
                      <span className="truncate flex-1" title={q.title}>
                        <span className="text-accent mr-1">{q.number}</span>
                        {q.title}
                      </span>
                      <span className={q.passPercent >= 80 ? 'text-emerald-700' : 'text-rose-700'}>
                        {q.passPercent}% Pass / {100 - q.passPercent}% Attention
                      </span>
                    </div>
                    <div className="w-full bg-border-soft rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${q.passPercent >= 80 ? 'bg-status-success' : 'bg-status-danger'}`} style={{ width: `${q.passPercent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* --- END VM ANALYTICS DASHBOARD --- */}
</div>
      {/* CREATE NEW FLOOR / FOLDER MODAL (ADMIN ONLY) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="card-glass bg-white rounded-3xl w-full max-w-lg shadow-2xl border-2 border-accent/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-primary via-primary to-[#3D2B1F] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center font-black">
                  <FolderPlus className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Create New Floor / Department Folder</h3>
                  <p className="text-xs text-accent">Admin Store Configuration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateFloorSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <CircleX className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Floor Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-primary tracking-wider">
                  Floor / Folder Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fourth Floor, Basement Galleria, Mezzanine"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  className="input-modern text-xs w-full font-bold"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase text-primary tracking-wider">
                  Description / Department Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ethnic Wear, Bridal Studio, Accessories"
                  value={newFloorDesc}
                  onChange={(e) => setNewFloorDesc(e.target.value)}
                  className="input-modern text-xs w-full"
                />
              </div>

              {/* Department Sections */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase text-primary tracking-wider">
                  Department Sections <span className="text-rose-600">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Bridal Lehengas, Designer Kurtas"
                    value={newSectionInput}
                    onChange={(e) => setNewSectionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSectionToModal();
                      }
                    }}
                    className="input-modern text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddSectionToModal}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-extrabold hover:bg-primary-hover cursor-pointer"
                  >
                    + Add Section
                  </button>
                </div>

                {/* Section Pills Display */}
                <div className="p-3 bg-background rounded-xl border border-accent-soft/80 min-h-16 flex flex-wrap items-center gap-1.5">
                  {newSectionsList.length === 0 ? (
                    <span className="text-xs text-primary/50 italic">
                      No sections added yet. Type a section name above and click "+ Add Section".
                    </span>
                  ) : (
                    newSectionsList.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-primary text-xs font-bold border border-accent/40 shadow-2xs"
                      >
                        <Tag className="w-3 h-3 text-accent" />
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSectionFromModal(s)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Quick suggestion tags */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-primary/60">Quick Suggestions:</span>
                <div className="flex flex-wrap gap-1">
                  {['Bridal Studio', 'Accessories', 'Footwear', 'Jewellery', 'Custom Tailoring', 'Western Wear'].map(
                    (sugg) => (
                      <button
                        type="button"
                        key={sugg}
                        onClick={() => {
                          if (!newSectionsList.includes(sugg)) {
                            setNewSectionsList([...newSectionsList, sugg]);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 hover:bg-accent/20 text-accent-hover font-semibold transition-colors cursor-pointer"
                      >
                        + {sugg}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-accent-soft flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent/30 text-primary text-xs font-bold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFloor}
                  className="btn-gold text-xs px-5 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {creatingFloor ? 'Creating Floor…' : 'Create Store Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Floor Confirmation Modal */}
      {isDeleteModalOpen && floorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-accent-soft w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
                <TriangleAlert className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-primary tracking-tight">Delete Store Floor</h3>
                <p className="text-sm text-primary font-medium mt-1">
                  Are you sure you want to delete <span className="font-black text-red-600">{floorToDelete.key}</span>?
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                <p className="text-[11px] font-semibold text-amber-800 leading-relaxed">
                  <span className="font-black">Warning:</span> Deleting this floor will remove its configuration including all linked sections.
                  Historical inspection records that reference this floor will be preserved for audit purposes, but the floor will no longer appear in the directory, floor filters, or new inspection creation.
                </p>
              </div>
              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-left">
                  <p className="text-[11px] font-semibold text-red-700">{deleteError}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-background border-t border-accent-soft flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setIsDeleteModalOpen(false); setFloorToDelete(null); setDeleteError(null); }}
                disabled={deletingFloor}
                className="px-4 py-2.5 rounded-xl border border-accent/30 text-primary text-xs font-bold hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFloor}
                disabled={deletingFloor}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-black shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {deletingFloor ? (
                  <>
                    <span className="spinner" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Floor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
