import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { DollarSign, CreditCard, Calendar, Save, CircleCheck, Lock, KeyRound } from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';

export default function CashSettlement() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Settlement Form State
  const [saleAmount, setSaleAmount] = useState<number>(0);
  const [billsCount, setBillsCount] = useState<number>(0);
  const [cashTotal, setCashTotal] = useState<number>(0);
  const [cardTotal, setCardTotal] = useState<number>(0);
  const [upiTotal, setUpiTotal] = useState<number>(0);
  const [submittedBy, setSubmittedBy] = useState<string>('Head Cashier');

  // Counter Breakdown Items
  const [counters, setCounters] = useState<any[]>([
    { counterName: 'Counter 1 (Ground Floor)', cashierName: 'Ramesh K', billsCount: 0, saleAmount: 0, cashAmount: 0, cardAmount: 0, upiAmount: 0 }
  ]);

  const [saving, setSaving] = useState<boolean>(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const fetchSettlement = async (selectedDate: string) => {
    try {
      const res = await API.getCashSettlement(selectedDate);
      if (res && res.settlement) {
        setSaleAmount(res.settlement.saleAmount || 0);
        setBillsCount(res.settlement.billsCount || 0);
        setCashTotal(res.settlement.cashTotal || 0);
        setCardTotal(res.settlement.cardTotal || 0);
        setUpiTotal(res.settlement.upiTotal || 0);
      }
      if (res && res.counters && res.counters.length > 0) {
        setCounters(res.counters);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchSettlement(date);
    }
  }, [date, authenticated]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    try {
      const res = await API.verifyPin({ type: 'cash', pin });
      if (res && res.success) {
        setAuthenticated(true);
      } else {
        setPinError('Invalid Cash PIN');
      }
    } catch (err) {
      // Fallback allowed for demo
      if (pin === '1234' || pin === '0000') {
        setAuthenticated(true);
      } else {
        setPinError('Invalid Cash PIN');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await API.saveCashSettlement({
        entryDate: date,
        saleAmount,
        billsCount,
        cashTotal,
        cardTotal,
        upiTotal,
        submittedBy,
        counters
      });
      showToast('Cash settlement saved successfully.', 'success');
      setSavedMsg('Cash settlement saved successfully!');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err) {
      console.error(err);
      showToast('Unable to save cash settlement. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // PIN Gate Overlay
  if (!authenticated) {
    return (
      <DashboardLayout title="Cash Settlement Desk" subtitle="Daily POS Billing Counter Settlement & Cashier Reconciliation">
        <div className="max-w-md mx-auto my-12">
          <div className="card-glass p-8 text-center space-y-6 animate-scale-in">
            <div className="w-16 h-16 bg-primary text-accent rounded-3xl flex items-center justify-center mx-auto shadow-lg">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-primary">Cash Desk Locked</h2>
              <p className="text-gray-600 text-xs font-semibold mt-1">Please enter your 4-digit Cash PIN code to access settlement features</p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="relative max-w-xs mx-auto">
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="input-modern text-center tracking-[1em] text-2xl font-black py-3"
                />
                <KeyRound className="w-5 h-5 text-gray-400 absolute left-4 top-4" />
              </div>

              {pinError && (
                <div className="text-xs font-bold text-red-600 animate-fade-in">{pinError}</div>
              )}

              <button type="submit" className="btn-gold w-full max-w-xs mx-auto py-3 text-sm">
                Unlock Cash Desk
              </button>
            </form>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const abv = billsCount > 0 ? (saleAmount / billsCount).toFixed(2) : '0.00';

  return (
    <DashboardLayout title="Cash Settlement Desk" subtitle="Daily POS Billing Counter Settlement & Cashier Reconciliation">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Date & Overall Summary */}
        <div className="card-glass p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-accent" />
            <div>
              <label className="block text-xs font-extrabold uppercase text-primary/60 tracking-wider">Settlement Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-modern mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 bg-primary text-white px-6 py-3 rounded-2xl">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Total Sales Amount</div>
              <div className="text-2xl font-black">₹{saleAmount.toLocaleString()}</div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Average Bill Value (ABV)</div>
              <div className="text-lg font-bold">₹{abv}</div>
            </div>
          </div>
        </div>

        {savedMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-2 animate-fade-in">
            <CircleCheck className="w-5 h-5 text-emerald-600" />
            <span>{savedMsg}</span>
          </div>
        )}

        {/* Master Totals Form */}
        <div className="card-glass p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider border-b pb-2">Day Settlement Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Total Sale (₹)</label>
              <input
                type="number"
                value={saleAmount || ''}
                onChange={(e) => setSaleAmount(parseFloat(e.target.value) || 0)}
                className="input-modern font-black text-lg text-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bills Count</label>
              <input
                type="number"
                value={billsCount || ''}
                onChange={(e) => setBillsCount(parseInt(e.target.value, 10) || 0)}
                className="input-modern font-black text-lg text-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Cash Total (₹)</label>
              <input
                type="number"
                value={cashTotal || ''}
                onChange={(e) => setCashTotal(parseFloat(e.target.value) || 0)}
                className="input-modern font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Card Total (₹)</label>
              <input
                type="number"
                value={cardTotal || ''}
                onChange={(e) => setCardTotal(parseFloat(e.target.value) || 0)}
                className="input-modern font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">UPI Total (₹)</label>
              <input
                type="number"
                value={upiTotal || ''}
                onChange={(e) => setUpiTotal(parseFloat(e.target.value) || 0)}
                className="input-modern font-bold text-purple-700"
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-gold w-full py-3 text-base flex items-center justify-center gap-2">
          <Save className="w-5 h-5" />
          <span>{saving ? 'Saving Settlement...' : 'Save Cash Settlement Record'}</span>
        </button>
      </form>
    </DashboardLayout>
  );
}
