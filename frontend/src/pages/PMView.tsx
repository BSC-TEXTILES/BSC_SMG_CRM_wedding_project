import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { Briefcase, RefreshCw } from 'lucide-react';
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
            <div className="table-frame custom-scrollbar">
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
                      <td className="p-4">
                        <div className="font-bold text-primary text-sm">{item.productWanted}</div>
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
                            <a
                              href={item.reference_image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold hover:underline"
                            >
                              📷 View Reference
                            </a>
                          )}
                        </div>
                        {item.other_product_details && (
                          <div className="text-[11px] text-gray-600 mt-1 italic">
                            Details: {item.other_product_details}
                          </div>
                        )}
                        {item.remarks && (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Notes: {item.remarks}
                          </div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">{item.quantity || 1} pcs</td>
                      <td className="p-4 text-gray-600 whitespace-nowrap">{item.priceRange || 'N/A'}</td>
                      <td className="p-4 whitespace-nowrap">
                        <div>{item.customerName || 'Walk-in'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{item.customerMobile || '—'}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`badge ${
                          item.status === 'available' ? 'b-sel' : item.status === 'sourcing' ? 'b-short' : 'b-new'
                        }`}>
                          {(item.status || 'OPEN').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 max-w-xs truncate">{item.pmNotes || 'No notes added'}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedDivert(item);
                            setStatus(item.status || 'sourcing');
                            setPmNotes(item.pmNotes || '');
                          }}
                          className="btn-gold text-[11px] py-1.5 px-3"
                        >
                          Review &amp; Update
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
            <div className="card-glass p-6 max-w-lg w-full animate-scale-in max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-black text-primary mb-3">Review &amp; Update Sourcing Status</h3>

              {/* Complete Requirement Details Card */}
              <div className="p-4 rounded-2xl bg-white border border-accent-soft space-y-2.5 text-xs mb-4 shadow-xs">
                <div className="border-b border-accent-soft pb-2">
                  <span className="text-[10px] font-black uppercase text-gray-500 block">Product / Fabric Requested</span>
                  <div className="font-extrabold text-sm text-primary">{selectedDivert.productWanted}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 block">Store Section</span>
                    <span className="font-semibold text-primary">{selectedDivert.sectionId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 block">Quantity &amp; Target Price</span>
                    <span className="font-semibold text-primary">{selectedDivert.quantity || 1} pcs ({selectedDivert.priceRange || 'N/A'})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 block">Size &amp; Colour</span>
                    <span className="font-semibold text-primary">
                      {selectedDivert.size || 'N/A'} {selectedDivert.colour ? `/ ${selectedDivert.colour}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 block">Required-by Date</span>
                    <span className="font-semibold text-rose-700">{selectedDivert.required_by_date || 'Standard'}</span>
                  </div>
                </div>

                {selectedDivert.other_product_details && (
                  <div className="pt-1 border-t border-accent-soft/60">
                    <span className="text-[10px] font-bold text-gray-500 block">Product Specification / Fabric Details</span>
                    <p className="text-primary mt-0.5">{selectedDivert.other_product_details}</p>
                  </div>
                )}

                {selectedDivert.reference_image && (
                  <div className="pt-1 border-t border-accent-soft/60">
                    <span className="text-[10px] font-bold text-gray-500 block mb-1">Attached Reference Photo</span>
                    <a href={selectedDivert.reference_image} target="_blank" rel="noopener noreferrer">
                      <img
                        src={selectedDivert.reference_image}
                        alt="Reference"
                        className="max-h-36 max-w-full rounded-xl border border-accent-soft object-cover"
                      />
                    </a>
                  </div>
                )}

                {selectedDivert.remarks && (
                  <div className="pt-1 border-t border-accent-soft/60">
                    <span className="text-[10px] font-bold text-gray-500 block">Staff Remarks</span>
                    <p className="text-gray-700 italic mt-0.5">{selectedDivert.remarks}</p>
                  </div>
                )}

                <div className="pt-1 border-t border-accent-soft/60 flex items-center justify-between text-[11px] text-gray-600">
                  <span>Customer: <strong className="text-primary">{selectedDivert.customerName || 'Walk-in'}</strong></span>
                  <span className="font-mono">{selectedDivert.customerMobile || ''}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="select-modern w-full font-bold text-xs"
                  >
                    <option value="open">Open (Awaiting PM)</option>
                    <option value="sourcing">Sourcing in Progress</option>
                    <option value="available">Available at Vendor / Store</option>
                    <option value="closed">Closed / Dispatched</option>
                    <option value="cancelled">Unavailable / Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Purchase Manager Notes</label>
                  <textarea
                    rows={3}
                    value={pmNotes}
                    onChange={(e) => setPmNotes(e.target.value)}
                    placeholder="Enter vendor details, expected delivery date, or price update..."
                    className="textarea-modern w-full text-xs"
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
                    className="btn-primary text-xs py-2 px-5 font-bold"
                  >
                    {updating ? 'Saving...' : 'Update Sourcing Status'}
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
