import React, { useState } from 'react';
import { Filter, X, ChevronDown, RefreshCw } from 'lucide-react';

interface FilterBarProps {
  children: React.ReactNode;
  onClear?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  activeFilterCount?: number;
  className?: string;
}

export default function FilterBar({
  children,
  onClear,
  onRefresh,
  isRefreshing = false,
  activeFilterCount = 0,
  className = ''
}: FilterBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <div className={`bg-[#FFFDFC] rounded-2xl border border-[#E8D9D4] shadow-xs p-3.5 sm:p-4 transition-all ${className}`}>
      {/* Mobile Header with Quick Toggle */}
      <div className="flex sm:hidden items-center justify-between gap-2 pb-2 border-b border-[#E8D9D4]">
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-[#4A173A]"
        >
          <Filter className="w-3.5 h-3.5 text-[#B76E79]" />
          <span>Filters & Search</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#4A173A] text-white text-[10px] font-black">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#6F5963] transition-transform ${
              mobileExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2]"
              title="Refresh results"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#B76E79]' : ''}`} />
            </button>
          )}
          {onClear && activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-bold text-[#B42318] hover:underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filters Content: visible always on sm+, toggled on mobile */}
      <div className={`mt-2 sm:mt-0 ${mobileExpanded ? 'block' : 'hidden sm:block'}`}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          {children}

          {(onClear || onRefresh) && (
            <div className="hidden sm:flex items-center gap-2 ml-auto pt-1 sm:pt-0">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-2 rounded-xl text-[#6F5963] hover:text-[#4A173A] hover:bg-[#FFF7F2] border border-[#E8D9D4] transition-all cursor-pointer"
                  title="Refresh results"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#B76E79]' : ''}`} />
                </button>
              )}
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-[#6F5963] hover:text-[#B42318] hover:bg-[#FDE8E7] border border-[#E8D9D4] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
