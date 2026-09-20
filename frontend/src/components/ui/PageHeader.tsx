import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  section?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export default function PageHeader({
  section,
  title,
  description,
  icon: Icon,
  actions
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        {section && (
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#C9A45C] mb-1">
            {section}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl font-black text-[#182033] tracking-tight flex items-center gap-2.5">
          {Icon && <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#C9A45C]" />}
          <span>{title}</span>
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#687080] font-medium mt-1">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
