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
    navy: { iconBg: 'bg-primary/10 text-primary', border: 'border-l-4 border-l-primary' },
    gold: { iconBg: 'bg-accent/15 text-accent-dark', border: 'border-l-4 border-l-accent' },
    emerald: { iconBg: 'bg-status-success/10 text-status-success', border: 'border-l-4 border-l-status-success' },
    teal: { iconBg: 'bg-status-success/10 text-status-success', border: 'border-l-4 border-l-status-success' },
    amber: { iconBg: 'bg-status-warning/10 text-status-warning', border: 'border-l-4 border-l-status-warning' },
    indigo: { iconBg: 'bg-status-info/10 text-status-info', border: 'border-l-4 border-l-status-info' },
    rose: { iconBg: 'bg-status-danger/10 text-status-danger', border: 'border-l-4 border-l-status-danger' }
  };

  const style = colorStyles[color] || colorStyles.navy;

  return (
    <div
      onClick={onClick}
      className={`
        card-glass card-glass-hover p-5 flex flex-col justify-between transition-all duration-200 border border-border bg-card rounded-2xl
        ${style.border} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary block mb-1">
            {title}
          </span>
          <div className="text-2xl lg:text-3xl font-black text-text-primary tracking-tight">
            {value}
          </div>
        </div>

        <div className={`p-3 rounded-2xl ${style.iconBg} shadow-xs flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between text-xs">
          {subtext && <span className="text-text-secondary font-medium">{subtext}</span>}
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
