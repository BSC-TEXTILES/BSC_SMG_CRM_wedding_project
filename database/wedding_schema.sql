-- ============================================================
-- BSC WEDDING CUSTOMER FOLLOW-UP CRM SCHEMA
-- Independent module for wedding customer follow-up and telecalling.
-- Multi-Location Support: BELAGAVI (1), DAVANAGERE (2), SHIVAMOGGA (3)
-- ============================================================

-- 1. Wedding Customers Master Table
CREATE TABLE IF NOT EXISTS `wedding_customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_code` VARCHAR(50) NOT NULL UNIQUE,
  `location_id` INT NOT NULL DEFAULT 2,
  `customer_name` VARCHAR(150) NOT NULL,
  `mobile_number` VARCHAR(20) NOT NULL,
  `email` VARCHAR(150) NULL,
  `wedding_date` DATE NULL,
  `expected_shopping_date` DATE NOT NULL,
  `preferred_shopping_category` VARCHAR(150) NULL,
  `estimated_family_size` INT NULL DEFAULT 1,
  `assigned_telecaller` VARCHAR(150) NULL,
  `assigned_telecaller_id` INT NULL,
  `follow_up_date` DATE NOT NULL,
  `preferred_call_time` VARCHAR(50) NULL,
  `customer_notes` TEXT NULL,
  `customer_status` ENUM(
    'New',
    'Follow-up Pending',
    'Contacted',
    'Interested',
    'Shopping Date Confirmed',
    'Visited Store',
    'Converted',
    'Not Interested',
    'No Response',
    'Cancelled',
    'Closed'
  ) NOT NULL DEFAULT 'New',
  `call_status` ENUM(
    'Pending',
    'Called',
    'No Answer',
    'Busy',
    'Call Back Requested',
    'Connected',
    'Completed'
  ) NOT NULL DEFAULT 'Pending',
  `total_calls_count` INT NOT NULL DEFAULT 0,
  `last_call_date` DATETIME NULL,
  `last_call_outcome` VARCHAR(100) NULL,
  `last_contacted_by` VARCHAR(150) NULL,
  `last_contacted_by_user_id` INT NULL,
  `last_updated_by` VARCHAR(150) NULL,
  `last_updated_by_user_id` INT NULL,
  `created_by` VARCHAR(150) NULL,
  `created_by_user_id` INT NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_wed_loc_status` (`location_id`, `customer_status`, `follow_up_date`),
  INDEX `idx_wed_mobile_loc` (`mobile_number`, `location_id`),
  INDEX `idx_wed_follow_up` (`follow_up_date`),
  INDEX `idx_wed_shop_date` (`expected_shopping_date`),
  INDEX `idx_wed_last_contact` (`last_contacted_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Wedding Call Logs
CREATE TABLE IF NOT EXISTS `wedding_call_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `location_id` INT NOT NULL DEFAULT 2,
  `call_date` DATE NOT NULL,
  `call_time` VARCHAR(20) NOT NULL,
  `telecaller_name` VARCHAR(150) NOT NULL,
  `telecaller_id` INT NULL,
  `call_status` VARCHAR(50) NOT NULL DEFAULT 'Completed',
  `call_outcome` VARCHAR(50) NOT NULL,
  `remarks` TEXT NULL,
  `next_follow_up_date` DATE NULL,
  `next_follow_up_time` VARCHAR(50) NULL,
  `expected_shopping_date_updated` DATE NULL,
  `call_duration` VARCHAR(50) NULL,
  `customer_response` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `wedding_customers`(`id`) ON DELETE RESTRICT,
  INDEX `idx_call_cust` (`customer_id`),
  INDEX `idx_call_date` (`call_date`),
  INDEX `idx_call_loc` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Wedding Audit Logs
CREATE TABLE IF NOT EXISTS `wedding_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NULL,
  `location_id` INT NOT NULL DEFAULT 2,
  `user_name` VARCHAR(150) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_cust` (`customer_id`),
  INDEX `idx_audit_loc` (`location_id`),
  INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Wedding WhatsApp Logs
CREATE TABLE IF NOT EXISTS `wedding_whatsapp_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `customer_code` VARCHAR(50) NULL,
  `location_id` INT NOT NULL DEFAULT 2,
  `telecaller_id` INT NULL,
  `telecaller_name` VARCHAR(150) NULL,
  `recipient_mobile` VARCHAR(30) NOT NULL,
  `template_type` VARCHAR(60) NOT NULL,
  `template_name` VARCHAR(100) NULL,
  `message_text` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'SENT',
  `failure_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_wa_cust` (`customer_id`),
  INDEX `idx_wa_loc` (`location_id`),
  INDEX `idx_wa_telecaller` (`telecaller_id`),
  INDEX `idx_wa_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

