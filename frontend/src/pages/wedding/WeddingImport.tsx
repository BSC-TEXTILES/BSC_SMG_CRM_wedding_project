import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CircleAlert,
  CircleCheck,
  ArrowLeft,
  FileText,
  MapPin,
  Sparkles
} from 'lucide-react';

export default function WeddingImport() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [locationId, setLocationId] = useState<string>('');
  const [locations, setLocations] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId) setLocationId(String(sess.locationId));

    API.getLocations().then((res) => {
      if (res?.locations) setLocations(res.locations);
    });
  }, [navigate]);

  const handleDownloadTemplate = () => {
    const csvContent =
      'customer_name,mobile_number,wedding_date,expected_shopping_date,preferred_shopping_category,estimated_family_size,budget,assigned_telecaller,customer_notes\n' +
      'Ananya Hegde,9845012345,2025-05-15,2025-04-20,Pure Silk Sarees,4,₹1,00,000 – ₹2,00,000,Sneha,Interested in bridal Kanjeevaram\n' +
      'Pooja Patil,9880198765,2025-06-10,2025-05-01,Bridal Lehengas,3,₹50,000 – ₹1,00,000,,Wants family matching sets\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'BSC_Wedding_Customers_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sample CSV template downloaded', 'success');
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast('Please choose a .csv file to import', 'error');
      return;
    }
    if (!locationId) {
      showToast('Please select a store location', 'error');
      return;
    }

    setUploading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('location_id', locationId);

      const res = await API.importWeddingCustomers(formData);
      setImportResult(res);
      showToast(res.message || 'CSV file imported successfully!', 'success');
    } catch (err: any) {
      showToast('Import failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F4EF] flex text-[#182033]">
      <Sidebar
        session={session}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          title="Import Wedding Customers"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Bulk Import Wedding Customers"
            breadcrumbs={[
              { label: 'Customer Register', href: '/wedding-crm/customers' },
              { label: 'Import Customers' }
            ]}
          />

          <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#DFDDD7]">
              <div>
                <h2 className="text-lg font-black text-[#182033]">
                  Import Customers via CSV
                </h2>
                <p className="text-xs text-muted mt-1">
                  Upload bulk wedding customer registrations into the database. Duplicate numbers will be safely skipped.
                </p>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 shadow-xs transition-colors self-start"
              >
                <Download className="w-3.5 h-3.5 text-[#C98218]" />
                <span>Download CSV Template</span>
              </button>
            </div>

            <form onSubmit={handleImport} className="space-y-5 text-xs max-w-xl">
              <div>
                <label className="block font-bold text-muted mb-1">
                  Assign Store Location *
                </label>
                <select
                  value={locationId}
                  disabled={!session?.isGlobalAdmin}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                >
                  <option value="">-- Choose Store Location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      📍 {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-muted mb-1">
                  Select CSV File *
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full p-3 bg-[#F6F4EF] border border-[#DFDDD7] rounded-2xl file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#101C36] file:text-[#C9A45C] hover:file:bg-[#07101F] cursor-pointer"
                />
                <span className="text-[10px] text-muted block mt-1">
                  File must be UTF-8 formatted CSV with required columns: customer_name, mobile_number
                </span>
              </div>

              <button
                type="submit"
                disabled={uploading || !file || !locationId}
                className="px-6 py-2.5 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black shadow-md border border-[#C9A45C]/30 flex items-center gap-2 disabled:opacity-40"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Processing File...' : 'Start Import'}</span>
              </button>
            </form>

            {/* Import Result Notification */}
            {importResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CircleCheck className="w-4 h-4 text-emerald-600" />
                  <span>Import Completed</span>
                </div>
                <div>Inserted: {importResult.importedCount || importResult.imported || 0} customers</div>
                {importResult.duplicateCount > 0 && (
                  <div>Duplicates Skipped: {importResult.duplicateCount}</div>
                )}
                <div className="pt-2">
                  <Link to="/wedding-crm/customers" className="text-xs font-bold text-emerald-800 underline">
                    View imported records in Customer Register →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
