import { Fragment, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, History } from 'lucide-react';
import type { VmStepDescriptor, VmStepKey } from './vmFlowUtils';

interface StepIndicatorProps {
  steps: VmStepDescriptor[];
  current: VmStepKey;
  /** Completed steps stay clickable so the auditor can go back and edit an answer. */
  isDone: (key: VmStepKey) => boolean;
  /** Reachable right now — e.g. Photos needs an open draft. */
  isOpenable: (key: VmStepKey) => boolean;
  onSelect: (key: VmStepKey) => void;
  onBack: () => void;
  canGoBack: boolean;
  /** Extra controls pinned to the right of the strip (save state, history…). */
  trailing?: ReactNode;
}

/**
 * Sticky step rail for the guided VM audit.
 *
 * Sticky inside `main`, which is the page's scroll container, so the auditor always
 * knows where they are in the flow while the step body scrolls under it. Phones get
 * numbered pills (labels appear from `sm`) so the rail never needs its own scrollbar
 * unless there genuinely is not room.
 */
export default function StepIndicator({
  steps,
  current,
  isDone,
  isOpenable,
  onSelect,
  onBack,
  canGoBack,
  trailing
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  const active = currentIndex >= 0 ? steps[currentIndex] : null;

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2.5 bg-[#FFFDFC]/95 backdrop-blur-xs border-b border-[#E8D9D4] shadow-xs">
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-[#E8D9D4] bg-white text-[#4A173A] text-[12px] font-bold hover:bg-[#FFF7F2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Go back one step"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#B76E79]" />
          <span>Back</span>
        </button>

        <ol className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 overflow-x-auto overscroll-x-contain py-0.5">
          {steps.map((descriptor, index) => {
            const isCurrent = descriptor.key === current;
            const done = isDone(descriptor.key);
            const clickable = !isCurrent && isOpenable(descriptor.key);
            const number = index + 1;

            return (
              <Fragment key={descriptor.key}>
                {index > 0 && (
                  <li aria-hidden className="shrink-0 w-3 sm:w-5 flex justify-center text-[#E8D9D4]">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </li>
                )}
                <li className="shrink-0">
                  <button
                    type="button"
                    onClick={() => clickable && onSelect(descriptor.key)}
                    disabled={!clickable}
                    aria-current={isCurrent ? 'step' : undefined}
                    title={`${number}. ${descriptor.caption}`}
                    className={`group inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-all ${
                      isCurrent
                        ? 'bg-[#4A173A] text-white border-[#4A173A] shadow-xs cursor-default'
                        : clickable
                          ? 'bg-[#FFFDFC] text-[#4A173A] border-[#E8D9D4] hover:border-[#B76E79] hover:bg-[#FFF7F2] cursor-pointer'
                          : 'bg-[#FFF7F2] text-[#6F5963]/70 border-[#E8D9D4]/70 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${
                        isCurrent
                          ? 'bg-[#E8C7A8] text-[#4A173A]'
                          : done
                            ? 'bg-[#198754] text-white'
                            : 'bg-white text-[#6F5963] border border-[#E8D9D4]'
                      }`}
                    >
                      {done && !isCurrent ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : number}
                    </span>
                    <span className="hidden xs:flex flex-col leading-tight min-w-0">
                      <span className="text-[12px] font-black whitespace-nowrap">{descriptor.label}</span>
                      <span
                        className={`hidden lg:block text-[11px] font-semibold whitespace-nowrap ${
                          isCurrent ? 'text-[#E8D9D4]' : 'text-[#6F5963]'
                        }`}
                      >
                        {descriptor.caption}
                      </span>
                    </span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ol>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {trailing}
          <button
            type="button"
            onClick={() => onSelect('history')}
            className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl border text-[12px] font-bold transition-colors cursor-pointer ${
              current === 'history'
                ? 'bg-[#4A173A] text-white border-[#4A173A]'
                : 'bg-white text-[#4A173A] border-[#E8D9D4] hover:border-[#B76E79] hover:bg-[#FFF7F2]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#B76E79]" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6F5963] xs:hidden">
        {currentIndex >= 0 && active
          ? `Step ${currentIndex + 1} of ${steps.length} — ${active.label}: ${active.caption}`
          : 'Audit history — saved records and areas requiring attention'}
      </p>
    </div>
  );
}
