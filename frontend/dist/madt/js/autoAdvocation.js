/**
 * Auto-Advocation Module
 * Combines all existing fields across the MADT House codebase into a unified
 * data structure and generates a formal, deterministic advocacy message/letter.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    root.buildAutoAdvocationData = exp.buildAutoAdvocationData;
    root.generateAdvocacyLetter = exp.generateAdvocacyLetter;
    root.autoAdvocation = exp;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORE_LOCATIONS = {
    'Flagship, Koppikar Road': {
      name: 'Flagship Store',
      address: 'Koppikar Road, Hubballi 580020',
      hours: '10:30–20:30, all week'
    },
    'Home floor, Vidyanagar': {
      name: 'Home Floor',
      address: 'Vidyanagar, Hubballi 580021',
      hours: '10:30–20:00, all week'
    },
    'Suit desk, Coen Road': {
      name: 'Suit Desk',
      address: 'Coen Road, Hubballi 580020',
      hours: '11:00–20:00, Tuesday to Sunday (Monday by appointment)'
    },
    'Wedding room': {
      name: 'Wedding Room',
      address: 'Flagship, Koppikar Road, Hubballi 580020',
      hours: '10:30–20:30, by appointment'
    },
    'Jewellery room': {
      name: 'Jewellery Room',
      address: 'Flagship, Koppikar Road, Hubballi 580020',
      hours: '10:30–20:30, all week'
    }
  };

  /**
   * Helper to format a date nicely
   */
  function formatDate(d) {
    if (!d) return '';
    try {
      var dateObj = typeof d === 'string' ? new Date(d) : d;
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return String(d);
  }

  /**
   * 1. Collect & combine all existing fields in the current project
   * Returns a normalized unified autoAdvocationData object.
   *
   * @param {Object} [overrideData] - Optional manual field values to merge
   * @returns {Object} normalized autoAdvocationData
   */
  function buildAutoAdvocationData(overrideData) {
    overrideData = overrideData || {};

    // ── Scan active page / form elements if in browser DOM ──
    var domValues = {};
    if (typeof document !== 'undefined') {
      // Find form fields by names or known IDs
      var form = document.querySelector('form[data-desk-form]') ||
                 document.getElementById('login-form') ||
                 document.querySelector('form');

      if (form) {
        var formData = new FormData(form);
        formData.forEach(function (val, key) {
          if (key === 'needs') {
            domValues.needs = domValues.needs || [];
            if (val && domValues.needs.indexOf(val) === -1) {
              domValues.needs.push(val);
            }
          } else if (key !== 'company') {
            domValues[key] = (val || '').toString().trim();
          }
        });
      }

      // Check specific standard inputs if not captured in form
      var queryField = function (selector) {
        var el = document.querySelector(selector);
        return el ? (el.value || el.textContent || '').trim() : '';
      };

      if (!domValues.name) domValues.name = queryField('#c-name, #m-name, #w-name, input[name="name"]');
      if (!domValues.email) domValues.email = queryField('#c-email, #m-email, #w-email, #email, input[name="email"]');
      if (!domValues.phone) domValues.phone = queryField('#c-phone, #m-phone, #w-phone, input[name="phone"]');
      if (!domValues.floor) domValues.floor = queryField('#c-floor, #m-floor, #w-floor, select[name="floor"]');
      if (!domValues.day) domValues.day = queryField('#c-day, input[name="day"]');
      if (!domValues.date) domValues.date = queryField('#w-date, input[name="date"]');
      if (!domValues.side) domValues.side = queryField('#w-side, select[name="side"]');
      if (!domValues.note) domValues.note = queryField('#c-note, #m-note, #w-note, textarea[name="note"], textarea[name="message"]');

      // Check for reference ID in confirmation block or URL
      var refEl = document.querySelector('[data-ref]');
      if (refEl && refEl.textContent.trim()) {
        domValues.ref = refEl.textContent.trim();
      }

      // Check current page kind
      var pageKind = (form && form.getAttribute('data-desk-form')) ||
                     (document.body && document.body.dataset && document.body.dataset.page) ||
                     'contact';
      domValues.kind = pageKind;
    }

    // ── Read cached user profile / session if available ──
    var sessionUser = {};
    if (typeof sessionStorage !== 'undefined') {
      try {
        var rawUser = sessionStorage.getItem('madt_user');
        if (rawUser) sessionUser = JSON.parse(rawUser);
      } catch (e) {}
    }

    // Merge sources with priority: overrideData > domValues > sessionUser
    var rawName = overrideData.name || domValues.name || sessionUser.name || '';
    var rawEmail = overrideData.email || domValues.email || sessionUser.email || '';
    var rawPhone = overrideData.phone || domValues.phone || '';
    var rawRole = overrideData.role || sessionUser.role || 'customer';
    var rawFloor = overrideData.floor || domValues.floor || 'Flagship, Koppikar Road';
    var rawDay = overrideData.day || overrideData.preferredDay || domValues.day || '';
    var rawDate = overrideData.date || overrideData.weddingDate || domValues.date || '';
    var rawSide = overrideData.side || domValues.side || '';
    var rawNeeds = overrideData.needs || domValues.needs || [];
    if (typeof rawNeeds === 'string') rawNeeds = [rawNeeds];
    var rawNote = overrideData.note || overrideData.message || domValues.note || '';
    var rawRef = overrideData.ref || domValues.ref || '';
    var rawStatus = overrideData.status || domValues.status || 'New';
    var rawKind = overrideData.kind || domValues.kind || 'contact';

    // Store address and hours resolution
    var storeInfo = STORE_LOCATIONS[rawFloor] || {
      name: rawFloor || 'Flagship Counter',
      address: 'Koppikar Road, Hubballi 580020',
      hours: '10:30–20:30, all week'
    };

    var autoAdvocationData = {
      // Primary Applicant & Profile
      applicant: {
        name: rawName || 'Valued Client',
        email: rawEmail || '',
        phone: rawPhone || '',
        role: rawRole,
        side: rawSide,
        affiliation: rawRole === 'staff' ? 'Floor Staff' : rawRole === 'admin' ? 'House Desk' : (rawSide ? rawSide + ' Client' : 'Customer')
      },
      // Store Location & Organization
      location: {
        floor: rawFloor,
        storeName: storeInfo.name,
        address: storeInfo.address,
        hours: storeInfo.hours,
        city: 'Hubballi',
        organization: 'MADT House, Hubballi'
      },
      // Case & Request Specifics
      caseDetails: {
        kind: rawKind,
        category: rawKind === 'wedding' ? 'Wedding Shopping & Trousseau Registration' :
                  rawKind === 'consult' ? 'Floor Consultation & Custom Fitting' : 'General Desk Inquiry & Advocacy',
        preferredDay: rawDay,
        weddingDate: rawDate ? formatDate(rawDate) : '',
        needs: rawNeeds,
        note: rawNote,
        ref: rawRef || 'MADT-PENDING',
        status: rawStatus,
        submissionDate: formatDate(new Date())
      },
      // Meta & Auditing
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'MADT Central Desk Auto-Advocation Engine v1.0'
      }
    };

    return autoAdvocationData;
  }

  /**
   * 2. Auto-generate an advocacy message / letter using the combined fields.
   * Deterministic template (no randomness). Empty sections are gracefully omitted.
   *
   * @param {Object} data - Result of buildAutoAdvocationData()
   * @returns {string} Formatted advocacy letter string
   */
  function generateAdvocacyLetter(data) {
    if (!data) data = buildAutoAdvocationData();

    var app = data.applicant || {};
    var loc = data.location || {};
    var c = data.caseDetails || {};

    var lines = [];

    // Header
    lines.push('================================================================================');
    lines.push('              FORMAL ADVOCACY & CLIENT REPRESENTATION BRIEF');
    lines.push('                          MADT House · Hubballi');
    lines.push('================================================================================\n');

    lines.push('Date: ' + (c.submissionDate || formatDate(new Date())));
    lines.push('To: The Floor Desk & Management');
    lines.push('    ' + loc.organization + ' — ' + (loc.floor || 'Flagship'));
    if (loc.address) lines.push('    ' + loc.address);
    if (c.ref && c.ref !== 'MADT-PENDING') lines.push('Reference Code: ' + c.ref);
    lines.push('Status: ' + (c.status || 'Active Advocacy Request'));
    lines.push('');

    // Subject
    lines.push('SUBJECT: Request for Official Advocacy & Representation — ' + c.category);
    lines.push('');

    // Intro
    var introWho = app.name;
    if (app.side) introWho += ' (representing the ' + app.side + ')';
    else if (app.affiliation) introWho += ' (' + app.affiliation + ')';

    lines.push('Dear Floor Desk,');
    lines.push('');
    lines.push('This formal advocacy letter is submitted on behalf of ' + introWho + '. ' +
               'We hereby register an official representation request with the house desk regarding ' +
               'curated appointments and dedicated floor coordination.');
    lines.push('');

    // Situation & Context
    lines.push('CONTEXT & REQUIREMENTS OVERVIEW:');
    var contextText = 'The client has requested tailored assistance at the ' + (loc.floor || 'designated counter') + '.';
    if (c.weddingDate) {
      contextText += ' The upcoming wedding ceremony is scheduled for ' + c.weddingDate + ', necessitating timely preparation and advance coordination.';
    }
    if (c.preferredDay) {
      contextText += ' The preferred appointment window is ' + c.preferredDay + '.';
    }
    lines.push(contextText);
    lines.push('');

    // Requested Action
    lines.push('REQUESTED ADVOCACY ACTION:');
    if (c.kind === 'wedding') {
      lines.push('1. Reserve a dedicated floor hour without interruption to review the family wedding shopping list.');
      lines.push('2. Pre-assign a senior staff advisor familiar with our textile collections, suits, and jewellery.');
      lines.push('3. Provide priority verification and log the booking on the house desk book.');
    } else if (c.kind === 'consult') {
      lines.push('1. Confirm reserved consultation time on the floor schedule for ' + (c.preferredDay || 'the requested time') + '.');
      lines.push('2. Prepare fabric swatches and fittings in advance at the ' + (loc.floor || 'counter') + '.');
      lines.push('3. Provide direct confirmation notice once the floor time has been allocated.');
    } else {
      lines.push('1. Review the client brief and provide an official response from the counter desk.');
      lines.push('2. Coordinate requested details with the relevant floor manager.');
      lines.push('3. Record this representation inquiry in the centralized desk ledger.');
    }
    lines.push('');

    // Supporting Details
    lines.push('SUPPORTING CASE DETAILS:');
    if (app.name) lines.push('• Client / Applicant Name: ' + app.name);
    if (app.email) lines.push('• Contact Email: ' + app.email);
    if (app.phone) lines.push('• Telephone: ' + app.phone);
    if (app.side) lines.push('• Party Representation: ' + app.side);
    if (loc.floor) lines.push('• Assigned Floor / Counter: ' + loc.floor);
    if (loc.hours) lines.push('• Operating Counter Hours: ' + loc.hours);
    if (c.preferredDay) lines.push('• Preferred Consultation Timing: ' + c.preferredDay);
    if (c.weddingDate) lines.push('• Target Event Date: ' + c.weddingDate);
    if (c.needs && c.needs.length > 0) {
      lines.push('• Requested Merchandise & Categories: ' + c.needs.join(', '));
    }
    if (c.note) {
      lines.push('• Specific Client Brief / Instructions: ' + c.note);
    }
    lines.push('');

    // Closing
    lines.push('CLOSING & AFFIRMATION:');
    lines.push('All information provided above reflects the verified client request on record. We appreciate ' +
               'the courtesy and traditional standards of MADT House in facilitating this request.');
    lines.push('');
    lines.push('Respectfully submitted,');
    lines.push('');
    lines.push(app.name);
    if (app.phone) lines.push('Phone: ' + app.phone);
    if (app.email) lines.push('Email: ' + app.email);
    lines.push(loc.organization);
    lines.push('================================================================================');

    return lines.join('\n');
  }

  return {
    buildAutoAdvocationData: buildAutoAdvocationData,
    generateAdvocacyLetter: generateAdvocacyLetter
  };
});
