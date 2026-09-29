/**
 * Sequence allocation for `wedding_customers.customer_code`.
 *
 * Two formats live side by side in the table:
 *   legacy  : WED-<LOC>-<YEAR>-<4 digits>      (bulk CSV import, landing enquiry)
 *   current : BSC-WED-<LOC>-<YEAR>-<6 digits>  (single-record create, registration)
 *
 * The generators used to derive "the next number" from whichever row happened
 * to hold the highest id (or from a single most-recent row). As soon as that
 * row belongs to the other format the counter silently resets and the next
 * insert dies with `Duplicate entry ... for key 'wedding_customers.customer_code'`.
 *
 * Everything here reads the true MAX across both formats and, where a single
 * code is allocated, confirms the candidate is free before returning it.
 */

const legacyPrefix = (locCode, year) => `WED-${locCode}-${year}-`;
const currentPrefix = (locCode, year) => `BSC-WED-${locCode}-${year}-`;

/**
 * Highest numeric suffix already used for this store + year. One shared
 * counter: both code formats AND both tables (a registration can reserve a
 * number before its CRM customer row exists). Returns 0 when unused.
 *
 * @param {{query: Function}} executor  pool, or a transaction handle
 */
async function maxSequence(executor, locCode, year = new Date().getFullYear()) {
  const legacy = `${legacyPrefix(locCode, year)}%`;
  const current = `${currentPrefix(locCode, year)}%`;
  try {
    const [rows] = await executor.query(
      `SELECT MAX(seq) AS maxSeq FROM (
         SELECT CAST(SUBSTRING_INDEX(customer_code, '-', -1) AS UNSIGNED) AS seq
           FROM wedding_customers
          WHERE customer_code LIKE ? OR customer_code LIKE ?
         UNION ALL
         SELECT CAST(SUBSTRING_INDEX(registration_id, '-', -1) AS UNSIGNED) AS seq
           FROM wedding_registrations
          WHERE registration_id LIKE ? OR registration_id LIKE ?
       ) all_seqs`,
      [legacy, current, legacy, current]
    );
    const value = rows && rows[0] ? rows[0].maxSeq : null;
    return parseInt(value, 10) || 0;
  } catch (err) {
    // weding_registrations may be missing in a partially migrated database
    const [rows] = await executor.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(customer_code, '-', -1) AS UNSIGNED)) AS maxSeq
         FROM wedding_customers
        WHERE customer_code LIKE ? OR customer_code LIKE ?`,
      [legacy, current]
    );
    const value = rows && rows[0] ? rows[0].maxSeq : null;
    return parseInt(value, 10) || 0;
  }
}

async function isTaken(pool, customerCode) {
  const [rows] = await pool.query(
    `SELECT id FROM wedding_customers WHERE customer_code = ? LIMIT 1`,
    [customerCode]
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Allocate one free code. Returns null when no free code is found so callers
 * can surface a controlled error instead of a 500 duplicate-key failure.
 *
 * @param {'legacy'|'current'} format  'legacy' -> WED-... (4 digits)
 *                                     'current' -> BSC-WED-... (6 digits)
 */
async function allocateCustomerCode(pool, locCode, format = 'current', year = new Date().getFullYear()) {
  const useLegacy = format === 'legacy';
  const prefix = useLegacy ? legacyPrefix(locCode, year) : currentPrefix(locCode, year);
  const digits = useLegacy ? 4 : 6;

  let seq = await maxSequence(pool, locCode, year);
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `${prefix}${String(seq + 1).padStart(digits, '0')}`;
    if (!(await isTaken(pool, candidate))) return candidate;
    seq += 1;
  }
  return null;
}

module.exports = { maxSequence, isTaken, allocateCustomerCode };
