import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { useLocationContext } from '../context/LocationContext';
import {
  QrCode,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  Copy,
  CircleCheck,
  CircleX,
  ArrowUpRight,
  Image,
  Printer,
  Share2,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ScanLine,
  Zap,
  Shield,
  CircleAlert,
  CheckCircle,
  X,
  Loader2,
  MoreVertical,
  Grid,
  List,
  Calendar,
  MapPin,
  Building2,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Mail,
  Phone,
  Globe,
  Wifi,
  Battery,
  Cpu,
  HardDrive,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Server,
  Database,
  Cloud,
  Lock,
  Unlock,
  Key,
  Fingerprint,
  UserCheck,
  ClipboardList,
  FileText,
  Save,
  RotateCcw,
  History,
  Clock,
  CalendarDays,
  CalendarRange,
  ArrowLeft,
  ArrowRight,
  Minus,
  CirclePlus,
  Menu,
  Bell,
  BellOff,
  Flag,
  Star,
  Heart,
  Store,
  Layers,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  Reply,
  Forward,
  Archive,
  FolderOpen,
  FilePlus,
  FileMinus,
  FileQuestion,
  FileSearch,
  FileText as FileTextIcon,
  Video,
  Music,
  Code,
  Terminal,
  Bug,
  TestTube,
  FlaskConical,
  Microscope,
  Dna,
  Brain,
  Lightbulb,
  Target,
  Award,
  Trophy,
  Medal,
  Crown,
  Gem,
  Sparkles,
  Paintbrush,
  Palette,
  Camera,
  Mic,
  Headphones,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  FastForward,
  Rewind,
  Shuffle,
  Repeat,
  Bookmark,
  Tag,
  Link,
  Link2,
  Unlink,
  ExternalLink,
  Anchor,
  Share,
  User,
  UserPlus,
  UserMinus,
  UserX,
  UserCheck as UserCheckIcon,
  UserCog,
  UserPen,
  UserRound,
  UserRoundPlus,
  UserRoundMinus,
  UserRoundX,
  Maximize,
  Minimize,
  Fullscreen,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Move,
  Hand,
  Pointer,
  Crosshair,
  Scissors,
  Eraser,
  Pen,
  PenTool,
  Highlighter,
  Brush,
  SprayCan,
  Droplet,
  Pipette,
  SwatchBook,
  Layout,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LayoutPanelLeft,
  LayoutPanelTop,
  Sidebar,
  PanelLeft,
  PanelRight,
  PanelTop,
  PanelBottom,
  TableCellsMerge,
  TableCellsSplit,
  TableColumnsSplit,
  TableOfContents,
  TableProperties,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  ListOrdered,
  ListTodo,
  ListChecks,
  ListX,
  ListMinus,
  ListPlus,
  ListMusic,
  ListVideo,
  ListFilter,
  ListStart,
  ListEnd,
  ListRestart,
  ListTree,
  GitBranch,
  GitCommit,
  GitCompare,
  GitFork,
  GitMerge,
  GitPullRequest,
  GitBranchPlus,
  GitCommitHorizontal,
  GitCompareArrows,
  GitPullRequestArrow,
  GitCommitVertical,
  GitGraph,
} from 'lucide-react';
import { API, Auth } from '../services/api';
import { showToast } from '../components/Toast';
import { format } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';

interface QRCode {
  id: string;
  qrCodeId: string;
  name: string;
  description: string;
  locationId: number;
  locationCode: string;
  locationName: string;
  sectionId: string | null;
  sectionName: string | null;
  floor?: string | null;
  feedbackFormId: string | null;
  targetUrl: string;
  qrCodeDataUrl: string | null;
  qrCodeSvg: string | null;
  status: 'active' | 'inactive' | 'archived';
  scanCount: number;
  lastScannedAt: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  feedbackCount: number;
  totalScans: number;
  scansWithFeedback: number;
}

interface QRCodeStats {
  totalQrCodes: number;
  activeQrCodes: number;
  inactiveQrCodes: number;
  totalScans: number;
  totalFeedback: number;
  todayFeedback: number;
  averageRating: string;
  charts: {
    scansByDay: { date: string; scans: number }[];
    feedbackByDay: { date: string; feedback: number }[];
  };
}

interface Location {
  id: number;
  locationCode: string;
  locationName: string;
}

interface Section {
  id: string;
  name: string;
}

interface FeedbackForm {
  id: string;
  formId: string;
  name: string;
  description: string;
  questionsJson: any[];
  isDefault: number;
  status: string;
}

export const STANDARD_FLOORS = [
  'Ground Floor',
  'First Floor',
  'Second Floor',
  'Third Floor',
  'Fourth Floor',
  'Basement',
  'Mezzanine Floor'
];

const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    active: { className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CircleCheck className="w-3 h-3" />, label: 'Active' },
    inactive: { className: 'bg-gray-100 text-gray-800 border-gray-200', icon: <CircleX className="w-3 h-3" />, label: 'Inactive' },
    archived: { className: 'bg-rose-100 text-rose-800 border-rose-200', icon: <Archive className="w-3 h-3" />, label: 'Archived' }
  };
  const c = config[status as keyof typeof config] || config.inactive;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
};

