
import { Counter, Reveal } from '../motion/Reveal';

export interface StatsData {
  totalStores: number;
  totalCustomers: number;
  totalFeedback: number;
  csatRating: number;
}

interface StatsProps {
  stats: StatsData;
  loading: boolean;
}

export default function Stats({ stats, loading }: StatsProps) {
  const items = [
    {
      value: stats.totalStores || 3,
      suffix: '',
      label: 'Flagship floors',
      note: 'Belagavi · Davanagere · Shivamogga'
    },
    {
      value: new Date().getFullYear() - 1938,
      suffix: '',
      label: 'Years at the counter',
      note: 'Fourth generation, same address'
    },
    {
      value: stats.csatRating || 99,
      suffix: '%',
      label: 'Positive feedback',
      note:
        stats.totalFeedback > 0
          ? `${stats.totalFeedback.toLocaleString('en-IN')} verified slips on file`
          : 'A slip filled after every visit'
    },
    {
      value: stats.totalCustomers,
      suffix: '',
      label: 'Wedding lists on file',
      note: loading ? 'Counted live from the bridal desk' : 'Kept by name, not by number'
    }
  ];

  return (
    <section className="sec sec--ink-2 on-ink" style={{ paddingTop: 'clamp(52px, 7vh, 92px)', paddingBottom: 'clamp(52px, 7vh, 92px)' }}>
      <div className="wrap">
        <Reveal as="h2" variant="up" className="sr-only">
          BSC Textiles at a glance
        </Reveal>
        <dl className="stats">
          {items.map((item, i) => (
            <Reveal as="div" key={item.label} className="stat" variant="up" delay={i * 90}>
              <dt className="stat__label">{item.label}</dt>
              <dd>
                <span className="t-num stat__value">
                  <Counter value={item.value} suffix={item.suffix} />
                </span>
              </dd>
              <p className="stat__note">{item.note}</p>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
