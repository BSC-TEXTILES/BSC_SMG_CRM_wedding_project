
import { TICKER } from '../content';

export default function Ticker() {
  const group = (
    <div className="ticker__group" aria-hidden="true">
      {TICKER.map((item) => (
        <span className="ticker__item" key={item}>
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className="ticker" data-lenis-prevent aria-hidden="true">
      <div className="ticker__track">
        {group}
        {group}
      </div>
    </div>
  );
}
