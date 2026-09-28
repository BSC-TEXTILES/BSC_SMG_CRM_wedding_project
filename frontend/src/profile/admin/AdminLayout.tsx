import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useProfileTheme } from '../themeContext';
import { LayoutDashboard, User, Info, Briefcase, Sparkles, Layers, FolderGit2, Award, MessageSquareQuote, Image, Inbox, Share2, Settings, History, LogOut, Menu, X, ExternalLink, Sun, Moon } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const SIDEBAR_NAV = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Profile', href: '/admin/profile', icon: User },
  { label: 'About & Story', href: '/admin/about', icon: Info },
  { label: 'Experience', href: '/admin/experience', icon: Briefcase },
  { label: 'Skills', href: '/admin/skills', icon: Sparkles },
  { label: 'Services', href: '/admin/services', icon: Layers },
  { label: 'Projects & Portfolio', href: '/admin/projects', icon: FolderGit2 },
  { label: 'Achievements', href: '/admin/achievements', icon: Award },
  { label: 'Testimonials', href: '/admin/testimonials', icon: MessageSquareQuote },
  { label: 'Media Gallery', href: '/admin/gallery', icon: Image },
  { label: 'Contact Messages', href: '/admin/messages', icon: Inbox },
  { label: 'Social Channels', href: '/admin/social-links', icon: Share2 },
  { label: 'SEO & Settings', href: '/admin/settings', icon: Settings },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: History }
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  subtitle,
  actions
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useProfileTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string; full_name?: string } | null>(null);

  useEffect(() => {
    // Read user from localStorage / sessionStorage
    try {
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      } else {
        setUser({ username: 'admin@bsctextiles.com', role: 'Admin', full_name: 'Administrator' });
      }
    } catch {
      setUser({ username: 'admin', role: 'Admin', full_name: 'Administrator' });
    }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    } catch {}
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-[var(--pf-bg)] text-[var(--pf-text-main)] overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--pf-bg-card)] border-r border-[var(--pf-border)] flex flex-col justify-between transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Top: Logo & Exit to Site */}
          <div className="p-4 border-b border-[var(--pf-border)] flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--pf-burgundy)] text-white font-serif font-bold text-sm flex items-center justify-center">
                B
              </div>
              <div>
                <span className="font-serif text-sm font-bold block text-[var(--pf-text-main)]">BSC Textiles</span>
                <span className="text-[9px] uppercase tracking-wider text-[var(--pf-gold)] font-bold">Admin Console</span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg border border-[var(--pf-border)] text-[var(--pf-text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
            {SIDEBAR_NAV.map(item => {
              const active = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium transition-all ${
                    active
                      ? 'bg-[var(--pf-burgundy)] text-white font-bold shadow-xs'
                      : 'text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)] hover:text-[var(--pf-text-main)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-[var(--pf-gold)]'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Public Site Link */}
          <div className="p-3 border-t border-[var(--pf-border)] bg-[var(--pf-bg-alt)] space-y-2 text-xs">
            <div className="flex items-center justify-between px-2">
              <div className="truncate">
                <p className="font-bold text-[var(--pf-text-main)] truncate">{user?.full_name || 'Admin User'}</p>
                <span className="text-[10px] text-[var(--pf-gold)] uppercase font-semibold">{user?.role || 'Admin'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <Link
              to="/"
              target="_blank"
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg-card)] hover:border-[var(--pf-gold)] text-[11px] font-semibold text-[var(--pf-text-main)] transition-colors"
            >
              <span>View Public Website</span>
              <ExternalLink className="w-3 h-3 text-[var(--pf-gold)]" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[var(--pf-border)] bg-[var(--pf-bg-card)] px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-[var(--pf-border)] text-[var(--pf-text-main)] hover:bg-[var(--pf-bg-alt)]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-base sm:text-lg font-bold text-[var(--pf-text-main)] leading-tight">
                {title}
              </h1>
              {subtitle && <p className="text-[10px] sm:text-xs text-[var(--pf-text-muted)]">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)] transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--pf-bg)]">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
