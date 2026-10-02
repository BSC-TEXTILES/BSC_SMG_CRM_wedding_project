import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { Auth, UserSession, API } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { NotificationService, SystemNotification } from '../services/notificationService';
import MetricCard from '../components/ui/MetricCard';
import { Send, Megaphone, Trash2, CircleCheck, Clock, Eye, RefreshCw, Mail, Server, AtSign, Sparkles, Users, CheckCircle2 } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  badge: string;
  subject: string;
  category: string;
  priority: 'normal' | 'high' | 'critical';
  body: string;
}

const PREDEFINED_TEMPLATES: EmailTemplate[] = [
  {
    id: 'custom',
    name: '📝 Custom / Empty Mailbox',
    badge: 'Blank',
    subject: '',
    category: 'General',
    priority: 'normal',
    body: ''
  },
  {
    id: 'urgent_operations',
    name: '🚨 Urgent Store Operations Notice',
    badge: 'Urgent',
    subject: 'Urgent Operations Notice: Store Standards & Protocol Compliance',
    category: 'Emergency',
    priority: 'high',
    body: `Dear Team,\n\nPlease be advised of an urgent operational directive regarding store protocols, floor preparedness, and luxury retail customer service standards across all branches.\n\nKey Directives:\n1. All store and floor managers must ensure high station vigilance and staff presentation.\n2. Footfall recording clickers and greeter tablets must remain fully operational at all times.\n3. Escalate any customer feedback issues with rating ≤ 2 stars to floor leadership immediately.\n\nThank you for your prompt compliance and dedication to operational excellence.\n\nWarm regards,\nBSC Textiles Executive Operations`
  },
  {
    id: 'staff_meeting',
    name: '👥 Mandatory All-Hands Staff Briefing',
    badge: 'Meeting',
    subject: 'Notice: Mandatory Store All-Hands Briefing & Performance Review',
    category: 'HR',
    priority: 'normal',
    body: `Dear Team Members,\n\nA mandatory store briefing and performance review session has been scheduled for all departments.\n\nAgenda:\n• Daily targets, visitor footfall conversion & bridal customer engagement\n• Departmental readiness, visual merchandising & inventory highlights\n• Mystery shopping check compliance & hospitality feedback review\n\nPlease ensure your shift coordination is completed and be present on time.\n\nWarm regards,\nStore Management & HR Desk`
  },
  {
    id: 'festive_campaign',
    name: '🎉 Festive Season & Bridal Campaign',
    badge: 'Campaign',
    subject: 'Special Announcement: Launch of Festive & Wedding Season Boutique Campaign',
    category: 'General',
    priority: 'normal',
    body: `Dear Team,\n\nWe are proud to announce the commencement of our upcoming Festive & Wedding Season Campaign across all boutique locations!\n\nOur flagship textile collections and bridal lounge appointments will be at the forefront of this initiative. Let us deliver exceptional customer warmth and achieve landmark store targets together.\n\nBest wishes to all teams for a stellar season!\n\nExecutive Leadership,\nBSC Textiles Private Limited`
  },
  {
    id: 'policy_compliance',
    name: '📋 Workplace Standards & Compliance Policy',
    badge: 'Policy',
    subject: 'Administrative Directive: Workplace Standards & Compliance Guidelines',
    category: 'System',
    priority: 'normal',
    body: `Dear Team Members,\n\nThis communication serves as an official reminder regarding company operational policies and workplace compliance.\n\nKey Guidelines:\n• Strict punctuality and shift schedule adherence\n• Maintenance of confidentiality, customer privacy, and data security\n• Zero tolerance for workplace harassment or policy non-compliance\n\nPlease contact the HR Department for any questions or assistance.\n\nSincerely,\nHR & Corporate Compliance Desk`
  },
  {
    id: 'new_employee_welcome',
    name: '🌟 New Team Member Welcome Announcement',
    badge: 'Welcome',
    subject: 'Welcome to the BSC Textiles Family: Official Onboarding Announcement',
    category: 'Joining',
    priority: 'normal',
    body: `Dear Team Member,\n\nOn behalf of the entire BSC Textiles family, we are delighted to welcome you to our organization!\n\nYour talent and dedication strengthen our mission to deliver world-class textiles and premier retail hospitality. Please review your induction schedule with your reporting manager.\n\nWe wish you a rewarding, enriching, and successful career journey with us.\n\nWarmest regards,\nHuman Resources & Executive Management`
  },
  {
    id: 'maintenance_downtime',
    name: '⚠️ Scheduled System Maintenance Notice',
    badge: 'System',
    subject: 'Technical Notice: Scheduled CRM & Cloud System Maintenance Window',
    category: 'System',
    priority: 'high',
    body: `Dear Team,\n\nPlease be informed that our core CRM, Footfall, and POS sync services will undergo scheduled cloud maintenance to optimize database responsiveness.\n\nMaintenance Window: Tonight, 11:30 PM to 12:30 AM IST.\nAll business data is safely persisted and automatic daily reports will dispatch on schedule.\n\nTechnical Support Team,\nBSC Textiles`
  }
];

