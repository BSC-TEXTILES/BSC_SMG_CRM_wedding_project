import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, UserSession } from '../services/api';
import { showToast } from './Toast';
import {
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Clock,
  AlertTriangle,
  Lock,
  ExternalLink,
  CheckCircle,
  XCircle,
  FileCode,
  Globe,
  Database,
  Filter
} from 'lucide-react';

interface ApiKeyItem {
  id: string;
  public_id: string;
  user_id: string | number;
  username?: string;
  user_full_name?: string;
  name: string;
  prefix: string;
  key_hint: string;
  access_level: 'READ' | 'READ_WRITE' | 'FULL_ACCESS' | 'ADMIN_CONNECT';
  scopes: string[];
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' | 'NEEDS_REAUTH';
  encryption_key_version: number;
  daily_approved_at: string | null;
  daily_approval_expires: string | null;
  rate_limit_per_minute: number;
  request_count: number;
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  created_at: string;
}

interface ApiKeyManagementPanelProps {
  session: UserSession | null;
}

const AVAILABLE_SCOPES = [
  { id: 'data:read', label: 'Read Data Records', category: 'Data' },
  { id: 'data:write', label: 'Create / Update Records', category: 'Data' },
  { id: 'data:delete', label: 'Delete Records', category: 'Data' },
  { id: 'website:connect', label: 'Website Connect Gateway', category: 'Website' },
  { id: 'website:read', label: 'Read Website Catalog / Content', category: 'Website' },
  { id: 'website:write', label: 'Push Website Updates', category: 'Website' },
  { id: 'analytics:read', label: 'Read Real-Time Analytics', category: 'Analytics' },
  { id: 'users:read', label: 'Read User Directory (Admin)', category: 'Admin' },
  { id: 'api:manage', label: 'Manage Sub-Keys', category: 'Admin' },
  { id: 'export:data', label: 'Export Full Datasets', category: 'Export' },
  { id: 'cross:connect', label: 'Cross-Site Data Bridge', category: 'Connect' }
];

