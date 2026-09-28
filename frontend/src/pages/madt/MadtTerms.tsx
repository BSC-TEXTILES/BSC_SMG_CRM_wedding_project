import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MadtLayout from './MadtLayout';

export default function MadtTerms() {
  useEffect(() => {
    document.title = 'Terms — MADT';
  }, []);

  return (
    <MadtLayout page="terms">
      <main id="main" className="subpage">
        <div className="wrap narrow">
          <p className="kicker">MADT</p>
          <h1>Terms</h1>
          <p>
            This site describes the house and takes visit notes. A reference number is a note for the desk.
            It is not a confirmed booking, a reserved bale, or a price.
          </p>
          <p>
            Prices are on the floor. Photographs show the kind of cloth and the rooms.
            They are not a promise that a pictured garment is in stock.
          </p>
          <p>
            Maps open the road, not a pinned door. Ask for BSC Textiles when you arrive.
          </p>
          <p>
            Use the site lawfully. Do not send notes you do not mean the desk to read.
          </p>
          <p>
            <Link to="/madt">Back to the house</Link>
          </p>
        </div>
      </main>
    </MadtLayout>
  );
}
