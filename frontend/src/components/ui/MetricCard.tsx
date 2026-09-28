import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'navy' | 'gold' | 'emerald' | 'teal' | 'amber' | 'indigo' | 'rose';
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendUp,
  color = 'navy',
  onClick
}: MetricCardProps) {
  const colorStyles = {
    navy: { iconBg: 'bg-[#4A173A]/10 text-[#4A173A]', border: 'border-l-4 border-l-[#4A173A]' },
    gold: { iconBg: 'bg-[#B76E79]/15 text-[#B76E79]', border: 'border-l-4 border-l-[#B76E79]' },
    emerald: { iconBg: 'bg-[#E8F5EE] text-[#198754]', border: 'border-l-4 border-l-[#198754]' },
    teal: { iconBg: 'bg-[#E8F5EE] text-[#198754]', border: 'border-l-4 border-l-[#198754]' },
    amber: { iconBg: 'bg-[#FFF4D6] text-[#C58A18]', border: 'border-l-4 border-l-[#C58A18]' },
    indigo: { iconBg: 'bg-[#EAF1FA] text-[#356AE6]', border: 'border-l-4 border-l-[#356AE6]' },
    rose: { iconBg: 'bg-[#FDE8E7] text-[#B42318]', border: 'border-l-4 border-l-[#B42318]' }
  };

  const style = colorStyles[color] || colorStyles.navy;

  return (
    <div
      onClick={onClick}
      className={`
        card-glass card-glass-hover p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 border border-[#E8D9D4] bg-[#FFFDFC] rounded-2xl h-full min-w-0 shadow-xs
        ${style.border} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#6F5963] block mb-1 truncate">
            {title}
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#4A173A] tracking-tight truncate">
            {value}
          </div>
        </div>

        <div className={`p-2.5 sm:p-3 rounded-xl ${style.iconBg} shadow-2xs flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 pt-3 border-t border-[#EADBD7] flex items-center justify-between text-xs">
          {subtext && <span className="text-[#6F5963] font-medium">{subtext}</span>}
          {trend && (
            <span className={`font-bold flex items-center gap-0.5 ${trendUp ? 'text-status-success' : 'text-status-warning'}`}>
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
