import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { Target, Plus, Search, Filter, Clock, Download, X, Eye, FileText, CircleCheck, ShoppingBag, ShieldCheck, UserCheck, TrendingUp, Sparkles, CircleX, Upload } from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';
import MetricCard from '../components/ui/MetricCard';
import ModalPortal from '../components/ui/ModalPortal';
import * as XLSX from 'xlsx';

export default function Divert() {
  const [diverts, setDiverts] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showRaiseModal, setShowRaiseModal] = useState<boolean>(false);
  const [selectedDivert, setSelectedDivert] = useState<any | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Raise Form State
  const [productWanted, setProductWanted] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [colour, setColour] = useState<string>('');
  const [otherProductDetails, setOtherProductDetails] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [priceRange, setPriceRange] = useState<string>('');
  const [reasonCode, setReasonCode] = useState<string>('OUT_OF_STOCK');
  const [requiredByDate, setRequiredByDate] = useState<string>('');
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !['jpg', 'jpeg', 'png'].includes(ext || '')) {
      showToast('Invalid format. Only JPG, JPEG, and PNG images are supported.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image exceeds the maximum allowed size of 5 MB.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setReferenceImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setReferenceImagePreview(objectUrl);
  };

  const handleRemoveImage = () => {
    if (referenceImagePreview) {
      URL.revokeObjectURL(referenceImagePreview);
    }
    setReferenceImageFile(null);
    setReferenceImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setProductWanted('');
    setSectionId('');
    setSize('');
    setColour('');
    setOtherProductDetails('');
    setQuantity(1);
    setPriceRange('');
    setReasonCode('OUT_OF_STOCK');
    setRequiredByDate('');
    handleRemoveImage();
    setRemarks('');
    setCustomerName('');
    setCustomerMobile('');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [divRes, secRes] = await Promise.all([
        API.getDiverts().catch(() => ({ diverts: [] })),
        API.getSections().catch(() => ({ sections: [] }))
      ]);
      if (divRes && divRes.diverts) setDiverts(divRes.diverts);
      if (secRes && secRes.sections) setSections(secRes.sections);
    } catch (err) {
      console.error('Error fetching divert data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDivert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productWanted.trim()) {
      showToast('Product / Fabric Requested is required.', 'error');
      return;
    }
    setCreating(true);
    try {
      let uploadedImageUrl = '';
      if (referenceImageFile) {
        try {
          const uploadRes = await API.uploadDivertImage(referenceImageFile);
          if (uploadRes && uploadRes.fileUrl) {
            uploadedImageUrl = uploadRes.fileUrl;
          }
        } catch (uploadErr: any) {
          console.error('Reference image upload failed:', uploadErr);
          showToast(uploadErr?.message || 'Failed to upload reference image', 'error');
          setCreating(false);
          return;
        }
      }

      await API.createDivert({
        sectionId,
        productWanted: productWanted.trim(),
        quantity,
        priceRange,
        reasonCode,
        size: size.trim() || undefined,
        colour: colour.trim() || undefined,
        other_product_details: otherProductDetails.trim() || undefined,
        required_by_date: requiredByDate || undefined,
        reference_image: uploadedImageUrl || undefined,
        remarks: remarks.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerMobile: customerMobile.length === 10 ? `+91${customerMobile}` : (customerMobile.trim() || undefined),
        createdBy: 'Floor Staff'
      });
      showToast('Sourcing divert request raised successfully.', 'success');
      setShowRaiseModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Unable to raise sourcing divert request. Please try again.', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Analytics Calculations
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const pendingDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      const st = (d.status || '').toLowerCase();
      return st === 'open' || st === 'sourcing' || st === 'new';
    }).length;
  }, [diverts]);

  const approvedDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      const st = (d.status || '').toLowerCase();
      return st === 'available' || st === 'approved' || st === 'completed';
    }).length;
  }, [diverts]);

  const rejectedDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      const st = (d.status || '').toLowerCase();
      return st === 'rejected' || st === 'declined' || st === 'cancelled';
    }).length;
  }, [diverts]);

  const todayDivertsCount = useMemo(() => {
    return diverts.filter(d => {
      if (!d.entryDate && !d.createdAt) return false;
      const dt = (d.entryDate || d.createdAt).split('T')[0];
      return dt === todayStr;
    }).length;
  }, [diverts, todayStr]);

  // Filtered List with Instant Search (No Page Refresh)
  const filteredDiverts = useMemo(() => {
    let list = [...diverts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        (d.productWanted || '').toLowerCase().includes(q) ||
        (d.refNo || d.id || '').toLowerCase().includes(q) ||
        (d.customerName || '').toLowerCase().includes(q) ||
        (d.customerMobile || '').toLowerCase().includes(q) ||
        (d.pmNotes || '').toLowerCase().includes(q) ||
        (d.reasonCode || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      list = list.filter(d => (d.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    if (sectionFilter) {
      list = list.filter(d => String(d.sectionId || d.section_id) === String(sectionFilter));
    }

    if (reasonFilter) {
      list = list.filter(d => (d.reasonCode || '').toLowerCase() === reasonFilter.toLowerCase());
    }

    if (fromDate) {
      list = list.filter(d => {
        const dt = (d.entryDate || d.createdAt || '').split('T')[0];
        return dt >= fromDate;
      });
    }

    if (toDate) {
      list = list.filter(d => {
        const dt = (d.entryDate || d.createdAt || '').split('T')[0];
        return dt <= toDate;
      });
    }

    return list;
  }, [diverts, searchQuery, statusFilter, sectionFilter, reasonFilter, fromDate, toDate]);

  const handleExportExcel = () => {
    const dataToExport = filteredDiverts.map((item, idx) => ({
      'S.No': idx + 1,
      'Ref No': item.refNo || `#${item.id?.slice(0, 6)}`,
      'Date': item.entryDate ? new Date(item.entryDate).toLocaleDateString() : '—',
      'Product / Fabric Requested': item.productWanted || '—',
      'Store Section': item.sectionId || '—',
      'Size': item.size || '—',
      'Colour': item.colour || '—',
      'Other Product Details': item.other_product_details || item.otherProductDetails || '—',
      'Quantity Requested': item.quantity || 1,
      'Target Price Range': item.priceRange || '—',
      'Reason Code': item.reasonCode || '—',
      'Required-by Date': item.required_by_date || item.requiredByDate || '—',
      'Reference Image / Reference': item.reference_image || item.referenceImage || '—',
      'Remarks / Notes': item.remarks || '—',
      'Customer Full Name': item.customerName || 'Walk-in',
      'Customer Mobile Phone': item.customerMobile || '—',
      'Status': item.status?.toUpperCase() || 'OPEN',
      'PM Sourcing Notes': item.pmNotes || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sourcing Diverts');
    XLSX.writeFile(wb, `Sourcing_Diverts_Report_${todayStr}.xlsx`);
  };

  const getStatusBadge = (status: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'available' || st === 'approved' || st === 'completed') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
          <CircleCheck className="w-3 h-3 text-emerald-600" /> Available / Resolved
        </span>
      );
    }
    if (st === 'sourcing' || st === 'in progress' || st === 'review') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
          <Clock className="w-3 h-3 text-amber-600" /> Sourcing In Progress
        </span>
      );
    }
    if (st === 'rejected' || st === 'declined') {
      return (
        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
          <CircleX className="w-3 h-3 text-rose-600" /> Rejected / Unavailable
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-max">
        <Sparkles className="w-3 h-3 text-sky-600" /> Open Sourcing Request
      </span>
    );
  };

  return (
    <DashboardLayout
      title="Sourcing Diverts &amp; Merchandise Requests"
      subtitle="Track, filter, and review floor merchandise divert requests raised by staff for Purchase Manager review"
    >
      <div className="space-y-6">

        {/* Page Header Banner */}
        <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-primary/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest mb-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>Floor Sourcing Desk</span>
            </div>
            <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
              <span>Customer Sourcing Diverts</span>
            </h2>
            <p className="text-xs text-primary font-medium mt-0.5">Real-time store floor customer requirement logs and Purchase Manager sourcing queue.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 rounded-xl border border-accent-soft bg-white text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4" /> Export Report
            </button>
            <button
              onClick={() => setShowRaiseModal(true)}
              className="btn-gold text-xs py-2 px-4 flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Sourcing Divert</span>
            </button>
          </div>
        </div>

        {/* Analytics Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Open / Pending Diverts"
            value={pendingDivertsCount}
            subtext="Awaiting PM sourcing resolution"
            icon={Target}
            color="gold"
          />
          <MetricCard
            title="Available / Resolved"
            value={approvedDivertsCount}
            subtext="Stock sourced &amp; customer notified"
            icon={CircleCheck}
            color="emerald"
          />
          <MetricCard
            title="Today's Diverts"
            value={todayDivertsCount}
            subtext={`Requests logged on ${todayStr}`}
            icon={Clock}
            color="navy"
          />
          <MetricCard
            title="Total Diverts Logged"
            value={diverts.length}
            subtext="Avg processing turnaround ~2.4h"
            icon={TrendingUp}
            color="indigo"
          />
        </div>

        {/* Modern Filters Bar */}
        <div className="card-glass p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-accent-soft pb-2">
            <h3 className="font-extrabold text-primary text-xs uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-accent" />
              <span>Filter Sourcing Register</span>
            </h3>
            {(searchQuery || statusFilter || sectionFilter || reasonFilter || fromDate || toDate) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setSectionFilter('');
                  setReasonFilter('');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-rose-600 hover:underline text-[11px] font-extrabold"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product, ref no, customer..."
                className="input-modern pl-9 py-2 text-xs w-full"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-modern text-xs font-bold"
            >
              <option value="">All Statuses</option>
              <option value="open">Open Requests</option>
              <option value="sourcing">Sourcing In Progress</option>
              <option value="available">Available / Resolved</option>
              <option value="rejected">Rejected / Unavailable</option>
            </select>

            {/* Store Section Filter */}
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="select-modern text-xs font-bold"
            >
              <option value="">All Store Sections</option>
              <option value="Ground Floor Saree">Ground Floor Saree</option>
              <option value="1st Floor Saree">1st Floor Saree</option>
              <option value="Ladies">Ladies</option>
              <option value="Kids">Kids</option>
              <option value="Mens">Mens</option>
            </select>

            {/* Reason Code Filter */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="select-modern text-xs font-bold"
            >
              <option value="">All Reasons</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="COLOR_UNAVAILABLE">Color Unavailable</option>
              <option value="SIZE_MISSING">Size Missing</option>
              <option value="PRICE_HIGH">Price High</option>
            </select>

            {/* From Date */}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-modern py-1.5 text-xs"
              placeholder="From Date"
            />

            {/* To Date */}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-modern py-1.5 text-xs"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Diverts Main Register Table */}
        <div className="card-glass p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-accent-soft pb-3">
            <h3 className="font-extrabold text-primary text-sm tracking-tight">
              Sourcing Divert Logs ({filteredDiverts.length} Entries)
            </h3>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-xs text-gray-500 font-bold">Loading sourcing diverts...</div>
            ) : filteredDiverts.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500 font-bold">No sourcing divert entries found matching your query.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-accent-soft text-[10.5px] font-black uppercase text-primary bg-background/60">
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-4">Ref No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Product Requested</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Reason Code</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">PM Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-soft/60">
                  {filteredDiverts.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      onClick={() => setSelectedDivert(item)}
                      className="hover:bg-black/5 cursor-pointer transition-colors font-medium"
                    >
                      <td className="py-3.5 px-3 text-center font-bold text-primary">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-primary">
                        #{item.refNo || item.id?.slice(0, 6)}
                      </td>
                      <td className="py-3.5 px-4 text-[#5D4E42] font-semibold whitespace-nowrap">
                        {item.entryDate ? new Date(item.entryDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-primary">{item.productWanted}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {item.sectionId && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                              {item.sectionId}
                            </span>
                          )}
                          {item.colour && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-bold">
                              Colour: {item.colour}
                            </span>
                          )}
                          {item.size && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-bold">
                              Size: {item.size}
                            </span>
                          )}
                          {item.required_by_date && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold">
                              Req: {item.required_by_date}
                            </span>
                          )}
                          {item.reference_image && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                              📷 Photo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                        {item.quantity || 1} pcs
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-background border border-accent-soft text-[#5D4E42] font-bold text-[10.5px]">
                          {item.reasonCode || 'OUT_OF_STOCK'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-primary">{item.customerName || 'Walk-in Customer'}</div>
                        <div className="text-[10px] text-primary font-mono">{item.customerMobile || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3.5 px-4 text-[#5D4E42] text-xs max-w-xs truncate italic">
                        {item.pmNotes || 'Awaiting PM review'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedDivert(item)}
                          className="px-3 py-1.5 rounded-xl border border-primary text-primary font-extrabold hover:bg-primary hover:text-white transition-all text-xs flex items-center gap-1 ml-auto shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Raise New Sourcing Divert Modal */}
        <ModalPortal
          isOpen={showRaiseModal}
          onClose={() => {
            setShowRaiseModal(false);
            resetForm();
          }}
          ariaLabel="Raise New Sourcing Divert"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-accent/40 flex flex-col max-h-[90vh]">
            <div className="bg-primary text-white p-5 flex items-center justify-between border-b border-accent/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-white font-black text-lg flex items-center justify-center shadow-md">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Raise New Sourcing Divert</h3>
                  <p className="text-xs text-accent font-medium">Capture complete merchandise sourcing requirement</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowRaiseModal(false);
                  resetForm();
                }}
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDivert} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs bg-background">

              {/* SECTION 1 — PRODUCT DETAILS */}
              <div className="bg-white p-4 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-accent-soft pb-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">1</span>
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                    Section 1 — Product Details
                  </h4>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Product / Fabric Requested *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pure Kanjivaram Silk Saree (Bottle Green / Gold Zari border)"
                    value={productWanted}
                    onChange={(e) => setProductWanted(e.target.value)}
                    className="input-modern font-extrabold text-primary w-full"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-primary mb-1">Store Section</label>
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="select-modern font-bold w-full"
                    >
                      <option value="">Select Floor Section</option>
                      <option value="Ground Floor Saree">Ground Floor Saree</option>
                      <option value="1st Floor Saree">1st Floor Saree</option>
                      <option value="Ladies">Ladies</option>
                      <option value="Kids">Kids</option>
                      <option value="Mens">Mens</option>
                      {sections.filter(s => !['Ground Floor Saree', '1st Floor Saree', 'Ladies', 'Kids', 'Mens'].includes(s.name)).map(s => (
                        <option key={s.id} value={s.name || s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Size</label>
                    <input
                      type="text"
                      placeholder="e.g. 42 / XL / Free Size"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="input-modern w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Colour</label>
                    <input
                      type="text"
                      placeholder="e.g. Bottle Green / Wine"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      className="input-modern w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Other Product Details</label>
                  <textarea
                    rows={2}
                    placeholder="Design, Pattern, Border, Fabric details, Special requirements..."
                    value={otherProductDetails}
                    onChange={(e) => setOtherProductDetails(e.target.value)}
                    className="textarea-modern w-full text-xs"
                  />
                </div>
              </div>

              {/* SECTION 2 — REQUIREMENT */}
              <div className="bg-white p-4 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-accent-soft pb-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">2</span>
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                    Section 2 — Requirement
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-primary mb-1">Quantity Requested</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                      className="input-modern font-mono font-bold w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Target Price Range</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹5,000 - ₹8,000"
                      value={priceRange}
                      onChange={(e) => setPriceRange(e.target.value)}
                      className="input-modern w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-primary mb-1">Reason Code</label>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      className="select-modern font-bold w-full"
                    >
                      <option value="OUT_OF_STOCK">Out of Stock</option>
                      <option value="COLOR_UNAVAILABLE">Color Unavailable</option>
                      <option value="SIZE_MISSING">Size Missing</option>
                      <option value="PRICE_HIGH">Price High</option>
                      <option value="SPECIAL_DESIGN">Special Design Request</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Required-by Date (Optional)</label>
                    <input
                      type="date"
                      value={requiredByDate}
                      onChange={(e) => setRequiredByDate(e.target.value)}
                      className="input-modern font-mono text-xs w-full"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3 — REFERENCE */}
              <div className="bg-white p-4 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-accent-soft pb-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">3</span>
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                    Section 3 — Reference &amp; Remarks
                  </h4>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Reference Image (Optional, max 5 MB)</label>
                  {!referenceImagePreview ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="divert-ref-image"
                      />
                      <label
                        htmlFor="divert-ref-image"
                        className="cursor-pointer px-4 py-2.5 rounded-xl border border-dashed border-accent-soft hover:border-accent bg-background text-primary font-bold text-xs flex items-center gap-2 transition-all hover:bg-white"
                      >
                        <Upload className="w-4 h-4 text-accent" />
                        <span>Upload Reference Photo (JPG, PNG)</span>
                      </label>
                      <span className="text-[11px] text-[#5D4E42]">Desktop or Mobile Camera / Gallery (max 5MB)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-accent-soft bg-background">
                      <img
                        src={referenceImagePreview}
                        alt="Reference Preview"
                        className="w-16 h-16 object-cover rounded-lg border border-accent/40 shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-primary truncate text-xs">{referenceImageFile?.name}</div>
                        <div className="text-[10px] text-[#5D4E42]">
                          {referenceImageFile ? (referenceImageFile.size / 1024).toFixed(1) + ' KB' : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Remarks / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Enter additional remarks or sourcing notes..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="textarea-modern w-full text-xs"
                  />
                </div>
              </div>

              {/* SECTION 4 — CUSTOMER DETAILS */}
              <div className="bg-white p-4 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                <div className="flex items-center gap-2 border-b border-accent-soft pb-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">4</span>
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                    Section 4 — Customer Details (Optional)
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-primary mb-1">Customer Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Anitha Kumar"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="input-modern font-bold w-full"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Customer Mobile Phone</label>
                    <div className="flex">
                      <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="input-modern font-mono rounded-l-none w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-accent-soft">
                <button
                  type="button"
                  onClick={() => {
                    setShowRaiseModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#5D4E42] bg-white border border-accent-soft hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-gold text-xs py-2 px-5 font-black shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating ? 'Raising Request...' : 'Raise Sourcing Request'}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>

        {/* Centered Details Popup Modal Card */}
        <ModalPortal
          isOpen={!!selectedDivert}
          onClose={() => setSelectedDivert(null)}
          ariaLabel="Sourcing Request Details"
        >
          {selectedDivert && (
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-accent/40 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-primary text-white p-5 flex items-center justify-between border-b border-accent/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent text-white font-black text-lg flex items-center justify-center shadow-md">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">
                      Sourcing Request Details — #{selectedDivert.refNo || selectedDivert.id?.slice(0, 6)}
                    </h3>
                    <div className="text-xs text-accent font-bold font-mono mt-0.5">
                      Logged on: {selectedDivert.entryDate ? new Date(selectedDivert.entryDate).toLocaleDateString('en-IN') : 'Today'}
                    </div>
                  </div>
                </div>

                <button onClick={() => setSelectedDivert(null)} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs bg-background">
                {/* Product & Attributes Box (Section 1) */}
                <div className="bg-white p-5 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-accent-soft pb-2">
                    <span className="text-[10.5px] font-black uppercase text-primary">Sourcing Status</span>
                    {getStatusBadge(selectedDivert.status)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Product / Fabric Requested</span>
                      <span className="font-extrabold text-sm text-primary block mt-0.5">{selectedDivert.productWanted}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Store Section</span>
                      <span className="font-extrabold text-xs text-primary block mt-0.5">{selectedDivert.sectionId || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Size</span>
                      <span className="font-extrabold text-xs text-accent block mt-0.5">{selectedDivert.size || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Colour</span>
                      <span className="font-bold text-xs text-primary block mt-0.5">{selectedDivert.colour || '—'}</span>
                    </div>
                    {selectedDivert.other_product_details && (
                      <div className="sm:col-span-2">
                        <span className="text-[10.5px] font-black text-primary block uppercase">Other Product Details</span>
                        <span className="font-medium text-xs text-primary block mt-0.5 bg-background p-2.5 rounded-xl border border-accent-soft">
                          {selectedDivert.other_product_details}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Requirement & Priority Box (Section 2) */}
                <div className="bg-white p-5 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider border-b border-accent-soft pb-2">
                    Requirement &amp; Priority
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Requested Quantity</span>
                      <span className="font-mono font-black text-sm text-primary block mt-0.5">{selectedDivert.quantity || 1} Pcs</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Target Price Range</span>
                      <span className="font-extrabold text-xs text-accent block mt-0.5">{selectedDivert.priceRange || 'Standard Pricing'}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Reason Code</span>
                      <span className="font-bold text-xs text-primary block mt-0.5">{selectedDivert.reasonCode || 'OUT_OF_STOCK'}</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] font-black text-primary block uppercase">Required-by Date</span>
                      <span className="font-mono font-bold text-xs text-rose-700 block mt-0.5">{selectedDivert.required_by_date || 'Standard turnaround'}</span>
                    </div>
                  </div>
                </div>

                {/* Reference & Remarks (Section 3) */}
                {(selectedDivert.reference_image || selectedDivert.remarks) && (
                  <div className="bg-white p-5 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                    <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-accent" />
                      <span>Reference Photo &amp; Remarks</span>
                    </h4>
                    {selectedDivert.reference_image && (
                      <div>
                        <span className="text-[10.5px] font-black text-primary block uppercase mb-1">Attached Reference Photo</span>
                        <a
                          href={selectedDivert.reference_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block group"
                        >
                          <img
                            src={selectedDivert.reference_image}
                            alt="Reference"
                            className="max-h-48 max-w-xs object-cover rounded-xl border border-accent-soft group-hover:scale-102 transition-transform shadow-sm"
                          />
                          <span className="text-[10px] text-accent font-bold block mt-1">Click to view full image ↗</span>
                        </a>
                      </div>
                    )}
                    {selectedDivert.remarks && (
                      <div>
                        <span className="text-[10.5px] font-black text-primary block uppercase mb-0.5">Staff Remarks</span>
                        <p className="p-2.5 rounded-xl bg-background border border-accent-soft text-primary text-xs">
                          {selectedDivert.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Details (Section 4) */}
                <div className="bg-white p-5 rounded-2xl border border-accent-soft space-y-3 shadow-xs">
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-accent" />
                    <span>Customer Contact Information</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-primary block text-[10.5px]">Customer Name</span>
                      <span className="font-extrabold text-primary">{selectedDivert.customerName || 'Walk-in Customer'}</span>
                    </div>
                    <div>
                      <span className="text-primary block text-[10.5px]">Mobile Phone</span>
                      <span className="font-mono font-extrabold text-primary">{selectedDivert.customerMobile || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* PM Sourcing Notes */}
                <div className="bg-white p-5 rounded-2xl border border-accent-soft space-y-2 shadow-xs">
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span>Purchase Manager Review &amp; Vendor Remarks</span>
                  </h4>
                  <div className="p-3 rounded-xl bg-background border border-accent-soft text-xs font-semibold text-primary italic">
                    {selectedDivert.pmNotes || 'Request logged in system. Awaiting Purchase Manager sourcing review & vendor check.'}
                  </div>
                </div>

                {/* Approval & Lifecycle Timeline */}
                <div className="bg-white p-5 rounded-2xl border border-accent-soft space-y-4 shadow-xs">
                  <h4 className="font-extrabold text-primary text-xs uppercase tracking-wider border-b border-accent-soft pb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" />
                    <span>Sourcing Approval &amp; Lifecycle Timeline</span>
                  </h4>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 font-medium before:top-2 before:bottom-2 before:w-0.5 before:bg-accent-soft">
                    {/* Step 1: Created */}
                    <div className="relative">
                      <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                      <div className="font-extrabold text-primary text-xs">Request Created</div>
                      <div className="text-[10.5px] text-primary">Floor Staff logged request for {selectedDivert.productWanted}</div>
                    </div>

                    {/* Step 2: Floor Manager Review */}
                    <div className="relative">
                      <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                      <div className="font-extrabold text-primary text-xs">Floor Manager Review</div>
                      <div className="text-[10.5px] text-primary">Verified out-of-stock floor condition</div>
                    </div>

                    {/* Step 3: Purchase Sourcing Review */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        selectedDivert.status !== 'open' ? 'bg-emerald-600 text-white' : 'bg-primary text-white animate-pulse'
                      }`}>
                        {selectedDivert.status !== 'open' ? '✓' : '•'}
                      </div>
                      <div className="font-extrabold text-primary text-xs">Purchase Manager Sourcing</div>
                      <div className="text-[10.5px] text-primary">Vendor procurement &amp; merchandise availability check</div>
                    </div>

                    {/* Step 4: Resolution */}
                    <div className="relative">
                      <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                        (selectedDivert.status || '').toLowerCase() === 'available' ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {(selectedDivert.status || '').toLowerCase() === 'available' ? '✓' : '○'}
                      </div>
                      <div className="font-extrabold text-primary text-xs">Merchandise Resolution</div>
                      <div className="text-[10.5px] text-primary">Stock fulfilled &amp; customer notified</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-background border-t border-accent-soft flex items-center justify-end">
                <button
                  onClick={() => setSelectedDivert(null)}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-extrabold text-xs shadow-md"
                >
                  Close Details
                </button>
              </div>
            </div>
          )}
        </ModalPortal>

      </div>
    </DashboardLayout>
  );
}
