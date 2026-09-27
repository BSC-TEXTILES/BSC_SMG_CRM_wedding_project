import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MadtLayout from './MadtLayout';

export default function MadtPrivacy() {
  useEffect(() => {
    document.title = 'Privacy — MADT';
  }, []);

  return (
    <MadtLayout page="privacy">
      <main id="main" className="subpage">
        <div className="wrap narrow">
          <p className="kicker">MADT</p>
          <h1>Privacy</h1>
          <p>
            If you send a wedding register, a consultation request or a message, the site keeps your name, email,
            phone and the note you wrote. That note sits in the floor book for as long as this site is running.
            It is not sold, and this page does not load third-party trackers.
          </p>
          <p>
            Signing in sets a session cookie on this site. The cookie is marked so scripts on the page cannot read it.
            Logging out clears it. The password you type is checked and then discarded. It is not stored in the browser.
          </p>
          <p>
            A short flag in session storage remembers that you have already seen the opening mark, so it does not play on every page.
            You can clear it in your browser.
          </p>
          <p>
            If you do not want a note kept, do not send the form. If you already sent one, ask the floor to mark it noted.
          </p>
          <p>
            <Link to="/madt">Back to the house</Link>
          </p>
        </div>
      </main>
    </MadtLayout>
  );
}
