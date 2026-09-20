-- ============================================================
-- BSC BATCH PLAN & WEAVING MODULE SCHEMA MIGRATION
-- Idempotent, safe migration
-- ============================================================

CREATE TABLE IF NOT EXISTS `batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_number` VARCHAR(50) NOT NULL UNIQUE,
  `batch_name` VARCHAR(150) NOT NULL,
  `location_id` INT NOT NULL DEFAULT 2,
  `start_date` DATE NOT NULL,
  `target_end_date` DATE NULL,
  `actual_end_date` DATE NULL,
  `status` ENUM('Draft', 'Active', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Draft',
  `department` VARCHAR(100) NULL DEFAULT 'Weaving',
  `trainer_name` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_batches_location` (`location_id`),
  INDEX `idx_batches_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batch_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `group_name` VARCHAR(100) NOT NULL,
  `mentor_name` VARCHAR(100) NULL,
  `target_count` INT NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_batch_groups_batch` (`batch_id`),
  FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batch_group_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `group_id` INT NOT NULL,
  `batch_id` INT NOT NULL,
  `candidate_id` INT NULL,
  `employee_id` VARCHAR(50) NULL,
  `member_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `status` ENUM('Assigned', 'In Progress', 'Graduated', 'Dropped') NOT NULL DEFAULT 'Assigned',
  `join_date` DATE NULL,
  `completion_date` DATE NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_bgm_group` (`group_id`),
  INDEX `idx_bgm_batch` (`batch_id`),
  INDEX `idx_bgm_candidate` (`candidate_id`),
  FOREIGN KEY (`group_id`) REFERENCES `batch_groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