const ActionButton = ({
  onClick,
  children,
  variant = 'default',
  size = 'sm',
  disabled = false,
  icon,
  title,
  className = '',
  type = 'button',
}: {
  onClick?: () => void;
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: React.ReactNode;
  title?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const variants = {
    default: 'bg-white border-accent-soft text-primary hover:bg-gray-50',
    primary: 'bg-primary text-accent hover:bg-primary-hover',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200',
    ghost: 'bg-transparent hover:bg-gray-100',
    gold: 'btn-gold'
  };
  const sizes = {
    xs: 'px-2 py-1 text-[10px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5'
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center rounded-xl font-extrabold transition-all shadow-xs border ${variants[variant]} ${sizes[size]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon}
      {children}
    </button>
  );
};

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = 'primary', 
  trend,
  trendUp = true
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'primary' | 'emerald' | 'rose' | 'blue' | 'purple' | 'amber';
  trend?: string;
  trendUp?: boolean;
}) => {
  const colors = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200'
  };
  const iconColors = {
    primary: 'text-primary',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600'
  };

  return (
    <div className="card-glass p-5 flex items-center justify-between border-l-4 border-l-current">
      <div>
        <div className="text-[10.5px] font-black uppercase tracking-wider text-primary">{title}</div>
        <div className="text-2xl font-black text-primary mt-1">{value}</div>
        {subtitle && <div className="text-[11px] text-primary/60 font-semibold mt-0.5">{subtitle}</div>}
        {trend && (
          <div className={`text-[11px] font-bold mt-0.5 flex items-center gap-1 ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className={`w-12 h-12 rounded-2xl ${colors[color]} flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${iconColors[color]}`} />
      </div>
    </div>
  );
};

// Location QR Card Component
const LocationQrCard = ({ locQr, loading }: { locQr: any; loading: boolean }) => {
  const locationColors = {
    BEL: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' },
    DAV: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'text-emerald-600' },
    SHI: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-amber-600' }
  };
  const colors = locationColors[locQr.locationCode as keyof typeof locationColors] || locationColors.BEL;

  const handleCopyUrl = (url: string, locationName: string) => {
    navigator.clipboard.writeText(url);
    showToast(`${locationName} feedback link copied successfully.`, 'success');
  };

  const handleOpenFeedback = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDownloadPng = (qrCodeDataUrl: string, qrCodeId: string, name: string) => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `${qrCodeId}_${name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('QR code PNG downloaded.', 'success');
  };

  const handleDownloadSvg = (qrCodeSvg: string, qrCodeId: string, name: string) => {
    if (!qrCodeSvg) return;
    const blob = new Blob([qrCodeSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${qrCodeId}_${name.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('QR code SVG downloaded.', 'success');
  };

  if (loading) {
    return (
      <div className="card-glass p-5 space-y-4 border border-accent-soft animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-6 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="h-48 bg-gray-100 rounded-xl flex items-center justify-center">
          <div className="w-32 h-32 bg-gray-200 rounded"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (locQr.status === 'not_created') {
    return (
      <div className="card-glass p-5 space-y-4 border border-dashed border-gray-300 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-extrabold text-primary text-sm uppercase tracking-wider">{locQr.locationName}</div>
            <div className="text-[10px] font-mono font-black {colors.icon}">{locQr.locationCode}</div>
          </div>
          <Store className="w-10 h-10 text-gray-300" />
        </div>
        <div className="h-48 flex flex-col items-center justify-center text-gray-400 space-y-2">
          <QrCode className="w-16 h-16 opacity-30" />
          <p className="text-sm font-semibold">QR Code Not Generated</p>
          <p className="text-xs text-gray-500">Click "Generate All Location QR Codes" to create</p>
        </div>
        <div className="text-center text-xs text-gray-500 border-t border-dashed border-gray-300 pt-3">
          <p>No QR code exists for {locQr.storeName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-glass p-5 space-y-4 border {colors.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-extrabold text-primary text-sm uppercase tracking-wider">{locQr.locationName}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${colors.bg} {colors.text} {colors.border}`}>
              {locQr.locationCode}
            </span>
            <span className="text-[10px] text-primary/60 font-medium">{locQr.storeName}</span>
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${locQr.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
          {locQr.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* QR Code */}
      <div className="p-4 bg-white rounded-xl border border-accent-soft text-center">
        {locQr.qrCodeDataUrl ? (
          <img src={locQr.qrCodeDataUrl} alt={`QR Code ${locQr.qrCodeId}`} className="w-40 h-40 mx-auto" />
        ) : (
          <div className="w-40 h-40 flex items-center justify-center text-gray-400 mx-auto">
            <QrCode className="w-16 h-16" />
          </div>
        )}
      </div>

      {/* URL */}
      <div className="p-3 bg-gray-50 rounded-xl border border-accent-soft">
        <div className="text-[10px] font-black uppercase tracking-wider text-primary/60 mb-1">Public Feedback URL</div>
        <div className="text-xs font-mono text-primary truncate break-all">{locQr.targetUrl}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 {colors.bg} rounded-xl border {colors.border}">
          <div className="font-extrabold text-lg {colors.text}">{locQr.scanCount}</div>
          <div className="text-[10px] uppercase tracking-wider {colors.text}/80">Scans</div>
        </div>
        <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="font-extrabold text-lg text-emerald-800">{locQr.feedbackCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-700">Feedback</div>
        </div>
        <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
          <div className="font-extrabold text-lg text-amber-800">{locQr.scansWithFeedback}</div>
          <div className="text-[10px] uppercase tracking-wider text-amber-700">Converted</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-accent-soft">
        <ActionButton
          onClick={() => locQr.targetUrl && handleCopyUrl(locQr.targetUrl, locQr.locationName)}
          disabled={!locQr.targetUrl}
          variant="ghost"
          size="xs"
          icon={<Copy className="w-3.5 h-3.5" />}
          className="flex-1 min-w-0"
          title="Copy URL"
        >
          Copy
        </ActionButton>
        <ActionButton
          onClick={() => locQr.targetUrl && handleOpenFeedback(locQr.targetUrl)}
          disabled={!locQr.targetUrl}
          variant="ghost"
          size="xs"
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          className="flex-1 min-w-0"
          title="Open Feedback Page"
        >
          Open
        </ActionButton>
        <ActionButton
          onClick={() => locQr.qrCodeDataUrl && handleDownloadPng(locQr.qrCodeDataUrl, locQr.qrCodeId, locQr.name)}
          disabled={!locQr.qrCodeDataUrl}
          variant="ghost"
          size="xs"
          icon={<Image className="w-3.5 h-3.5" />}
          className="flex-1 min-w-0"
          title="Download PNG"
        >
          PNG
        </ActionButton>
        <ActionButton
          onClick={() => locQr.qrCodeSvg && handleDownloadSvg(locQr.qrCodeSvg, locQr.qrCodeId, locQr.name)}
          disabled={!locQr.qrCodeSvg}
          variant="ghost"
          size="xs"
          icon={<FileText className="w-3.5 h-3.5" />}
          className="flex-1 min-w-0"
          title="Download SVG"
        >
          SVG
        </ActionButton>
      </div>
    </div>
  );
};

// Placeholder card when no QR codes loaded yet
const LocationQrPlaceholder = ({ locationCode, locationName, storeName }: { locationCode: string; locationName: string; storeName: string }) => {
  const locationColors = {
    BEL: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' },
    DAV: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'text-emerald-600' },
    SHI: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'text-amber-600' }
  };
  const colors = locationColors[locationCode as keyof typeof locationColors] || locationColors.BEL;

  return (
    <div className="card-glass p-5 space-y-4 border {colors.border}">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-extrabold text-primary text-sm uppercase tracking-wider">{locationName}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${colors.bg} {colors.text} {colors.border}`}>
              {locationCode}
            </span>
            <span className="text-[10px] text-primary/60 font-medium">{storeName}</span>
          </div>
        </div>
        <Store className="w-10 h-10 text-gray-300" />
      </div>
      <div className="h-48 flex flex-col items-center justify-center text-gray-400 space-y-2">
        <QrCode className="w-16 h-16 opacity-30" />
        <p className="text-sm font-semibold">QR Code Not Generated</p>
        <p className="text-xs text-gray-500">Click "Generate All Location QR Codes" to create</p>
      </div>
      <div className="text-center text-xs text-gray-500 border-t border-dashed border-gray-300 pt-3">
        <p>No QR code exists for {storeName}</p>
      </div>
    </div>
  );
};

export default function FeedbackQRManagement() {
  const { currentLocation, isGlobalAdmin, allLocations } = useLocationContext();
  const [session, setSession] = useState<any>(null);
  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [stats, setStats] = useState<QRCodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQrCode, setEditingQrCode] = useState<QRCode | null>(null);
  const [previewQrCode, setPreviewQrCode] = useState<QRCode | null>(null);
  const [scanHistoryQrCode, setScanHistoryQrCode] = useState<QRCode | null>(null);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [scanHistoryLoading, setScanHistoryLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    locationId: '',
    locationCode: '',
    locationName: '',
    sectionId: '',
    sectionName: '',
    floor: '',
    feedbackFormId: '',
    status: 'active' as 'active' | 'inactive' | 'archived'
  });
  const [isCustomFloor, setIsCustomFloor] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [feedbackForms, setFeedbackForms] = useState<FeedbackForm[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [locationsLoading, setLocationsLoading] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Location QR Codes (3 cards - one per location)
  const [locationQrCodes, setLocationQrCodes] = useState<any[]>([]);
  const [locationQrLoading, setLocationQrLoading] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);

  // Filter location QR codes based on global location selector
  const displayLocationQrCodes = useMemo(() => {
    if (isGlobalAdmin && currentLocation !== 'ALL') {
      return locationQrCodes.filter(loc => String(loc.locationId) === currentLocation);
    }
    return locationQrCodes;
  }, [locationQrCodes, currentLocation, isGlobalAdmin]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLocationsLoading(true);
    setLocationQrLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        locationId: locationFilter || undefined,
        floor: floorFilter !== 'all' ? floorFilter : undefined,
        sortBy,
        sortOrder
      };
      // For stats, also consider global location selector for global admins
      const statsLocationId = (isGlobalAdmin && currentLocation !== 'ALL') ? currentLocation : (locationFilter || undefined);
      const [qrRes, statsRes, locRes, masterLocRes, secRes, formRes, locQrRes] = await Promise.allSettled([
        API.getQrCodes(params),
        API.getQrCodeStats({ 
          status: statusFilter !== 'all' ? statusFilter : undefined, 
          locationId: statsLocationId,
          floor: floorFilter !== 'all' ? floorFilter : undefined 
        }),
        API.getLocationsForQr(),
        API.getLocations(),
        API.getSectionsForQr(locationFilter || undefined),
        API.getFeedbackForms(),
        API.getLocationQrCodes(statsLocationId || undefined)
      ]);

      if (qrRes.status === 'fulfilled' && qrRes.value?.success) {
        setQrCodes(qrRes.value.data || []);
        setTotalItems(qrRes.value.pagination?.total || 0);
        setTotalPages(qrRes.value.pagination?.totalPages || 1);
      } else if (qrRes.status === 'rejected') {
        console.warn('QR codes fetch failed:', qrRes.reason);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats({ ...(statsRes.value.stats || {}), charts: statsRes.value.charts || { scansByDay: [], feedbackByDay: [] } });
      }

      // Merge locations from both getLocations (system-wide) and getLocationsForQr
      let combinedLocs: Location[] = [];
      if (masterLocRes.status === 'fulfilled' && (masterLocRes.value?.locations || masterLocRes.value?.data)) {
        const raw = masterLocRes.value.locations || masterLocRes.value.data || [];
        combinedLocs = raw.map((l: any) => ({
          id: Number(l.id) || l.id,
          locationCode: String(l.locationCode || l.code || l.location_code || 'LOC').toUpperCase(),
          locationName: String(l.locationName || l.name || l.location_name || '').trim()
        }));
      }
      if (locRes.status === 'fulfilled' && (locRes.value?.data || locRes.value?.locations)) {
        const qrLocs = (locRes.value.data || locRes.value.locations || []).map((l: any) => ({
          id: Number(l.id) || l.id,
          locationCode: String(l.locationCode || l.code || l.location_code || 'LOC').toUpperCase(),
          locationName: String(l.locationName || l.name || l.location_name || '').trim()
        }));
        qrLocs.forEach((ql: Location) => {
          if (!combinedLocs.some(cl => Number(cl.id) === Number(ql.id) || (cl.locationCode && cl.locationCode === ql.locationCode))) {
            combinedLocs.push(ql);
          }
        });
      }

      // Ensure standard BSC locations if still empty
      if (combinedLocs.length === 0) {
        combinedLocs = [
          { id: 1, locationCode: 'BEL', locationName: 'Belagavi' },
          { id: 2, locationCode: 'DAV', locationName: 'Davanagere' },
          { id: 3, locationCode: 'SHI', locationName: 'Shivamogga' }
        ];
      }
      setLocations(combinedLocs);

      if (secRes.status === 'fulfilled' && secRes.value?.data) {
        setSections(secRes.value.data || []);
      }
      if (formRes.status === 'fulfilled' && formRes.value?.data) {
        setFeedbackForms(formRes.value.data || []);
      }
      if (locQrRes.status === 'fulfilled' && locQrRes.value?.data) {
        setLocationQrCodes(locQrRes.value.data || []);
      }
    } catch (err: any) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
      setLocationsLoading(false);
      setLocationQrLoading(false);
    }
  }, [currentPage, pageSize, search, statusFilter, locationFilter, floorFilter, sortBy, sortOrder, currentLocation]);

  useEffect(() => {
    if (!Auth.check()) {
      window.location.href = '/login';
      return;
    }
    setSession(Auth.get());
    loadData();
  }, [loadData]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'status') setStatusFilter(value);
    else if (key === 'location') setLocationFilter(value);
    else if (key === 'floor') setFloorFilter(value);
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (qr: QRCode) => {
    setEditingQrCode(qr);
    const isCustom = qr.floor ? !STANDARD_FLOORS.includes(qr.floor) : false;
    setIsCustomFloor(isCustom);
    setFormData({
      name: qr.name,
      description: qr.description || '',
      locationId: String(qr.locationId),
      locationCode: qr.locationCode,
      locationName: qr.locationName,
      sectionId: qr.sectionId || '',
      sectionName: qr.sectionName || '',
      floor: qr.floor || '',
      feedbackFormId: qr.feedbackFormId || '',
      status: qr.status
    });
    setShowCreateModal(true);
  };

  const openPreviewModal = (qr: QRCode) => {
    setPreviewQrCode(qr);
  };

  const openScanHistory = async (qr: QRCode) => {
    setScanHistoryQrCode(qr);
    setScanHistoryLoading(true);
    try {
      const res = await API.getQrCodeScans(qr.qrCodeId, { limit: 100 });
      if (res?.success) setScanHistory(res.data || []);
    } catch (err) {
      console.error('Scan history error:', err);
    } finally {
      setScanHistoryLoading(false);
    }
  };

  const resetForm = () => {
    setEditingQrCode(null);
    setIsCustomFloor(false);
    setFormData({
      name: '',
      description: '',
      locationId: '',
      locationCode: '',
      locationName: '',
      sectionId: '',
      sectionName: '',
      floor: '',
      feedbackFormId: '',
      status: 'active'
    });
    setFormErrors({});
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'sectionId') {
      const sec = sections.find(s => String(s.id) === value);
      setFormData(prev => ({ ...prev, sectionId: value, sectionName: sec ? sec.name : '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'QR Code name is required';
    if (!formData.locationId) errors.locationId = 'Location is required';
    if (!formData.locationCode) errors.locationCode = 'Location code is required';
    if (!formData.locationName) errors.locationName = 'Location name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingQrCode) {
        await API.updateQrCode(editingQrCode.id, formData);
        showToast('QR code updated successfully.', 'success');
      } else {
        await API.createQrCode(formData);
        showToast('QR code generated successfully.', 'success');
      }
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Submit error:', err);
      setFormErrors({ submit: err.message || 'Failed to save QR code' });
      showToast('Unable to save QR code. ' + (err.message || 'Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (qr: QRCode) => {
    if (!window.confirm(`Delete QR Code "${qr.name}" (${qr.qrCodeId})? This action cannot be undone.`)) return;
    try {
      await API.deleteQrCode(qr.id);
      showToast('QR code deleted successfully.', 'success');
      loadData();
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast('Unable to delete QR code: ' + (err.message || 'Server error'), 'error');
    }
  };

  const handleToggleStatus = async (qr: QRCode) => {
    try {
      await API.toggleQrCodeStatus(qr.id);
      showToast(`QR code status updated successfully.`, 'success');
      loadData();
    } catch (err: any) {
      console.error('Toggle status error:', err);
      showToast('Unable to update QR code status: ' + (err.message || 'Server error'), 'error');
    }
  };

  const handleRegenerate = async (qr: QRCode) => {
    try {
      const res = await API.regenerateQrCode(qr.id);
      if (res?.success) {
        showToast('QR code regenerated successfully.', 'success');
        loadData();
        setPreviewQrCode({ ...qr, qrCodeDataUrl: res.data.qrCodeDataUrl, qrCodeSvg: res.data.qrCodeSvg });
      }
    } catch (err: any) {
      console.error('Regenerate error:', err);
      showToast('Unable to regenerate QR code: ' + (err.message || 'Server error'), 'error');
    }
  };

  const handleGenerateLocationQrCodes = async () => {
    setGeneratingQr(true);
    try {
      const res = await API.generateLocationQrCodes();
      if (res?.success) {
        showToast('Location-based QR codes generated successfully.', 'success');
        loadData();
      } else {
        showToast('Failed to generate QR codes: ' + (res?.error || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      console.error('Generate location QR codes error:', err);
      showToast('Unable to generate QR codes: ' + (err.message || 'Server error'), 'error');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('QR code link copied to clipboard.', 'info');
  };

  const handleDownloadPng = (qr: QRCode) => {
    if (!qr.qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qr.qrCodeDataUrl;
    link.download = `${qr.qrCodeId}_${qr.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = (qr: QRCode) => {
    if (!qr.qrCodeSvg) return;
    const blob = new Blob([qr.qrCodeSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${qr.qrCodeId}_${qr.name.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = (qr: QRCode) => {
    if (!qr.qrCodeDataUrl) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code - ${qr.name}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { display: inline-block; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
              img { max-width: 300px; }
              h2 { color: #3D2B1F; margin-bottom: 8px; }
              .meta { color: #6B5D50; font-size: 14px; margin-top: 16px; }
              @media print { body { padding: 0; } .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h2>${qr.name}</h2>
              <img src="${qr.qrCodeDataUrl}" alt="QR Code" />
              <div class="meta">
                <div>QR Code ID: ${qr.qrCodeId}</div>
                <div>Location: ${qr.locationName}</div>
                ${qr.floor ? `<div>Floor: ${qr.floor}</div>` : ''}
                ${qr.sectionName ? `<div>Section: ${qr.sectionName}</div>` : ''}
                <div>Status: ${qr.status}</div>
                <div>URL: ${qr.targetUrl}</div>
              </div>
            </div>
            <script>window.onload = () => window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await API.exportQrCodes({ format: 'csv', status: statusFilter !== 'all' ? statusFilter : undefined, locationId: locationFilter || undefined });
      if (res) {
        const blob = new Blob([res], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `feedback_qr_codes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Feedback QR codes exported successfully.', 'success');
      }
    } catch (err) {
      console.error('Export error:', err);
      showToast('Unable to export QR codes. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const getLocationName = (id: string | number) => {
    const loc = locations.find(l => l.id === Number(id));
    return loc?.locationName || 'Unknown';
  };

  const getSectionName = (id: string) => {
    const sec = sections.find(s => s.id === id);
    return sec?.name || 'Unknown';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const formatFullDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy hh:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <DashboardLayout 
      title="Feedback QR Code Management" 
      subtitle="Create, manage, and track customer feedback QR codes across all locations"
      rightElement={
        <div className="flex items-center gap-2">
          <ActionButton onClick={handleExport} icon={<Download className="w-3.5 h-3.5" />} title="Export CSV">Export</ActionButton>
          <ActionButton onClick={openCreateModal} variant="gold" icon={<Plus className="w-3.5 h-3.5" />}>Create QR Code</ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status & Location Filters — TOP of page */}
        <div className="card-glass p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-wider">
              <Filter className="w-4 h-4 text-accent" />
              <span>Filters</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold text-primary/60 hidden sm:inline">Status:</span>
                <select value={statusFilter} onChange={(e) => handleFilterChange('status', e.target.value)} className="select-modern text-xs font-bold py-2 min-w-[130px]">
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold text-primary/60 hidden sm:inline">Location:</span>
                <select value={locationFilter} onChange={(e) => handleFilterChange('location', e.target.value)} className="select-modern text-xs font-bold py-2 min-w-[160px]">
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={String(loc.id)}>{loc.locationName} ({loc.locationCode})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold text-primary/60 hidden sm:inline">Floor:</span>
                <select value={floorFilter} onChange={(e) => handleFilterChange('floor', e.target.value)} className="select-modern text-xs font-bold py-2 min-w-[140px]">
                  <option value="all">All Floors</option>
                  {STANDARD_FLOORS.map(fl => (
                    <option key={fl} value={fl}>{fl}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <ActionButton onClick={loadData} icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />} title="Refresh all data" variant="secondary" size="sm">Refresh</ActionButton>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total QR Codes" value={stats?.totalQrCodes || 0} icon={QrCode} color="primary" />
          <StatCard title="Active QR Codes" value={stats?.activeQrCodes || 0} subtitle={`${stats?.inactiveQrCodes || 0} inactive`} icon={CircleCheck} color="emerald" />
          <StatCard title="Total Scans" value={stats?.totalScans || 0} icon={ScanLine} color="blue" />
          <StatCard title="Total Feedback" value={stats?.totalFeedback || 0} subtitle={`Today: ${stats?.todayFeedback || 0} • Avg Rating: ${stats?.averageRating || '0.0'}/5`} icon={MessageSquare} color="purple" />
        </div>

        {/* Location-Based QR Codes (3 Cards - One per Store) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
              <QrCode className="w-4 h-4 text-accent" />
              <span>Store Feedback QR Codes</span>
            </h3>
            <div className="flex items-center gap-2">
              <ActionButton 
                onClick={handleGenerateLocationQrCodes} 
                disabled={generatingQr}
                variant="gold" 
                icon={generatingQr ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                className="hidden sm:flex"
              >
                {generatingQr ? 'Generating...' : 'Generate All Location QR Codes'}
              </ActionButton>
              <ActionButton 
                onClick={handleGenerateLocationQrCodes} 
                disabled={generatingQr}
                variant="gold" 
                icon={generatingQr ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                className="sm:hidden"
              >
                {generatingQr ? 'Generating...' : '+ QR'}
              </ActionButton>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayLocationQrCodes.map((locQr, idx) => (
              <LocationQrCard 
                key={locQr.locationCode} 
                locQr={locQr} 
                loading={locationQrLoading}
              />
            ))}
            {/* Show placeholder cards if no data loaded yet */}
            {!locationQrLoading && displayLocationQrCodes.length === 0 && (
              <>
                <LocationQrPlaceholder locationCode="BEL" locationName="Belagavi" storeName="BSC Textiles Belagavi" />
                <LocationQrPlaceholder locationCode="DAV" locationName="Davanagere" storeName="BSC Textiles Davanagere" />
                <LocationQrPlaceholder locationCode="SHI" locationName="Shivamogga" storeName="BSC Textiles Shivamogga" />
              </>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-glass p-5">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-accent" />
              Scans (Last 7 Days)
            </h3>
            {stats?.charts?.scansByDay && stats.charts.scansByDay.some(d => d.scans > 0) ? (
              <div className="h-48 flex items-end justify-center gap-2">
                {stats.charts.scansByDay.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
                    <div 
                      className="w-full bg-accent rounded-t transition-all hover:bg-amber-400" 
                      style={{ height: `${Math.max(4, (day.scans / Math.max(1, ...stats.charts.scansByDay.map(d => d.scans))) * 100)}%` }}
                      title={`${day.date}: ${day.scans} scans`}
                    />
                    <span className="text-[9px] text-primary/60 font-medium mt-1">{day.date.split('-').slice(1).join('-')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                <ScanLine className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-semibold">No scan data for the last 7 days</p>
              </div>
            )}
          </div>
          <div className="card-glass p-5">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-accent" />
              Feedback Received (Last 7 Days)
            </h3>
            {stats?.charts?.feedbackByDay && stats.charts.feedbackByDay.some(d => d.feedback > 0) ? (
              <div className="h-48 flex items-end justify-center gap-2">
                {stats.charts.feedbackByDay.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
                    <div 
                      className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-400" 
                      style={{ height: `${Math.max(4, (day.feedback / Math.max(1, ...stats.charts.feedbackByDay.map(d => d.feedback))) * 100)}%` }}
                      title={`${day.date}: ${day.feedback} feedback`}
                    />
                    <span className="text-[9px] text-primary/60 font-medium mt-1">{day.date.split('-').slice(1).join('-')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs font-semibold">No feedback data for the last 7 days</p>
              </div>
            )}
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="card-glass p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, QR Code ID, or description..."
              value={search}
              onChange={handleSearch}
              className="input-modern pl-9 py-2 text-xs font-semibold"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <ActionButton 
              variant="ghost" 
              size="xs" 
              onClick={() => setViewMode('grid')} 
              title="Grid View"
              className={viewMode === 'grid' ? 'bg-primary text-accent' : ''}
            >
              <Grid className="w-3.5 h-3.5" />
            </ActionButton>
            <ActionButton 
              variant="ghost" 
              size="xs" 
              onClick={() => setViewMode('list')} 
              title="List View"
              className={viewMode === 'list' ? 'bg-primary text-accent' : ''}
            >
              <List className="w-3.5 h-3.5" />
            </ActionButton>
          </div>
        </div>

        {/* QR Codes Table/Grid */}
        <div className="card-glass overflow-hidden">
          {viewMode === 'list' ? (
            <div>
              <div className="p-5 border-b border-accent-soft flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-accent" />
                  <span>QR Codes ({totalItems})</span>
                </h3>
              </div>

              {loading ? (
                <div className="py-12 text-center text-gray-500 font-bold text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                  <span>Loading QR codes...</span>
                </div>
              ) : qrCodes.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-bold text-xs space-y-2">
                  <QrCode className="w-10 h-10 text-gray-300 mx-auto" />
                  <div className="text-sm text-primary font-black">No QR Codes Found</div>
                  <p className="text-gray-400 font-medium">Create your first QR code to start collecting customer feedback.</p>
                  <ActionButton onClick={openCreateModal} variant="gold" className="mt-4" icon={<Plus className="w-3.5 h-3.5" />}>Create QR Code</ActionButton>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-semibold border-collapse">
                    <thead className="bg-primary text-white uppercase text-[10.5px] tracking-wider">
                      <tr>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('qrCodeId')}>QR Code ID {sortBy === 'qrCodeId' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('name')}>Name {sortBy === 'name' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('locationName')}>Location {sortBy === 'locationName' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4">Floor & Section</th>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('status')}>Status {sortBy === 'status' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('scanCount')}>Scans {sortBy === 'scanCount' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4">Feedback</th>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('lastScannedAt')}>Last Scan {sortBy === 'lastScannedAt' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4 cursor-pointer" onClick={() => handleSort('createdAt')}>Created {sortBy === 'createdAt' && (sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />)}</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {qrCodes.map((qr) => (
                        <tr key={qr.id} className="hover:bg-black/5 transition-colors">
                          <td className="p-4">
                            <div className="font-extrabold text-primary font-mono text-[11px]">{qr.qrCodeId}</div>
                            {qr.targetUrl && (
                              <div className="text-[10px] text-gray-500 font-mono truncate max-w-xs mt-0.5" title={qr.targetUrl}>
                                {qr.targetUrl}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-extrabold text-primary">{qr.name}</div>
                            {qr.description && <div className="text-[10px] text-gray-500 truncate max-w-xs mt-0.5">{qr.description}</div>}
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-primary flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-accent" />
                              <span>{qr.locationName}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">{qr.locationCode}</div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-1">
                              {qr.floor && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                                  <Layers className="w-3 h-3 text-amber-600" />
                                  <span>{qr.floor}</span>
                                </span>
                              )}
                              {qr.sectionName ? (
                                <div className="font-medium text-primary flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-accent" />
                                  <span>{qr.sectionName}</span>
                                </div>
                              ) : !qr.floor && (
                                <span className="text-[10px] text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4"><StatusBadge status={qr.status} /></td>
                          <td className="p-4 font-extrabold text-primary">{qr.scanCount}</td>
                          <td className="p-4">
                            <div className="font-extrabold text-emerald-600">{qr.feedbackCount}</div>
                            <div className="text-[10px] text-gray-500">{qr.scansWithFeedback} converted</div>
                          </td>
                          <td className="p-4 text-gray-600">{formatDate(qr.lastScannedAt)}</td>
                          <td className="p-4 text-gray-600">{formatFullDate(qr.createdAt)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <ActionButton onClick={() => handleCopyUrl(qr.targetUrl)} variant="ghost" size="xs" icon={<Copy className="w-3 h-3" />} title="Copy URL" />
                              <ActionButton onClick={() => openPreviewModal(qr)} variant="ghost" size="xs" icon={<Eye className="w-3 h-3" />} title="Preview QR" />
                              <ActionButton onClick={() => handleDownloadPng(qr)} variant="ghost" size="xs" icon={<Image className="w-3 h-3" />} title="Download PNG" />
                              <ActionButton onClick={() => handleDownloadSvg(qr)} variant="ghost" size="xs" icon={<FileTextIcon className="w-3 h-3" />} title="Download SVG" />
                              <ActionButton onClick={() => handlePrint(qr)} variant="ghost" size="xs" icon={<Printer className="w-3 h-3" />} title="Print QR" />
                              <ActionButton onClick={() => openScanHistory(qr)} variant="ghost" size="xs" icon={<History className="w-3 h-3" />} title="Scan History" />
                              <ActionButton onClick={() => handleRegenerate(qr)} variant="ghost" size="xs" icon={<RotateCcw className="w-3 h-3" />} title="Regenerate QR" />
                              <ActionButton onClick={() => handleToggleStatus(qr)} variant="ghost" size="xs" icon={qr.status === 'active' ? <CircleX className="w-3 h-3" /> : <CircleCheck className="w-3 h-3" />} title={qr.status === 'active' ? 'Deactivate' : 'Activate'} />
                              <ActionButton onClick={() => openEditModal(qr)} variant="ghost" size="xs" icon={<Edit className="w-3 h-3" />} title="Edit" />
                              <ActionButton onClick={() => handleDelete(qr)} variant="danger" size="xs" icon={<Trash2 className="w-3 h-3" />} title="Delete" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-accent-soft flex items-center justify-between">
                  <span className="text-xs text-primary font-semibold">Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}</span>
                  <div className="flex items-center gap-1">
                    <ActionButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="ghost" size="xs" icon={<ChevronLeft className="w-3.5 h-3.5" />} />
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <ActionButton 
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          variant={currentPage === pageNum ? 'primary' : 'ghost'}
                          size="xs"
                          className="w-8 h-8"
                        >
                          {pageNum}
                        </ActionButton>
                      );
                    })}
                    <ActionButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="ghost" size="xs" icon={<ChevronRight className="w-3.5 h-3.5" />} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {qrCodes.map((qr) => (
                  <div key={qr.id} className="card-glass p-4 space-y-3 border border-accent-soft hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-primary text-sm truncate">{qr.name}</div>
                        <div className="text-[10px] font-mono text-accent font-black mt-0.5">{qr.qrCodeId}</div>
                      </div>
                      <StatusBadge status={qr.status} />
                    </div>
                    <div className="space-y-1 text-[11px] text-gray-600">
                      <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-accent" /><span>{qr.locationName}</span></div>
                      {qr.floor && <div className="flex items-center gap-1.5"><Layers className="w-3 h-3 text-amber-600" /><span className="font-bold text-amber-900">{qr.floor}</span></div>}
                      {qr.sectionName && <div className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-accent" /><span>{qr.sectionName}</span></div>}
                      <div className="flex items-center gap-1.5"><ScanLine className="w-3 h-3 text-accent" /><span>{qr.scanCount} scans</span></div>
                      <div className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3 text-emerald-600" /><span>{qr.feedbackCount} feedback</span></div>
                      <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-gray-400" /><span>Last: {formatDate(qr.lastScannedAt)}</span></div>
                    </div>
                    {qr.qrCodeDataUrl && (
                      <div className="p-2 bg-white rounded-xl border border-accent-soft text-center">
                        <img src={qr.qrCodeDataUrl} alt={`QR Code ${qr.qrCodeId}`} className="w-32 h-32 mx-auto" />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-accent-soft">
                      <ActionButton onClick={() => openPreviewModal(qr)} variant="ghost" size="xs" icon={<Eye className="w-3 h-3" />} className="flex-1 min-w-0" title="Preview" />
                      <ActionButton onClick={() => handleDownloadPng(qr)} variant="ghost" size="xs" icon={<Image className="w-3 h-3" />} className="flex-1 min-w-0" title="PNG" />
                      <ActionButton onClick={() => handleDownloadSvg(qr)} variant="ghost" size="xs" icon={<FileTextIcon className="w-3 h-3" />} className="flex-1 min-w-0" title="SVG" />
                      <ActionButton onClick={() => openEditModal(qr)} variant="ghost" size="xs" icon={<Edit className="w-3 h-3" />} className="flex-1 min-w-0" title="Edit" />
                      <ActionButton onClick={() => handleToggleStatus(qr)} variant="ghost" size="xs" icon={qr.status === 'active' ? <CircleX className="w-3 h-3" /> : <CircleCheck className="w-3 h-3" />} className="flex-1 min-w-0" title={qr.status === 'active' ? 'Deactivate' : 'Activate'} />
                      <ActionButton onClick={() => handleDelete(qr)} variant="danger" size="xs" icon={<Trash2 className="w-3 h-3" />} className="flex-1 min-w-0" title="Delete" />
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="p-4 border-t border-accent-soft flex items-center justify-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <ActionButton 
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        variant={currentPage === pageNum ? 'primary' : 'ghost'}
                        size="xs"
                        className="w-8 h-8"
                      >
                        {pageNum}
                      </ActionButton>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="card-glass max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary">
              <div className="p-6 border-b border-accent-soft flex items-center justify-between">
                <h3 className="text-lg font-black text-primary flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-accent" />
                  <span>{editingQrCode ? 'Edit QR Code' : 'Create New QR Code'}</span>
                </h3>
                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="p-6 space-y-5">
                {formErrors.submit && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{formErrors.submit}</div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">QR Code Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g., Main Entrance Feedback, POS Counter 1, Ladies Section"
                    className={`input-modern text-xs font-semibold py-2 ${formErrors.name ? 'border-rose-400' : ''}`}
                  />
                  {formErrors.name && <p className="text-[10px] text-rose-600 font-medium">{formErrors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    rows={2}
                    placeholder="Optional description for internal reference"
                    className="input-modern text-xs font-medium py-2"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-primary">Location *</label>
                    <select
                      name="locationId"
                      value={formData.locationId}
                      onChange={(e) => {
                        const loc = locations.find(l => String(l.id) === e.target.value);
                        handleFormChange(e);
                        if (loc) {
                          setFormData(prev => ({ ...prev, locationCode: loc.locationCode, locationName: loc.locationName }));
                        }
                      }}
                      disabled={locationsLoading}
                      className={`select-modern text-xs font-bold py-2 ${formErrors.locationId ? 'border-rose-400' : ''}`}
                    >
                      <option value="">
                        {locationsLoading ? 'Loading locations...' : locations.length === 0 ? 'No active locations found' : 'Select Location'}
                      </option>
                      {!locationsLoading && locations.length > 0 && locations.map(loc => (
                        <option key={loc.id} value={String(loc.id)}>{loc.locationName} ({loc.locationCode})</option>
                      ))}
                    </select>
                    {formErrors.locationId && <p className="text-[10px] text-rose-600 font-medium">{formErrors.locationId}</p>}
                    {!locationsLoading && locations.length === 0 && (
                      <p className="text-[10px] text-amber-600 font-medium">No active locations available. Please contact administrator.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-primary">Location Code *</label>
                    <input
                      type="text"
                      name="locationCode"
                      value={formData.locationCode}
                      onChange={handleFormChange}
                      readOnly
                      className="input-modern text-xs font-semibold py-2 bg-gray-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-primary">Location Name *</label>
                    <input
                      type="text"
                      name="locationName"
                      value={formData.locationName}
                      onChange={handleFormChange}
                      readOnly
                      className="input-modern text-xs font-semibold py-2 bg-gray-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-primary">Floor (Floor-wise placement)</label>
                    {!isCustomFloor ? (
                      <select
                        name="floor"
                        value={formData.floor}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomFloor(true);
                            setFormData(prev => ({ ...prev, floor: '' }));
                          } else {
                            handleFormChange(e);
                          }
                        }}
                        className="select-modern text-xs font-bold py-2"
                      >
                        <option value="">Select Floor (Optional)</option>
                        {STANDARD_FLOORS.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                        <option value="__custom__">+ Enter Custom Floor...</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          name="floor"
                          value={formData.floor}
                          onChange={handleFormChange}
                          placeholder="e.g. 5th Floor, Rooftop"
                          className="input-modern text-xs font-bold py-2 flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => { setIsCustomFloor(false); setFormData(prev => ({ ...prev, floor: '' })); }}
                          className="px-2 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl"
                          title="Back to standard floor list"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-primary">Section/Department</label>
                    <select
                      name="sectionId"
                      value={formData.sectionId}
                      onChange={handleFormChange}
                      className="select-modern text-xs font-bold py-2"
                    >
                      <option value="">Select Section (Optional)</option>
                      {sections.map(sec => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-primary">Feedback Form</label>
                    <select
                      name="feedbackFormId"
                      value={formData.feedbackFormId}
                      onChange={handleFormChange}
                      className="select-modern text-xs font-bold py-2"
                    >
                      <option value="">Default Form</option>
                      {feedbackForms.map(form => (
                        <option key={form.id} value={form.id}>{form.name} ({form.formId})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="select-modern text-xs font-bold py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-accent-soft">
                  <ActionButton type="button" onClick={() => { setShowCreateModal(false); resetForm(); }} variant="secondary">Cancel</ActionButton>
                  <ActionButton type="submit" disabled={saving} variant="gold" icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>
                    {saving ? 'Saving...' : (editingQrCode ? 'Update QR Code' : 'Create QR Code')}
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {previewQrCode && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="card-glass max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary">
              <div className="p-6 border-b border-accent-soft flex items-center justify-between">
                <h3 className="text-lg font-black text-primary flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-accent" />
                  <span>QR Code Preview</span>
                </h3>
                <button onClick={() => setPreviewQrCode(null)} className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 space-y-5 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-accent text-[10px] font-black uppercase tracking-widest">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{previewQrCode.locationName}</span>
                </div>

                <h4 className="text-lg font-black text-primary">{previewQrCode.name}</h4>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {previewQrCode.floor && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                      <Layers className="w-3.5 h-3.5 text-amber-700" />
                      <span>{previewQrCode.floor}</span>
                    </span>
                  )}
                  {previewQrCode.sectionName && (
                    <div className="text-sm text-primary flex items-center justify-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> {previewQrCode.sectionName}
                    </div>
                  )}
                </div>

                <div className="p-6 bg-white rounded-2xl shadow-xl border border-gray-200 inline-block">
                  {previewQrCode.qrCodeDataUrl ? (
                    <img src={previewQrCode.qrCodeDataUrl} alt={`QR Code ${previewQrCode.qrCodeId}`} className="w-64 h-64 object-contain mx-auto" />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-gray-400">QR Code not generated</div>
                  )}
                  <div className="mt-4 font-black text-xs text-primary uppercase tracking-wider">BSC EXCLUSIVE</div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-2 bg-background p-3 rounded-xl border max-w-md mx-auto">
                    <ExternalLink className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      readOnly
                      value={previewQrCode.targetUrl}
                      className="bg-transparent text-xs font-bold text-gray-700 flex-1 outline-none truncate"
                    />
                    <ActionButton onClick={() => handleCopyUrl(previewQrCode.targetUrl)} variant="ghost" size="xs" icon={<Copy className="w-3.5 h-3.5" />} title="Copy URL">Copy</ActionButton>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <ActionButton onClick={() => handleDownloadPng(previewQrCode)} variant="secondary" icon={<Image className="w-3.5 h-3.5" />} title="Download PNG">Download PNG</ActionButton>
                    <ActionButton onClick={() => handleDownloadSvg(previewQrCode)} variant="secondary" icon={<FileTextIcon className="w-3.5 h-3.5" />} title="Download SVG">Download SVG</ActionButton>
                    <ActionButton onClick={() => handlePrint(previewQrCode)} variant="secondary" icon={<Printer className="w-3.5 h-3.5" />} title="Print QR">Print</ActionButton>
                    <ActionButton onClick={() => handleRegenerate(previewQrCode)} variant="ghost" icon={<RotateCcw className="w-3.5 h-3.5" />} title="Regenerate">Regenerate</ActionButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scan History Modal */}
        {scanHistoryQrCode && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="card-glass max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary">
              <div className="p-6 border-b border-accent-soft flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-primary flex items-center gap-2">
                    <History className="w-5 h-5 text-accent" />
                    <span>Scan History</span>
                  </h3>
                  <p className="text-sm text-primary mt-0.5">{scanHistoryQrCode.name} ({scanHistoryQrCode.qrCodeId})</p>
                </div>
                <button onClick={() => setScanHistoryQrCode(null)} className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6">
                {scanHistoryLoading ? (
                  <div className="py-12 text-center text-gray-500 font-bold text-xs flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span>Loading scan history...</span>
                  </div>
                ) : scanHistory.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-bold text-xs space-y-2">
                    <ScanLine className="w-10 h-10 text-gray-300 mx-auto" />
                    <div className="text-sm text-primary font-black">No Scans Recorded</div>
                    <p className="text-gray-400 font-medium">This QR code has not been scanned yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-semibold border-collapse">
                    <thead className="bg-primary text-white uppercase text-[10.5px] tracking-wider">
                        <tr>
                          <th className="p-3">Scan Time</th>
                          <th className="p-3">Device</th>
                          <th className="p-3">Browser / OS</th>
                          <th className="p-3">Location</th>
                          <th className="p-3">Feedback</th>
                          <th className="p-3">Referrer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {scanHistory.map((scan) => (
                          <tr key={scan.id} className="hover:bg-black/5 transition-colors">
                            <td className="p-3 text-gray-600">{formatFullDate(scan.scannedAt)}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 capitalize">{scan.deviceType}</span>
                            </td>
                            <td className="p-3 text-gray-600">{scan.browser} / {scan.os}</td>
                            <td className="p-3 text-gray-600">{scan.city || 'Unknown'}, {scan.country || 'Unknown'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${scan.isFeedbackSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                                {scan.isFeedbackSubmitted ? 'Submitted' : 'No Feedback'}
                              </span>
                            </td>
                            <td className="p-3 text-[10px] text-gray-500 truncate max-w-xs">{scan.referrer || 'Direct'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}