export default function ApiKeyManagementPanel({ session }: ApiKeyManagementPanelProps) {
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';
  const [activeSubTab, setActiveSubTab] = useState<'my_keys' | 'admin_governance' | 'daily_queue'>('my_keys');

  // Key lists
  const [myKeys, setMyKeys] = useState<ApiKeyItem[]>([]);
  const [adminKeys, setAdminKeys] = useState<ApiKeyItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [needsReauthCount, setNeedsReauthCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Key Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState<'LIVE_' | 'TEST_'>('LIVE_');
  const [accessLevel, setAccessLevel] = useState<'READ' | 'READ_WRITE' | 'FULL_ACCESS' | 'ADMIN_CONNECT'>('READ');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['data:read']);
  const [ipWhitelistStr, setIpWhitelistStr] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submittingKey, setSubmittingKey] = useState(false);

  // One-Time Key Display Modal
  const [oneTimeKeyData, setOneTimeKeyData] = useState<{ rawKey: string; hint: string; name: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  // Docs Modal
  const [docsModalKey, setDocsModalKey] = useState<ApiKeyItem | null>(null);
  const [docsData, setDocsData] = useState<any>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Load User Keys
  const loadMyKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/v1/keys/my');
      if (res?.success) {
        setMyKeys(res.data || []);
      }
    } catch (e: any) {
      showToast('Failed to load your API keys', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Admin Keys Directory
  const loadAdminKeys = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/v1/admin/keys${filterStatus !== 'ALL' ? `?status=${filterStatus}` : ''}`);
      if (res?.success) {
        setAdminKeys(res.data?.keys || []);
        setPendingCount(res.data?.pendingCount || 0);
        setNeedsReauthCount(res.data?.needsReauthCount || 0);
      }
    } catch (e: any) {
      showToast('Failed to load admin key directory', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterStatus]);

  useEffect(() => {
    loadMyKeys();
    if (isAdmin) {
      loadAdminKeys();
    }
  }, [loadMyKeys, loadAdminKeys, isAdmin]);

  // Handle Create Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      showToast('Please enter a key name', 'error');
      return;
    }

    const ips = ipWhitelistStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setSubmittingKey(true);
    try {
      const res = await apiFetch('/v1/keys/request', {
        method: 'POST',
        body: JSON.stringify({
          name: keyName.trim(),
          prefix: keyPrefix,
          accessLevel,
          scopes: selectedScopes,
          ipWhitelist: ips,
          expiresAt: expiresAt || null
        })
      });

      if (res?.success && res?.data?.rawKey) {
        setShowCreateModal(false);
        setOneTimeKeyData({
          rawKey: res.data.rawKey,
          hint: res.data.hint,
          name: res.data.name
        });
        setConfirmedSaved(false);
        setCopiedKey(false);
        // Reset form
        setKeyName('');
        setSelectedScopes(['data:read']);
        setIpWhitelistStr('');
        setExpiresAt('');
        loadMyKeys();
        if (isAdmin) loadAdminKeys();
        showToast('API Key generated! Save your secret key now.', 'success');
      } else {
        showToast(res?.error || 'Failed to create key', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating key', 'error');
    } finally {
      setSubmittingKey(false);
    }
  };

  // Revoke Key
  const handleRevokeKey = async (publicId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently revoke key "${name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/v1/keys/${publicId}`, { method: 'DELETE' });
      if (res?.success) {
        showToast('API key revoked', 'success');
        loadMyKeys();
        if (isAdmin) loadAdminKeys();
      } else {
        showToast(res?.error || 'Revocation failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error revoking key', 'error');
    }
  };

  // Regenerate Key
  const handleRegenerateKey = async (publicId: string, name: string) => {
    if (!window.confirm(`Regenerate "${name}"? The current key will be revoked immediately and a new secret key will be generated.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/v1/keys/${publicId}/regenerate`, { method: 'POST' });
      if (res?.success && res?.data?.rawKey) {
        setOneTimeKeyData({
          rawKey: res.data.rawKey,
          hint: res.data.hint,
          name: res.data.name
        });
        setConfirmedSaved(false);
        setCopiedKey(false);
        loadMyKeys();
        if (isAdmin) loadAdminKeys();
        showToast('API Key regenerated! Copy your new secret key.', 'success');
      }
    } catch (e: any) {
      showToast(e.message || 'Error regenerating key', 'error');
    }
  };

  // Admin Actions: Approve
  const handleAdminApprove = async (publicId: string) => {
    try {
      const res = await apiFetch(`/v1/admin/keys/${publicId}/approve`, { method: 'POST' });
      if (res?.success) {
        showToast('Key approved and activated for 24 hours!', 'success');
        loadAdminKeys();
      } else {
        showToast(res?.error || 'Approval failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error approving key', 'error');
    }
  };

  // Admin Actions: Reject
  const handleAdminReject = async (publicId: string) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      const res = await apiFetch(`/v1/admin/keys/${publicId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Policy compliance' })
      });
      if (res?.success) {
        showToast('Key rejected and revoked', 'success');
        loadAdminKeys();
      }
    } catch (e: any) {
      showToast(e.message || 'Error rejecting key', 'error');
    }
  };

  // Admin Actions: Suspend
  const handleAdminSuspend = async (publicId: string) => {
    try {
      const res = await apiFetch(`/v1/admin/keys/${publicId}/suspend`, { method: 'POST' });
      if (res?.success) {
        showToast('Key suspended', 'success');
        loadAdminKeys();
      }
    } catch (e: any) {
      showToast(e.message || 'Error suspending key', 'error');
    }
  };

  // Admin Actions: Daily Re-Authorize
  const handleDailyReauth = async (publicId: string) => {
    try {
      const res = await apiFetch(`/v1/admin/keys/${publicId}/reauthorize`, { method: 'POST' });
      if (res?.success) {
        showToast('Daily authorization renewed for 24 hours!', 'success');
        loadAdminKeys();
      }
    } catch (e: any) {
      showToast(e.message || 'Error during daily re-authorization', 'error');
    }
  };

  // Admin Actions: Bulk Re-Authorize
  const handleBulkReauth = async () => {
    const needingReauth = adminKeys.filter(k => k.status === 'NEEDS_REAUTH' || isExpiringSoon(k.daily_approval_expires));
    if (needingReauth.length === 0) {
      showToast('No keys currently require daily re-authorization', 'info');
      return;
    }
    try {
      const ids = needingReauth.map(k => k.public_id);
      const res = await apiFetch('/v1/admin/keys/bulk-reauthorize', {
        method: 'POST',
        body: JSON.stringify({ publicIds: ids })
      });
      if (res?.success) {
        showToast(`Successfully re-authorized ${res.count} keys for 24 hours!`, 'success');
        loadAdminKeys();
      }
    } catch (e: any) {
      showToast(e.message || 'Error during bulk re-authorization', 'error');
    }
  };

  // Open Docs
  const handleOpenDocs = async (key: ApiKeyItem) => {
    setDocsModalKey(key);
    setLoadingDocs(true);
    try {
      const res = await apiFetch(`/v1/keys/${key.public_id}/docs`);
      if (res?.success) {
        setDocsData(res.data);
      }
    } catch (e: any) {
      showToast('Error loading documentation reference', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: ApiKeyItem['status'], dailyExpires: string | null) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            PENDING ADMIN APPROVAL
          </span>
        );
      case 'NEEDS_REAUTH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            NEEDS 24H RE-AUTH
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
            <Lock className="w-3 h-3" />
            SUSPENDED
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-50 text-gray-400 border border-gray-200 line-through">
            REVOKED
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
            EXPIRED
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  };

  // Countdown Helper
  const formatDailyCountdown = (dailyExpires: string | null, status: string) => {
    if (status !== 'ACTIVE' || !dailyExpires) return '—';
    const expires = new Date(dailyExpires).getTime();
    const diff = expires - Date.now();
    if (diff <= 0) {
      return <span className="text-rose-600 font-bold">Expired (Needs Re-auth)</span>;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const isUrgent = hours < 2;
    return (
      <span className={`font-mono text-xs ${isUrgent ? 'text-amber-600 font-bold animate-pulse' : 'text-primary'}`}>
        {hours}h {minutes}m remaining
      </span>
    );
  };

  const isExpiringSoon = (dailyExpires: string | null) => {
    if (!dailyExpires) return false;
    const diff = new Date(dailyExpires).getTime() - Date.now();
    return diff > 0 && diff <= 2 * 60 * 60 * 1000;
  };

  const toggleScope = (scopeId: string) => {
    setSelectedScopes(prev => (prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Sub-Nav */}
      <div className="card-glass p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-accent" />
              <h2 className="text-base font-extrabold text-primary tracking-wide uppercase">
                Enterprise API Key Management & Governance
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Envelope-encrypted credentials, daily 24-hour admin re-authorization, and granular scope access to connected data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" />
              Generate API Key
            </button>
            <button
              onClick={() => {
                loadMyKeys();
                if (isAdmin) loadAdminKeys();
              }}
              title="Refresh credentials list"
              className="p-2 rounded-xl border border-accent-soft hover:bg-background text-primary"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation if Admin */}
        {isAdmin && (
          <div className="flex items-center gap-2 border-b border-accent-soft/40 mt-6 pt-2">
            <button
              onClick={() => setActiveSubTab('my_keys')}
              className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 ${
                activeSubTab === 'my_keys'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
            >
              My API Keys ({myKeys.length})
            </button>

            <button
              onClick={() => setActiveSubTab('admin_governance')}
              className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeSubTab === 'admin_governance'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
            >
              <span>Admin Key Governance</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-extrabold animate-pulse">
                  {pendingCount} Pending
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('daily_queue')}
              className={`pb-2.5 px-3 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 ${
                activeSubTab === 'daily_queue'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-primary'
              }`}
            >
              <span>Daily 24h Re-Auth Queue</span>
              {needsReauthCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
                  {needsReauthCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Security Architecture Banner */}
      <div className="p-4 rounded-2xl border border-accent-soft/60 bg-gradient-to-r from-accent/5 via-background to-accent/5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-extrabold text-primary">Military-Grade Cryptographic Architecture</div>
          <div className="text-muted-foreground leading-relaxed">
            Keys are formatted as <code className="bg-background/80 px-1 py-0.5 rounded border border-accent-soft font-mono">LIVE_BASE62(32B)_HMAC8</code>.
            Plaintext keys are <strong>never stored</strong> and displayed only <strong>ONCE</strong>. Field-level sensitive data is protected via <strong>AES-256-GCM Envelope Encryption</strong>.
            All active keys require daily 24-hour administrator re-authorization to maintain access to connected endpoints.
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: MY KEYS */}
      {activeSubTab === 'my_keys' && (
        <div className="card-glass p-6 space-y-4">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider">
            Your Active API Credentials
          </h3>

          {myKeys.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-accent-soft rounded-2xl">
              <Key className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              You do not have any API keys yet. Click <strong>"Generate API Key"</strong> to request one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-accent-soft/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-3">Key Label / Name</th>
                    <th className="py-3 px-3">Hint</th>
                    <th className="py-3 px-3">Tier</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Daily 24h Expiry</th>
                    <th className="py-3 px-3">Last Used</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-soft/20 font-medium">
                  {myKeys.map(k => (
                    <tr key={k.public_id} className="hover:bg-accent-soft/10 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-primary">{k.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">ID: {k.public_id}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono bg-background px-2 py-1 rounded border border-accent-soft text-primary font-bold">
                          {k.key_hint}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-primary/5 text-primary text-[10px] font-bold border border-primary/10">
                          {k.access_level}
                        </span>
                      </td>
                      <td className="py-3 px-3">{renderStatusBadge(k.status, k.daily_approval_expires)}</td>
                      <td className="py-3 px-3">{formatDailyCountdown(k.daily_approval_expires, k.status)}</td>
                      <td className="py-3 px-3 text-muted-foreground text-[11px]">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                        {k.last_used_ip && <div className="text-[10px] font-mono">{k.last_used_ip}</div>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDocs(k)}
                            title="Personalized API Documentation"
                            className="p-1.5 rounded-lg border border-accent-soft hover:bg-background text-primary"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRegenerateKey(k.public_id, k.name)}
                            title="Regenerate Key (Revokes current key)"
                            className="p-1.5 rounded-lg border border-accent-soft hover:bg-background text-primary"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          {k.status !== 'REVOKED' && (
                            <button
                              onClick={() => handleRevokeKey(k.public_id, k.name)}
                              title="Revoke Key"
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ADMIN GOVERNANCE */}
      {isAdmin && activeSubTab === 'admin_governance' && (
        <div className="card-glass p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider">
              System-Wide Key Directory ({adminKeys.length})
            </h3>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="input-modern text-xs py-1 px-2.5 max-w-[150px]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Only</option>
                <option value="ACTIVE">Active Only</option>
                <option value="NEEDS_REAUTH">Needs Re-auth</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-accent-soft/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-3">Owner / User</th>
                  <th className="py-3 px-3">Key Label & Hint</th>
                  <th className="py-3 px-3">Tier & Scopes</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">24h Expiry</th>
                  <th className="py-3 px-3">Requests</th>
                  <th className="py-3 px-3 text-right">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-soft/20 font-medium">
                {adminKeys.map(k => (
                  <tr key={k.public_id} className="hover:bg-accent-soft/10 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-extrabold text-primary">{k.user_full_name || k.username}</div>
                      <div className="text-[10px] text-muted-foreground">@{k.username}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-primary">{k.name}</div>
                      <span className="font-mono text-[11px] bg-background px-1.5 py-0.5 rounded border border-accent-soft text-primary">
                        {k.key_hint}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-accent">{k.access_level}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {Array.isArray(k.scopes) ? k.scopes.slice(0, 3).join(', ') : ''}
                        {Array.isArray(k.scopes) && k.scopes.length > 3 && ` +${k.scopes.length - 3}`}
                      </div>
                    </td>
                    <td className="py-3 px-3">{renderStatusBadge(k.status, k.daily_approval_expires)}</td>
                    <td className="py-3 px-3">{formatDailyCountdown(k.daily_approval_expires, k.status)}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-primary">{k.request_count}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {k.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleAdminApprove(k.public_id)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleAdminReject(k.public_id)}
                              className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 shadow-sm"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {k.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => handleDailyReauth(k.public_id)}
                              title="Renew daily 24h approval"
                              className="px-2 py-1 rounded bg-accent text-white font-bold text-[10px] hover:bg-accent/90 shadow-sm flex items-center gap-1"
                            >
                              <Clock className="w-3 h-3" />
                              Re-Auth
                            </button>
                            <button
                              onClick={() => handleAdminSuspend(k.public_id)}
                              className="px-2 py-1 rounded border border-accent-soft hover:bg-background text-primary font-bold text-[10px]"
                            >
                              Suspend
                            </button>
                          </>
                        )}

                        {k.status === 'NEEDS_REAUTH' && (
                          <button
                            onClick={() => handleDailyReauth(k.public_id)}
                            className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700 shadow-sm flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Re-Authorize (24h)
                          </button>
                        )}

                        {k.status === 'SUSPENDED' && (
                          <button
                            onClick={() => handleAdminApprove(k.public_id)}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-sm"
                          >
                            Reactivate
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenDocs(k)}
                          title="View API Docs"
                          className="p-1 rounded border border-accent-soft hover:bg-background text-primary"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DAILY 24H RE-AUTH QUEUE */}
      {isAdmin && activeSubTab === 'daily_queue' && (
        <div className="card-glass p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-500" />
                Daily 24-Hour Re-Authorization Queue
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Keys requiring daily administrator renewal to ensure zero unauthorized long-term access.
              </p>
            </div>

            <button
              onClick={handleBulkReauth}
              className="btn-primary text-xs flex items-center gap-1.5 shadow-md bg-accent"
            >
              <CheckCircle className="w-4 h-4" />
              Bulk Re-Authorize All Expiring Keys
            </button>
          </div>

          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-accent-soft/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Key Label & Hint</th>
                  <th className="py-3 px-3">Access Level</th>
                  <th className="py-3 px-3">Expiry Countdown</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-soft/20 font-medium">
                {adminKeys
                  .filter(k => k.status === 'NEEDS_REAUTH' || isExpiringSoon(k.daily_approval_expires))
                  .map(k => (
                    <tr key={k.public_id} className="hover:bg-accent-soft/10">
                      <td className="py-3 px-3 font-bold text-primary">{k.user_full_name || k.username}</td>
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-primary">{k.name}</div>
                        <span className="font-mono text-[10px] text-muted-foreground">{k.key_hint}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-accent">{k.access_level}</td>
                      <td className="py-3 px-3">{formatDailyCountdown(k.daily_approval_expires, k.status)}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDailyReauth(k.public_id)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-sm"
                        >
                          Re-Authorize for 24h
                        </button>
                      </td>
                    </tr>
                  ))}
                {adminKeys.filter(k => k.status === 'NEEDS_REAUTH' || isExpiringSoon(k.daily_approval_expires)).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No keys currently need re-authorization. All active keys have valid 24h approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE API KEY */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-glass bg-background max-w-xl w-full p-6 space-y-5 rounded-2xl border border-accent-soft shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-accent-soft/40 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-accent" />
                <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">
                  Request New API Key
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-primary text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-primary mb-1">Key Label / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ERP Integration / POS Sync Service"
                  value={keyName}
                  onChange={e => setKeyName(e.target.value)}
                  className="input-modern w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-primary mb-1">Environment Prefix</label>
                  <select
                    value={keyPrefix}
                    onChange={e => setKeyPrefix(e.target.value as any)}
                    className="input-modern w-full"
                  >
                    <option value="LIVE_">LIVE_ (Production)</option>
                    <option value="TEST_">TEST_ (Sandbox)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Access Level</label>
                  <select
                    value={accessLevel}
                    onChange={e => setAccessLevel(e.target.value as any)}
                    className="input-modern w-full"
                  >
                    <option value="READ">READ (Own Data GET)</option>
                    <option value="READ_WRITE">READ_WRITE (GET/POST/PUT)</option>
                    <option value="FULL_ACCESS">FULL_ACCESS (All Methods + Connect)</option>
                    {isAdmin && <option value="ADMIN_CONNECT">ADMIN_CONNECT (Enterprise Cross-Bridge)</option>}
                  </select>
                </div>
              </div>

              {/* Scopes Multi-Select */}
              <div>
                <label className="block font-bold text-primary mb-1.5">Permitted Scopes / Endpoints</label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-accent-soft/60 bg-background/50 max-h-48 overflow-y-auto">
                  {AVAILABLE_SCOPES.map(sc => {
                    const isChecked = selectedScopes.includes(sc.id);
                    return (
                      <label
                        key={sc.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked ? 'bg-accent/10 border-accent text-primary' : 'border-accent-soft/30 hover:bg-background text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleScope(sc.id)}
                          className="mt-0.5 rounded border-accent-soft"
                        />
                        <div>
                          <div className="font-bold text-[11px]">{sc.label}</div>
                          <div className="text-[10px] font-mono opacity-70">{sc.id}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* IP Whitelist & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-primary mb-1">IP Whitelist (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.1, 10.0.0.1"
                    value={ipWhitelistStr}
                    onChange={e => setIpWhitelistStr(e.target.value)}
                    className="input-modern w-full"
                  />
                  <span className="text-[10px] text-muted-foreground">Comma-separated IPv4/IPv6 addresses</span>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Hard Expiration Date (Optional)</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                    className="input-modern w-full"
                  />
                  <span className="text-[10px] text-muted-foreground">Maximum validity 1 year</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                <strong>Notice:</strong> Once created, this key will remain in <strong>PENDING</strong> status until an administrator approves it.
                You will be shown the secret key once upon generation.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-accent-soft/40">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-primary font-bold hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingKey}
                  className="btn-primary flex items-center gap-1.5 shadow-md"
                >
                  {submittingKey ? 'Generating...' : 'Generate API Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ONE-TIME DISPLAY MODAL (STRICT SECURITY) */}
      {oneTimeKeyData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="card-glass bg-background max-w-lg w-full p-6 space-y-5 rounded-2xl border-2 border-accent shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2 text-accent">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-extrabold text-base uppercase tracking-wider text-primary">
                Save Your Secret API Key
              </h3>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed font-medium">
              <strong>CRITICAL SECURITY NOTICE:</strong> This is the <strong>ONLY</strong> time this secret key will be shown.
              We store only an Argon2/bcrypt hash of this key. If lost, you must regenerate it.
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-muted-foreground">API Key for "{oneTimeKeyData.name}":</div>
              <div className="p-3.5 rounded-xl bg-black text-emerald-400 font-mono text-xs break-all border border-emerald-900 shadow-inner flex items-center justify-between gap-3">
                <span className="select-all">{oneTimeKeyData.rawKey}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(oneTimeKeyData.rawKey);
                    setCopiedKey(true);
                    showToast('Secret key copied to clipboard!', 'success');
                  }}
                  className="p-1.5 rounded-lg bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700 flex-shrink-0"
                  title="Copy to clipboard"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-accent-soft bg-background cursor-pointer text-xs font-bold text-primary">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={e => setConfirmedSaved(e.target.checked)}
                className="w-4 h-4 rounded border-accent-soft text-accent"
              />
              <span>I have safely copied and stored this API key in a secure location</span>
            </label>

            <button
              disabled={!confirmedSaved}
              onClick={() => setOneTimeKeyData(null)}
              className={`w-full py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-md ${
                confirmedSaved
                  ? 'btn-primary'
                  : 'bg-muted text-muted-foreground cursor-not-allowed border border-accent-soft/40'
              }`}
            >
              Done — Close Key Window
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: PERSONALIZED API DOCUMENTATION */}
      {docsModalKey && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-glass bg-background max-w-2xl w-full p-6 space-y-4 rounded-2xl border border-accent-soft shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-accent-soft/40 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="font-extrabold text-primary text-sm uppercase tracking-wider">
                    API Reference: {docsModalKey.name}
                  </h3>
                  <div className="text-[10px] text-muted-foreground font-mono">Hint: {docsModalKey.key_hint}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setDocsModalKey(null);
                  setDocsData(null);
                }}
                className="text-muted-foreground hover:text-primary font-bold text-base"
              >
                ✕
              </button>
            </div>

            {loadingDocs ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Generating personalized API reference...
              </div>
            ) : docsData ? (
              <div className="space-y-4 text-xs">
                {/* Auth Header Example */}
                <div>
                  <div className="font-bold text-primary mb-1">Authorization Header:</div>
                  <pre className="p-3 rounded-xl bg-black text-emerald-400 font-mono text-[11px] overflow-x-auto border border-accent-soft">
                    {`Authorization: Bearer <YOUR_SECRET_KEY>`}
                  </pre>
                </div>

                {/* Permitted Endpoints */}
                <div>
                  <div className="font-bold text-primary mb-2">Permitted Connect Endpoints for this Key:</div>
                  <div className="space-y-2">
                    {docsData.endpoints?.map((ep: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl border border-accent-soft bg-background space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            ep.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                            ep.method === 'POST' ? 'bg-emerald-100 text-emerald-700' :
                            ep.method === 'PUT' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {ep.method}
                          </span>
                          <span className="font-mono font-bold text-primary">{ep.path}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{ep.description}</div>
                        <div className="text-[10px] text-accent font-semibold">Scope: {ep.scope_required}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example Request */}
                <div>
                  <div className="font-bold text-primary mb-1">cURL Example:</div>
                  <pre className="p-3 rounded-xl bg-black text-gray-300 font-mono text-[11px] overflow-x-auto border border-accent-soft">
{`curl -X GET "https://bsctextiles.com/api/v1/connect/data/wedding_customers" \\
  -H "Authorization: Bearer ${docsData.example_request_header || 'LIVE_...'}" \\
  -H "Accept: application/json"`}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-600">Failed to load API reference documentation.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
