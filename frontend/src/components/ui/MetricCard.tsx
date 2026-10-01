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
    navy: { iconBg: 'bg-[#123C35]/10 text-[#123C35]', border: 'border-l-4 border-l-[#123C35]' },
    gold: { iconBg: 'bg-[#C9A45C]/15 text-[#C9A45C]', border: 'border-l-4 border-l-[#C9A45C]' },
    emerald: { iconBg: 'bg-[#E5F4EE] text-[#16805C]', border: 'border-l-4 border-l-[#16805C]' },
    teal: { iconBg: 'bg-[#E5F4EE] text-[#16805C]', border: 'border-l-4 border-l-[#16805C]' },
    amber: { iconBg: 'bg-[#FEF7E6] text-[#C58A16]', border: 'border-l-4 border-l-[#C58A16]' },
    indigo: { iconBg: 'bg-[#EBF1FB] text-[#2864C7]', border: 'border-l-4 border-l-[#2864C7]' },
    rose: { iconBg: 'bg-[#FCECEE] text-[#C83B4A]', border: 'border-l-4 border-l-[#C83B4A]' }
  };

  const style = colorStyles[color] || colorStyles.navy;

  return (
    <div
      onClick={onClick}
      className={`
        card-glass card-glass-hover p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 border border-[#E1DDD3] bg-[#FFFFFF] rounded-2xl h-full min-w-0 shadow-xs
        ${style.border} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#65716C] block mb-1 truncate">
            {title}
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-[#123C35] tracking-tight truncate">
            {value}
          </div>
        </div>

        <div className={`p-2.5 sm:p-3 rounded-xl ${style.iconBg} shadow-2xs flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 pt-3 border-t border-[#E1DDD3] flex items-center justify-between text-xs">
          {subtext && <span className="text-[#65716C] font-medium">{subtext}</span>}
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
