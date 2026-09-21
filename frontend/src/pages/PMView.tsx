import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { Briefcase, CheckCircle, Clock, Save, RefreshCw } from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';

export default function PMView() {
  const [diverts, setDiverts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDivert, setSelectedDivert] = useState<any | null>(null);
  const [status, setStatus] = useState<string>('sourcing');
  const [pmNotes, setPmNotes] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchDiverts = async () => {
    setLoading(true);
    try {
      const res = await API.getDiverts();
      if (res && res.diverts) {
        setDiverts(res.diverts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiverts();
  }, []);

  const handleUpdateDivert = async () => {
    if (!selectedDivert) return;
    setUpdating(true);
    try {
      await API.updateDivert({
        id: selectedDivert.id,
        status,
        pmNotes,
        actorRole: 'Purchase Manager',
        actorId: 'PM_1'
      });
      showToast('Sourcing divert status updated successfully.', 'success');
      setSelectedDivert(null);
      fetchDiverts();
    } catch (err) {
      console.error(err);
      showToast('Unable to update divert status. Please try again.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <DashboardLayout title="Purchase Manager Sourcing Desk" subtitle="Review & Sourcing Fulfillment Action Center">
      <div className="space-y-6">
        <div className="card-glass overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-accent" />
              <span>Pending Sourcing Requests</span>
            </h3>
            <button onClick={fetchDiverts} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh List</span>
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 font-bold">Loading sourcing requests...</div>
          ) : diverts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-bold">No sourcing requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-primary text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Ref No</th>
                    <th className="p-4">Product Details</th>
                    <th className="p-4">Qty</th>
                    <th className="p-4">Price Range</th>
                    <th className="p-4">Customer Info</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">PM Sourcing Notes</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diverts.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 font-black text-primary">#{item.refNo || item.id.slice(0, 6)}</td>
                      <td className="p-4 font-bold text-primary">{item.productWanted}</td>
                      <td className="p-4">{item.quantity} pcs</td>
                      <td className="p-4 text-gray-600">{item.priceRange || 'N/A'}</td>
                      <td className="p-4">
                        <div>{item.customerName || 'Walk-in'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{item.customerMobile}</div>
                      </td>
                      <td className="p-4">
                        <span className={`badge ${
                          item.status === 'available' ? 'b-sel' : item.status === 'sourcing' ? 'b-short' : 'b-new'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 max-w-xs truncate">{item.pmNotes || 'No notes added'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDivert(item);
                            setStatus(item.status || 'sourcing');
                            setPmNotes(item.pmNotes || '');
                          }}
                          className="btn-gold text-[11px] py-1.5 px-3"
                        >
                          Update Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Update Modal */}
        {selectedDivert && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="card-glass p-6 max-w-md w-full animate-scale-in">
              <h3 className="text-lg font-black text-primary mb-4">Update Sourcing Status</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Product</label>
                  <div className="font-extrabold text-sm text-primary">{selectedDivert.productWanted}</div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="select-modern"
                  >
                    <option value="open">Open (Awaiting PM)</option>
                    <option value="sourcing">Sourcing in Progress</option>
                    <option value="available">Available at Vendor / Store</option>
                    <option value="closed">Closed / Dispatched</option>
                    <option value="cancelled">Unavailable / Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Sourcing Notes</label>
                  <textarea
                    rows={3}
                    value={pmNotes}
                    onChange={(e) => setPmNotes(e.target.value)}
                    placeholder="Enter vendor details, expected delivery date, or price update..."
                    className="textarea-modern"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <button
                    onClick={() => setSelectedDivert(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateDivert}
                    disabled={updating}
                    className="btn-primary text-xs py-2 px-5"
                  >
                    {updating ? 'Saving...' : 'Update Divert'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