export default function BroadcastCenterPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'email' | 'history'>('dashboard');

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Form State (In-App Broadcast)
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [category, setCategory] = useState<'General' | 'HR' | 'Recruitment' | 'Interview' | 'Offer' | 'Joining' | 'Payroll' | 'System' | 'Emergency'>('General');
  const [targetRoles, setTargetRoles] = useState<string[]>(['Everyone']);
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [pinNotification, setPinNotification] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [alsoSendEmail, setAlsoSendEmail] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  // Email Broadcast Desk State
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailPriority, setEmailPriority] = useState<'normal' | 'high' | 'critical'>('normal');
  const [emailCategory, setEmailCategory] = useState('General');
  const [emailAudience, setEmailAudience] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [systemUsers, setSystemUsers] = useState<Array<{ id: number; fullName?: string; username: string; email: string; role?: string }>>([]);

  // Data List
  const [broadcasts, setBroadcasts] = useState<SystemNotification[]>([]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);

    const unsub = NotificationService.subscribe((list) => {
      setBroadcasts(list);
    });

    // Fetch active users with emails for quick recipient selector
    API.getUsers().then((res: any) => {
      if (res && res.users) {
        setSystemUsers(res.users.filter((u: any) => u.email && String(u.email).trim()));
      }
    }).catch(() => {});

    return () => unsub();
  }, [navigate]);

  const handleToggleRole = (role: string) => {
    if (role === 'Everyone') {
      setTargetRoles(['Everyone']);
      return;
    }
    setTargetRoles(prev => {
      const filtered = prev.filter(r => r !== 'Everyone');
      return filtered.includes(role) ? filtered.filter(r => r !== role) : [...filtered, role];
    });
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = PREDEFINED_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      if (tmpl.id !== 'custom') {
        setEmailSubject(tmpl.subject);
        setEmailMessage(tmpl.body);
        setEmailPriority(tmpl.priority);
        setEmailCategory(tmpl.category);
      }
    }
  };

  const handleDispatchEmail = async () => {
    if (!emailMessage.trim()) {
      showToast('Email message content is required', 'error');
      return;
    }
    if (!emailRecipients.trim() && emailAudience.length === 0) {
      showToast('Please provide at least one recipient email or select an audience role group.', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      const res: any = await API.sendBroadcastEmail({
        recipients: emailRecipients.trim() || undefined,
        audience: emailAudience.length > 0 ? emailAudience : undefined,
        subject: emailSubject.trim() || 'BSC Textiles Executive Broadcast',
        message: emailMessage.trim(),
        priority: emailPriority,
        category: emailCategory
      });

      if (res && res.success) {
        showToast(res.message || `Broadcast email delivered to ${res.deliveredCount || 1} recipients!`, 'success');
        setEmailRecipients('');
        setEmailSubject('');
        setEmailMessage('');
        setEmailAudience([]);
        setSelectedTemplateId('custom');
      } else {
        showToast(res?.error || 'Failed to dispatch email. Please check SMTP configuration.', 'error');
      }
    } catch (err: any) {
      showToast('Error dispatching email: ' + (err.message || 'SMTP delivery failed'), 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDispatch = async (isDraft = false) => {
    if (!title.trim() || !message.trim()) {
      showToast('Broadcast title and message are required', 'error');
      return;
    }

    setDispatching(true);
    try {
      await NotificationService.addNotification({
        title,
        subject,
        message,
        priority,
        category,
        targetRole: targetRoles.join(', '),
        senderName: session?.fullName || 'HR Manager',
        status: isDraft ? 'Draft' : (scheduledAt ? 'Scheduled' : 'Sent'),
        requireAcknowledgement: requireAck,
        pinned: pinNotification,
        expiryDate,
        scheduledAt,
        allowReplies,
        acknowledgedBy: []
      });

      // If user opted to also send via email to registered audience members
      if (!isDraft && alsoSendEmail) {
        try {
          await API.sendBroadcastEmail({
            audience: targetRoles,
            subject: subject || title,
            message,
            title,
            priority,
            category
          });
        } catch (e: any) {
          console.warn('[Broadcast email dispatch warning]', e.message);
        }
      }

      showToast(isDraft ? 'Broadcast draft saved successfully.' : 'Broadcast announcement dispatched successfully.', 'success');
      setTitle('');
      setSubject('');
      setMessage('');
      setScheduledAt('');
      setStartDate('');
      setExpiryDate('');
      setAlsoSendEmail(false);
      setActiveTab('dashboard');
    } catch (err: any) {
      showToast('Unable to dispatch broadcast. Please try again.', 'error');
    } finally {
      setDispatching(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this broadcast notification?')) return;
    try {
      await NotificationService.deleteNotification(id);
      showToast('Broadcast removed successfully.', 'success');
    } catch (err: any) {
      showToast('Unable to delete broadcast: ' + (err.message || 'Server error'), 'error');
    }
  };

  // Metrics Calculation
  const total = broadcasts.length;
  const activeCount = broadcasts.filter(b => b.status === 'Sent').length;
  const scheduledCount = broadcasts.filter(b => b.status === 'Scheduled').length;
  const draftCount = broadcasts.filter(b => b.status === 'Draft').length;
  const readCount = broadcasts.filter(b => b.read).length;
  const readPercent = total > 0 ? Math.round((readCount / total) * 100) : 100;
  const ackRequiredCount = broadcasts.filter(b => b.requireAcknowledgement).length;
  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';

  const RECIPIENT_ROLES = [
    'Everyone',
    'HR Team',
    'Recruiters',
    'Store Managers',
    'Interview Panel',
    'Employees',
    'Admins'
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[270px]'}`}>
        <Topbar
          title="Broadcast Center"
          breadcrumbs={[{ label: activeTab === 'dashboard' ? 'Analytics Dashboard' : activeTab === 'create' ? 'Create In-App Notice' : activeTab === 'email' ? 'Email Broadcast Desk' : 'Broadcast History' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Bar */}
          <div className="card-glass p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-primary tracking-tight flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-accent" />
                <span>Enterprise Broadcast &amp; Notification Control Desk</span>
              </h2>
              <p className="text-xs text-primary font-medium mt-0.5">Commercial-grade role-based messaging, Hostinger outbound email dispatch &amp; real-time alerts.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'dashboard', label: 'Analytics Dashboard' },
                { key: 'create', label: '+ In-App Notice' },
                { key: 'email', label: '📧 Dispatch Email' },
                { key: 'history', label: 'Broadcast History' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`
                    px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer
                    ${activeTab === t.key ? 'bg-primary text-white shadow-md' : 'bg-white border border-accent-soft text-primary hover:bg-background'}
                  `}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Analytics Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Total Broadcasts" value={total} trend={`${activeCount} Active`} color="navy" icon={Megaphone} />
                <MetricCard title="Active & Sent" value={activeCount} trend="Real-Time Active" color="emerald" icon={CircleCheck} />
                <MetricCard title="Scheduled" value={scheduledCount} trend="Pending Auto-Dispatch" color="gold" icon={Clock} />
                <MetricCard title="Read Engagement" value={`${readPercent}%`} trend={`${readCount} Read`} color="teal" icon={Eye} />
              </div>

              {/* Recent Activity Table */}
              <div className="card-glass p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-accent-soft pb-3">
                  <h3 className="font-extrabold text-primary text-base">Active Broadcast Announcements</h3>
                  <span className="text-xs font-bold text-primary font-mono">{broadcasts.length} Broadcast Logs</span>
                </div>

                <div className="table-frame custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-accent-soft text-primary font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3 text-center w-12">SL.NO</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Title &amp; Subject</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Audience</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Acks</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft">
                      {broadcasts.map((b, idx) => (
                        <tr key={b.id} className="hover:bg-background transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-primary">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                              b.priority === 'critical' ? 'bg-rose-100 text-rose-800' :
                              b.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {b.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-primary">{b.title}</div>
                            <div className="text-[10.5px] text-primary">{b.subject || b.message.slice(0, 45)}</div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-primary">{b.category}</td>
                          <td className="py-3 px-3 font-bold text-accent">{b.targetRole || 'Everyone'}</td>
                          <td className="py-3 px-3 font-extrabold text-emerald-700">{b.status || 'Sent'}</td>
                          <td className="py-3 px-3 font-mono font-bold text-primary">{b.acknowledgedBy?.length || 0}</td>
                          <td className="py-3 px-3 text-right">
                            {isAdmin && (
                            <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CREATE BROADCAST TAB */}
          {activeTab === 'create' && (
            <div className="card-glass p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
                <Send className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="font-extrabold text-primary text-base">Create Enterprise Broadcast Notice</h3>
                  <p className="text-xs text-primary">Dispatch text messages, announcements &amp; alerts (Pure messaging-only, no attachments).</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Title & Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-primary mb-1">Broadcast Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Q3 Sales Requisition Notice"
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Subject / Header</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Urgent Store Operations Update"
                      className="input-modern"
                    />
                  </div>
                </div>

                {/* Priority & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-primary mb-1">Priority Level</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority</option>
                      <option value="critical">Critical Emergency</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Broadcast Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="General">General Announcement</option>
                      <option value="HR">HR &amp; Operations</option>
                      <option value="Recruitment">Recruitment &amp; Openings</option>
                      <option value="Interview">Interview Panel Alert</option>
                      <option value="Offer">Offer Release</option>
                      <option value="Joining">Joining &amp; Onboarding</option>
                      <option value="Payroll">Payroll Notice</option>
                      <option value="System">System Maintenance</option>
                      <option value="Emergency">Emergency Alert</option>
                    </select>
                  </div>
                </div>

                {/* Recipient Role Selection */}
                <div>
                  <label className="block font-bold text-primary mb-2">Target Audience / Recipient Groups *</label>
                  <div className="flex flex-wrap gap-2">
                    {RECIPIENT_ROLES.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleToggleRole(r)}
                        className={`
                          px-3.5 py-2 rounded-xl border text-xs font-bold transition-all
                          ${targetRoles.includes(r) ? 'bg-primary text-white border-primary' : 'bg-background border-accent-soft text-primary hover:bg-white'}
                        `}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates & Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-primary mb-1">Schedule Dispatch Date &amp; Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="input-modern"
                    />
                  </div>
                </div>

                {/* Messaging Content */}
                <div>
                  <label className="block font-bold text-primary mb-1">Broadcast Message Body * (Text Only)</label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter message text content..."
                    className="textarea-modern font-medium"
                  />
                  <span className="text-[10.5px] text-[#6B5D50] font-semibold block mt-1">Note: Pure text messaging module. File attachments and media sharing are strictly disabled.</span>
                </div>

                {/* Options Checkboxes */}
                <div className="p-4 rounded-2xl bg-background border border-accent-soft space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-primary">
                    <input
                      type="checkbox"
                      checked={pinNotification}
                      onChange={(e) => setPinNotification(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span>Pin Announcement to Top of User Notification Drawer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-primary">
                    <input
                      type="checkbox"
                      checked={requireAck}
                      onChange={(e) => setRequireAck(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span>Require Mandatory "I Have Read" Acknowledgement Click</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-primary">
                    <input
                      type="checkbox"
                      checked={alsoSendEmail}
                      onChange={(e) => setAlsoSendEmail(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-accent" />
                      <span>Also Dispatch via Email (Hostinger SMTP) to Audience with Registered Email</span>
                    </span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-accent-soft">
                  <button
                    type="button"
                    disabled={dispatching}
                    onClick={() => handleDispatch(true)}
                    className="px-4 py-2.5 rounded-xl border border-accent-soft font-bold text-xs bg-white hover:bg-background disabled:opacity-50 cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={dispatching}
                    onClick={() => handleDispatch(false)}
                    className="btn-gold text-xs shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {dispatching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Real-Time Broadcast</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL BROADCAST & MAILBOX TAB */}
          {activeTab === 'email' && (
            <div className="card-glass p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
              {/* Header */}
              <div className="border-b border-accent-soft pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-primary text-accent flex items-center justify-center font-black shrink-0 shadow-sm">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-primary text-base flex items-center gap-2">
                      <span>Outbound Email Dispatch Desk</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-accent/20 text-accent uppercase">Hostinger SMTP</span>
                    </h3>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      Send branded executive emails to individual recipients, user accounts, or role groups using pre-built luxury templates or custom mailbox text.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
                  <Server className="w-3.5 h-3.5 text-emerald-600" />
                  <span>smtp.hostinger.com:465 (SSL)</span>
                </div>
              </div>

              {/* Predefined Templates Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span>Choose Predefined Email Template</span>
                  </label>
                  <span className="text-[11px] text-[#6B5D50] font-medium">Click any template to auto-populate subject &amp; mailbox body</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {PREDEFINED_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className={`
                        p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5
                        ${selectedTemplateId === tmpl.id
                          ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-accent/40'
                          : 'bg-background border-accent-soft text-primary hover:bg-white'}
                      `}
                    >
                      <div className="font-bold text-xs truncate">{tmpl.name}</div>
                      <div className="flex items-center justify-between text-[10px] opacity-80">
                        <span className="uppercase tracking-wider font-mono">{tmpl.badge}</span>
                        <span className="capitalize">{tmpl.priority}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Configuration */}
              <div className="p-4 rounded-2xl bg-background border border-accent-soft space-y-4">
                <div className="font-extrabold text-sm text-primary flex items-center gap-2 border-b border-accent-soft pb-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Recipients &amp; Target Audience</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  {/* Option 1: Direct Email Input */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-primary">
                      Recipient Email Address(es) <span className="text-[10.5px] font-normal text-gray-500">(comma or space separated)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={emailRecipients}
                        onChange={(e) => setEmailRecipients(e.target.value)}
                        placeholder="e.g. employee@bsctextiles.in, partner@gmail.com"
                        className="input-modern pr-10 font-medium"
                      />
                      <AtSign className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Quick System User Picker */}
                    {systemUsers.length > 0 && (
                      <div className="pt-1.5">
                        <div className="text-[10.5px] font-bold text-[#6B5D50] mb-1">Quick Select Active Users with Email:</div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                          {systemUsers.slice(0, 15).map((u) => {
                            const isAdded = emailRecipients.toLowerCase().includes(u.email.toLowerCase());
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  if (isAdded) {
                                    // Remove
                                    const regex = new RegExp(`[,\\s]*${u.email}`, 'gi');
                                    setEmailRecipients(emailRecipients.replace(regex, '').replace(/^,\s*/, ''));
                                  } else {
                                    // Add
                                    setEmailRecipients(prev => prev ? `${prev.trim().replace(/,$/, '')}, ${u.email}` : u.email);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-medium border transition-all cursor-pointer ${
                                  isAdded
                                    ? 'bg-accent/20 border-accent text-primary font-bold'
                                    : 'bg-white border-accent-soft text-[#5D4E42] hover:bg-background'
                                }`}
                              >
                                {u.fullName || u.username} ({u.email})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option 2: Target Audience Roles */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-primary">
                      Or Send to Audience Role Groups <span className="text-[10.5px] font-normal text-gray-500">(all users with email)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {RECIPIENT_ROLES.map((r) => {
                        const isSelected = emailAudience.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              if (r === 'Everyone') {
                                setEmailAudience(isSelected ? [] : ['Everyone']);
                                return;
                              }
                              setEmailAudience(prev => {
                                const withoutEveryone = prev.filter(x => x !== 'Everyone');
                                return withoutEveryone.includes(r)
                                  ? withoutEveryone.filter(x => x !== r)
                                  : [...withoutEveryone, r];
                              });
                            }}
                            className={`
                              px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer
                              ${isSelected
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-white border-accent-soft text-primary hover:bg-background'}
                            `}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-[#6B5D50] pt-1">
                      Targeted roles will automatically resolve active team members who have registered email addresses in the database.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mail Box Composer */}
              <div className="space-y-4 text-xs">
                {/* Subject & Category / Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-primary mb-1">Email Subject Header *</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="e.g. Official Update: Store Operational Directives"
                      className="input-modern font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-primary mb-1">Priority Level</label>
                    <select
                      value={emailPriority}
                      onChange={(e) => setEmailPriority(e.target.value as any)}
                      className="select-modern font-bold"
                    >
                      <option value="normal">Normal Priority</option>
                      <option value="high">High Priority</option>
                      <option value="critical">Critical Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Mail Box Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-primary">Email Message Body / Mailbox * (Customizable)</label>
                    <span className="text-[10.5px] font-mono text-gray-500">{emailMessage.length} characters</span>
                  </div>
                  <textarea
                    rows={8}
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    placeholder="Compose your official email message here. Use paragraphs and blank lines for spacing..."
                    className="textarea-modern font-mono text-xs leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[10.5px] text-[#6B5D50] pt-1">
                    <span>Branded HTML styling with BSC Textiles logo, emerald &amp; gold headers will be automatically applied.</span>
                    <button
                      type="button"
                      onClick={() => { setEmailSubject(''); setEmailMessage(''); setSelectedTemplateId('custom'); }}
                      className="text-rose-600 hover:underline font-bold"
                    >
                      Clear Mailbox
                    </button>
                  </div>
                </div>

                {/* Live Preview Box */}
                {emailMessage && (
                  <div className="p-4 rounded-2xl bg-white border border-accent-soft space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Live Branded Email Appearance Preview</span>
                    </div>
                    <div className="border border-accent-soft/60 rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-primary p-3 text-white flex justify-between items-center border-b-2 border-accent">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-accent font-bold">BSC TEXTILES · ENTERPRISE COMMUNICATIONS</div>
                          <div className="text-xs font-bold truncate">{emailSubject || 'Enterprise Announcement'}</div>
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20 text-white">
                          {emailPriority}
                        </span>
                      </div>
                      <div className="p-4 bg-[#FAF8F5] text-xs text-[#2C2523] whitespace-pre-wrap font-sans leading-relaxed border-l-4 border-accent ml-3 my-3 mr-3 bg-white rounded-r-lg">
                        {emailMessage}
                      </div>
                      <div className="bg-[#FAF8F5] p-2 text-center text-[10px] text-gray-500 border-t border-accent-soft">
                        BSC Textiles Private Limited · Dispatched via Hostinger Secure Mail Server
                      </div>
                    </div>
                  </div>
                )}

                {/* Dispatch Button */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-accent-soft">
                  <button
                    type="button"
                    disabled={sendingEmail}
                    onClick={handleDispatchEmail}
                    className="btn-gold text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 px-6 py-2.5 font-black"
                  >
                    {sendingEmail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending via Hostinger SMTP...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Email via Hostinger SMTP</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="card-glass p-6 space-y-4">
              <h3 className="font-extrabold text-primary text-base border-b border-accent-soft pb-3">Complete Broadcast Audit &amp; History Log</h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {broadcasts.map((b) => (
                  <div key={b.id} className="p-4 rounded-2xl border border-accent-soft bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-primary">{b.title}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary/10 text-primary">
                          {b.targetRole || 'Everyone'}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-primary font-mono">{new Date(b.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-[#5D4E42] font-medium leading-relaxed">{b.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-[#6B5D50] pt-1 border-t border-accent-soft/50 font-semibold">
                      <span>Sender: <strong className="text-primary">{b.senderName || 'HR Desk'}</strong></span>
                      <span>Read Acknowledgements: <strong className="text-emerald-700 font-mono">{b.acknowledgedBy?.length || 0} Users</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
