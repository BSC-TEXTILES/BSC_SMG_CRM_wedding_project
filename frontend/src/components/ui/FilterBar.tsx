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
    <div className={`bg-white rounded-2xl border border-[#DFDDD7] shadow-xs p-3.5 sm:p-4 transition-all ${className}`}>
      {/* Mobile Header with Quick Toggle */}
      <div className="flex sm:hidden items-center justify-between gap-2 pb-2 border-b border-[#DFDDD7]">
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-[#182033]"
        >
          <Filter className="w-3.5 h-3.5 text-[#C9A45C]" />
          <span>Filters & Search</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#101C36] text-[#C9A45C] text-[10px] font-black">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#687080] transition-transform ${
              mobileExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-[#687080] hover:text-[#182033] hover:bg-[#F6F4EF]"
              title="Refresh results"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C9A45C]' : ''}`} />
            </button>
          )}
          {onClear && activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-bold text-[#C7374A] hover:underline px-1"
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
                  className="p-2 rounded-xl text-[#687080] hover:text-[#182033] hover:bg-[#F6F4EF] border border-[#DFDDD7] transition-all"
                  title="Refresh results"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#C9A45C]' : ''}`} />
                </button>
              )}
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-[#687080] hover:text-[#C7374A] hover:bg-[#FDEBED] border border-[#DFDDD7] transition-all flex items-center gap-1.5"
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
