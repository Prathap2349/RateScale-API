import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlaySquare,
  Sliders,
  Activity,
  Sparkles,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Brain,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Simulations', path: '/simulations', icon: PlaySquare },
    { label: 'Traffic Configurations', path: '/traffic-configurations', icon: Sliders },
    { label: 'Policy Sandbox', path: '/sandbox', icon: Sliders },
    { label: 'AI Playground', path: '/ai-playground', icon: Brain },
    { label: 'Live Telemetry', path: '/live-telemetry', icon: Activity },
    { label: 'Recommendations', path: '/recommendations', icon: Sparkles },
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 z-40 h-screen bg-[var(--bg-main)] border-r border-[var(--border-color)] flex flex-col transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header / Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-card-subtle)] text-zinc-100 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-[var(--border-color)]">
              <Shield className="w-4 h-4 text-blue-500" />
            </div>
            {!collapsed && (
              <div className="flex flex-col whitespace-nowrap">
                <span className="font-bold text-xs text-zinc-100 tracking-tight">RateScale</span>
                <span className="text-[10px] text-zinc-500 font-mono">v2.4 Production</span>
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[var(--bg-card)] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--bg-card)] text-white font-bold border border-[var(--border-color)] shadow-[0_0_15px_rgba(59,130,246,0.03)]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-[var(--bg-card-subtle)]'
                  }`
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                        isActive
                          ? 'text-blue-500'
                          : 'text-zinc-500'
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Footer / Logout */}
        <div className="p-3 border-t border-[var(--border-color)] space-y-2">
          {!collapsed && user && (
            <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-zinc-100 text-zinc-950 font-bold text-xs flex items-center justify-center shrink-0">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-100 truncate">
                  {user.fullName || 'User'}
                </span>
                <span className="text-[10px] text-zinc-400 truncate">{user.email}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
