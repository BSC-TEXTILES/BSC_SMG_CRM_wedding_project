const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding BSC HRMS Database...');

  try {
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin@2026', 10);
    const defaultPassword = await bcrypt.hash(process.env.DEFAULT_USER_PASSWORD || 'bsc@2026', 10);
    const greeterPassword = await bcrypt.hash(process.env.GREETER_PASSWORD || 'bsc@123', 10);

    // 1. Seed Users
    const users = [
      ['hr@bsctextiles.com', defaultPassword, 'HR', 'HR Admin', true],
      ['manager@bsctextiles.com', defaultPassword, 'Manager', 'Store Manager', true],
      ['admin@bsctextiles.com', adminPassword, 'Admin', 'Admin', true],
      ['greeter@bsctextiles.com', greeterPassword, 'Greeter', 'Greeter Staff', true]
    ];

    for (const u of users) {
      await db.query(
        `INSERT INTO users (username, password, role, full_name, active)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password), full_name = VALUES(full_name)`,
        u
      );
    }
    console.log('✓ Users seeded (hr@bsctextiles.com, manager@bsctextiles.com, admin@bsctextiles.com, greeter@bsctextiles.com)');

    // 2. Seed Designations
    const designations = [
      'Sales Executive',
      'Floor Manager',
      'Cashier',
      'Billing Executive',
      'Store Keeper'
    ];

    for (const d of designations) {
      await db.query(
        `INSERT INTO designations (role_scope, name, active)
         VALUES ('All', ?, TRUE)
         ON DUPLICATE KEY UPDATE active = TRUE`,
        [d]
      );
    }
    console.log('✓ Designations seeded');

    // 3. Seed Interview Questions
    const questions = [
      ['All', 'HR', 1, 'Communication & confidence', 'score', 15, ''],
      ['All', 'HR', 2, 'Previous work experience', 'score', 15, ''],
      ['All', 'HR', 3, 'Textile/retail knowledge', 'score', 15, ''],
      ['All', 'HR', 4, 'Expected salary reasonable?', 'score', 10, ''],
      ['All', 'HR', 5, 'Can join immediately?', 'select', 0, 'Yes immediately,After 1 week,After 15 days,After 1 month'],
      ['All', 'Round 2', 1, 'Job knowledge & product skills', 'score', 20, ''],
      ['All', 'Round 2', 2, 'Problem solving & decision making', 'score', 15, ''],
      ['All', 'Round 2', 3, 'Team fit & attitude', 'score', 15, ''],
      ['All', 'Round 2', 4, 'Customer handling ability', 'score', 10, ''],
      ['All', 'Round 2', 5, 'Overall recommendation', 'score', 10, '']
    ];

    for (const q of questions) {
      const [existing] = await db.query(
        `SELECT id FROM interview_questions WHERE designation = ? AND round = ? AND q_id = ?`,
        [q[0], q[1], q[2]]
      );
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO interview_questions (designation, round, q_id, question, type, max_score, options, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
          q
        );
      }
    }
    console.log('✓ Interview Questions seeded');

    // 4. Seed Page Visibility Defaults
    const visibility = [
      ['HR_dashboard', 'HR', 'dashboard', true],
      ['HR_candidates', 'HR', 'candidates', true],
      ['HR_interview', 'HR', 'interview', true],
      ['HR_offer', 'HR', 'offer', true],
      ['HR_settings', 'HR', 'settings', false],
      ['Manager_dashboard', 'Manager', 'dashboard', true],
      ['Manager_candidates', 'Manager', 'candidates', true],
      ['Manager_interview', 'Manager', 'interview', true],
      ['Manager_offer', 'Manager', 'offer', false],
      ['Manager_settings', 'Manager', 'settings', false],
      ['Admin_dashboard', 'Admin', 'dashboard', true],
      ['Admin_candidates', 'Admin', 'candidates', true],
      ['Admin_interview', 'Admin', 'interview', true],
      ['Admin_offer', 'Admin', 'offer', true],
      ['Admin_settings', 'Admin', 'settings', true]
    ];

    for (const v of visibility) {
      await db.query(
        `INSERT INTO page_visibility (role_page_key, role, page_key, allowed)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
        v
      );
    }
    console.log('✓ Page Visibility seeded');

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
