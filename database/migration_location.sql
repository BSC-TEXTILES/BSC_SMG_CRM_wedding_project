-- ============================================================
-- BSC MULTI-LOCATION MIGRATION
-- Run once (idempotent). Safe to re-run.
-- Existing Davanagere data assigned location_id = 2
-- ============================================================

-- 1. Create Locations master table
CREATE TABLE IF NOT EXISTS `locations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `location_code` VARCHAR(10) NOT NULL UNIQUE,
  `location_name` VARCHAR(100) NOT NULL,
  `store_name` VARCHAR(150) NOT NULL DEFAULT 'BSC Textiles Pvt Ltd',
  `address` TEXT NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed the three locations (idempotent with real store addresses)
INSERT INTO `locations` (`id`, `location_code`, `location_name`, `store_name`, `address`, `phone`, `email`, `sort_order`, `status`) VALUES
  (1, 'BEL', 'Belagavi', 'BSC Textiles Pvt Ltd', '1st Gate Road, Shukrawar Peth Road, Shivaji Colony, Tilakwadi, Belagavi, Karnataka - 590006', '+91 831 242 1938', 'belagavi@bsctextiles.com', 1, 'Active'),
  (2, 'DAV', 'Davanagere', 'BSC Textiles Pvt Ltd', 'Medical College Road, MCC B Block, Kuvempu Nagar, Davangere, Karnataka - 577004', '+91 8192 221938', 'exclusivedvgbsc@gmail.com', 2, 'Active'),
  (3, 'SHI', 'Shivamogga', 'BSC Textiles Pvt Ltd', 'Parekh Vinayak Mall, Durgigudi Main Road, Durgigudi, Shivamogga, Karnataka - 577201', '+91 8182 221938', 'shivamogga@bsctextiles.com', 3, 'Active')
ON DUPLICATE KEY UPDATE
  `store_name` = VALUES(`store_name`),
  `address` = VALUES(`address`),
  `phone` = VALUES(`phone`),
  `email` = VALUES(`email`),
  `status` = VALUES(`status`),
  `sort_order` = VALUES(`sort_order`);

-- 3. Add location_id to users table (NULL = Global Admin)
ALTER TABLE `users` ADD COLUMN `location_id` INT NULL DEFAULT 2;
ALTER TABLE `users` ADD COLUMN `location_code` VARCHAR(10) NULL;

-- 4. Set Global Admins / Super Admins to NULL (all locations)
UPDATE `users` SET `location_id` = NULL, `location_code` = NULL 
WHERE `role` IN ('Admin', 'Super Admin') AND `location_id` = 2;

-- 5. Set location_code for non-admin users
UPDATE `users` u
JOIN `locations` l ON l.id = u.location_id
SET u.location_code = l.location_code
WHERE u.location_id IS NOT NULL;

-- 6. Add location_id to candidates table
ALTER TABLE `candidates` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
ALTER TABLE `candidates` ADD COLUMN `location_code` VARCHAR(10) NOT NULL DEFAULT 'DAV';
ALTER TABLE `candidates` ADD INDEX `idx_candidates_location` (`location_id`);

-- Update existing candidates to Davanagere
UPDATE `candidates` SET `location_id` = 2, `location_code` = 'DAV' 
WHERE `location_id` = 0 OR `location_code` = '' OR `location_code` IS NULL;

-- 7. Add location_id to interview_schedules
ALTER TABLE `interview_schedules` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `interview_schedules` SET `location_id` = 2 WHERE `location_id` = 0;

-- 8. Add location_id to interview_tokens
ALTER TABLE `interview_tokens` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `interview_tokens` SET `location_id` = 2 WHERE `location_id` = 0;

-- 9. Add location_id to hr_evaluations
ALTER TABLE `hr_evaluations` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `hr_evaluations` SET `location_id` = 2 WHERE `location_id` = 0;

-- 10. Add location_id to selected_candidates
ALTER TABLE `selected_candidates` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `selected_candidates` SET `location_id` = 2 WHERE `location_id` = 0;

-- 11. Add location_id to rejected_candidates (if table exists)
ALTER TABLE `rejected_candidates` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `rejected_candidates` SET `location_id` = 2 WHERE `location_id` = 0;

-- 12. Add location_id to selection_offers
ALTER TABLE `selection_offers` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `selection_offers` SET `location_id` = 2 WHERE `location_id` = 0;

-- 13. Add location_id to onboarding_records
ALTER TABLE `onboarding_records` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `onboarding_records` SET `location_id` = 2 WHERE `location_id` = 0;

-- 14. Add location_id to exit_records
ALTER TABLE `exit_records` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `exit_records` SET `location_id` = 2 WHERE `location_id` = 0;

-- 15. Add location_id to mcheck_responses
ALTER TABLE `mcheck_responses` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
ALTER TABLE `mcheck_responses` ADD INDEX `idx_mcheck_resp_location` (`location_id`, `response_date`);
UPDATE `mcheck_responses` SET `location_id` = 2 WHERE `location_id` = 0;

-- 16. Add location_id to mcheck_audit_log (if exists)
ALTER TABLE `mcheck_audit_log` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `mcheck_audit_log` SET `location_id` = 2 WHERE `location_id` = 0;

-- 17. Add location_id to department_hiring_targets
ALTER TABLE `department_hiring_targets` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
ALTER TABLE `department_hiring_targets` ADD INDEX `idx_dept_hiring_location` (`location_id`);
UPDATE `department_hiring_targets` SET `location_id` = 2 WHERE `location_id` = 0;

-- 18. Add location_id to section_allocations (if table exists)
ALTER TABLE `section_allocations` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `section_allocations` SET `location_id` = 2 WHERE `location_id` = 0;

-- 19. Add location_id to department_sections
ALTER TABLE `department_sections` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `department_sections` SET `location_id` = 2 WHERE `location_id` = 0;

-- 20. Add location_id to candidate_activities
ALTER TABLE `candidate_activities` ADD COLUMN `location_id` INT NOT NULL DEFAULT 2;
UPDATE `candidate_activities` SET `location_id` = 2 WHERE `location_id` = 0;

-- 21. Add location to Broadcast (NULL = all locations)
ALTER TABLE `Broadcast` ADD COLUMN `location_id` INT NULL DEFAULT NULL;

-- 22. Add location to AuditLog
ALTER TABLE `AuditLog` ADD COLUMN `location_id` INT NULL DEFAULT 2;
ALTER TABLE `AuditLog` ADD COLUMN `location_code` VARCHAR(10) NULL DEFAULT 'DAV';
UPDATE `AuditLog` SET `location_id` = 2, `location_code` = 'DAV' WHERE `location_id` IS NULL;

-- Done
SELECT 'BSC Location Migration Complete' AS migration_status,
       (SELECT COUNT(*) FROM locations) AS total_locations,
       (SELECT COUNT(*) FROM candidates WHERE location_id = 2) AS davanagere_candidates,
       (SELECT COUNT(*) FROM users WHERE location_id IS NULL) AS global_admins;
