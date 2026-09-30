/**
 * BSC Location Management Controller
 * Handles: list locations, create, update, get global stats
 */
const db = require('../config/db');
const { getLocationFilter } = require('../middleware/auth');

// ── List all locations ───────────────────────────────────────
exports.getLocations = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.*,
        (SELECT COUNT(DISTINCT u.id) FROM users u
          WHERE u.active = TRUE AND (u.location_id = l.id
            OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = l.id))) AS active_users,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id) AS total_candidates,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id AND c.status IN ('Joined','Mark Joined','Offer Accepted','Confirmed DOJ')) AS joined_count
       FROM locations l
       WHERE l.status = 'Active'
       ORDER BY l.sort_order ASC, l.location_name ASC`
    );
    return res.json({ success: true, locations: rows, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Get single location detail ───────────────────────────────
exports.getLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT l.*,
        (SELECT COUNT(DISTINCT u.id) FROM users u
          WHERE u.active = TRUE AND (u.location_id = l.id
            OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = l.id))) AS active_users,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id) AS total_candidates
       FROM locations l WHERE l.id = ?`, [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Location not found' });
    return res.json({ success: true, location: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Create location (Global Admin only) ─────────────────────
exports.createLocation = async (req, res) => {
  try {
    const { location_name, location_code, address, phone: rawPhone, email, sort_order } = req.body;
    if (!location_name || !location_code) {
      return res.status(400).json({ success: false, error: 'location_name and location_code are required' });
    }
    // Normalize phone to +91 format
    let phone = rawPhone || null;
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) phone = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) phone = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) phone = `+91${digits.slice(1)}`;
    }
    const [result] = await db.query(
      `INSERT INTO locations (location_name, location_code, address, phone, email, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [location_name, location_code.toUpperCase().trim(), address || null, phone || null, email || null, sort_order || 99]
    );
    return res.json({ success: true, locationId: result.insertId, message: 'Location created successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Update location (Global Admin only) ─────────────────────
exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { location_name, address, phone: rawPhone, email, status, sort_order } = req.body;
    // Normalize phone to +91 format
    let phone = rawPhone;
    if (phone && typeof phone === 'string') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) phone = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) phone = `+${digits}`;
      else if (digits.length === 11 && digits.startsWith('0')) phone = `+91${digits.slice(1)}`;
    }
    await db.query(
      `UPDATE locations SET
         location_name = COALESCE(?, location_name),
         address = COALESCE(?, address),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         status = COALESCE(?, status),
         sort_order = COALESCE(?, sort_order)
       WHERE id = ?`,
      [location_name, address, phone, email, status, sort_order, id]
    );
    return res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Global dashboard stats (Global Admin only) ───────────────
exports.getGlobalStats = async (req, res) => {
  try {
    const [locations] = await db.query(
      `SELECT id, location_name, location_code FROM locations WHERE status = 'Active' ORDER BY sort_order ASC`
    );

    const stats = [];
    for (const loc of locations) {
      const [[cand]]  = await db.query(`SELECT COUNT(*) AS cnt FROM candidates WHERE location_id = ?`, [loc.id]);
      const [[joined]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM candidates WHERE location_id = ? AND status IN ('Joined','Mark Joined','Offer Accepted','Confirmed DOJ')`, [loc.id]
      );
      const [[pending]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM candidates WHERE location_id = ? AND status NOT IN ('Joined','Mark Joined','Rejected','Dropped')`, [loc.id]
      );
      const [[users]] = await db.query(
        `SELECT COUNT(DISTINCT u.id) AS cnt FROM users u
          WHERE u.active = TRUE AND (u.location_id = ?
            OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = ?))`,
        [loc.id, loc.id]
      );

      stats.push({
        locationId: loc.id,
        locationCode: loc.location_code,
        locationName: loc.location_name,
        totalCandidates: cand.cnt,
        joined: joined.cnt,
        pending: pending.cnt,
        activeUsers: users.cnt
      });
    }

    const totals = stats.reduce((acc, s) => ({
      totalCandidates: acc.totalCandidates + s.totalCandidates,
      joined: acc.joined + s.joined,
      pending: acc.pending + s.pending,
      activeUsers: acc.activeUsers + s.activeUsers
    }), { totalCandidates: 0, joined: 0, pending: 0, activeUsers: 0 });

    return res.json({ success: true, locations: stats, totals, locationCount: locations.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Store Directory (Sanitized Store-Level Directory — Zero Employee PII) ──
exports.getStoreDirectory = async (req, res) => {
  try {
    // The locations table's own key is `id`, not `location_id`.
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'l', 'id');
    const { search } = req.query || {};

    let sql = `
      SELECT 
        l.id,
        l.location_name,
        l.location_code,
        l.address,
        l.phone as store_phone,
        l.email as store_email,
        l.status,
        l.sort_order,
        (SELECT COUNT(DISTINCT u.id) FROM users u
          WHERE u.active = TRUE AND (u.location_id = l.id
            OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = l.id))) AS active_staff_count,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id AND c.status IN ('Joined','Mark Joined','Offer Accepted','Confirmed DOJ')) AS joined_staff_count
      FROM locations l
      WHERE l.status = 'Active' ${locClause}
    `;
    const params = [...locParams];

    if (search && search.trim()) {
      sql += ` AND (l.location_name LIKE ? OR l.location_code LIKE ? OR l.address LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    sql += ` ORDER BY l.sort_order ASC, l.location_name ASC`;

    const [rows] = await db.query(sql, params);

    // Fetch distinct active departments for each store location
    const storesWithDepts = await Promise.all((rows || []).map(async (store) => {
      let departments = [];
      try {
        const [deptRows] = await db.query(
          `SELECT DISTINCT department FROM users 
           WHERE active = TRUE AND (location_id = ? OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = users.id AND ul.location_id = ?))
             AND department IS NOT NULL AND department != '' ORDER BY department ASC`,
          [store.id, store.id]
        );
        departments = (deptRows || []).map(d => d.department).filter(Boolean);
      } catch (e) {}

      if (departments.length === 0) {
        departments = ['Sales & Retail', 'Customer Service', 'Visual Merchandising', 'Billing & Cash', 'Inventory & Sourcing'];
      }

      return {
        id: store.id,
        storeName: store.location_name,
        locationCode: store.location_code,
        address: store.address || 'Address on file',
        storePhone: store.store_phone || '+91 80 2345 6789',
        storeEmail: store.store_email || `store.${store.location_code.toLowerCase()}@bsctextiles.com`,
        activeStaffCount: Number(store.active_staff_count || 0),
        joinedStaffCount: Number(store.joined_staff_count || 0),
        departments,
        status: store.status || 'Active'
      };
    }));

    return res.json({
      success: true,
      count: storesWithDepts.length,
      stores: storesWithDepts
    });
  } catch (err) {
    console.error('[getStoreDirectory ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Export Store Directory (Sanitized — Zero Employee PII) ──
exports.exportStoreDirectory = async (req, res) => {
  try {
    // The locations table's own key is `id`, not `location_id`.
    const { clause: locClause, params: locParams } = await getLocationFilter(req, 'l', 'id');

    const [rows] = await db.query(`
      SELECT 
        l.id,
        l.location_name,
        l.location_code,
        l.address,
        l.phone as store_phone,
        l.email as store_email,
        l.status,
        (SELECT COUNT(DISTINCT u.id) FROM users u
          WHERE u.active = TRUE AND (u.location_id = l.id
            OR EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = u.id AND ul.location_id = l.id))) AS active_staff_count,
        (SELECT COUNT(*) FROM candidates c WHERE c.location_id = l.id AND c.status IN ('Joined','Mark Joined','Offer Accepted','Confirmed DOJ')) AS joined_staff_count
      FROM locations l
      WHERE l.status = 'Active' ${locClause}
      ORDER BY l.sort_order ASC, l.location_name ASC
    `, locParams);

    const exportData = (rows || []).map((store, idx) => ({
      'S.No': idx + 1,
      'Store Branch': store.location_name,
      'Store Code': store.location_code,
      'Store Official Contact Phone': store.store_phone || '+91 80 2345 6789',
      'Store Official Email': store.store_email || `store.${store.location_code.toLowerCase()}@bsctextiles.com`,
      'Store Address': store.address || 'Karnataka, India',
      'Active Staff Headcount': Number(store.active_staff_count || 0),
      'Total Joined Staff': Number(store.joined_staff_count || 0),
      'Operating Status': (store.status || 'ACTIVE').toUpperCase()
    }));

    return res.json({ success: true, count: exportData.length, data: exportData });
  } catch (err) {
    console.error('[exportStoreDirectory ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
