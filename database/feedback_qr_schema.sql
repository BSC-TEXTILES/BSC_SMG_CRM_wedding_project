-- Feedback QR Code Module Database Schema
-- MySQL 8.0 - Singular Table Names (PascalCase), camelCase Columns
-- Engine: InnoDB, Charset: utf8mb4_unicode_ci

USE `u101820758_bsc_smg_crm`;

-- 1. FeedbackQrCode - QR Code Configuration & Management
CREATE TABLE IF NOT EXISTS `FeedbackQrCode` (
  `id` VARCHAR(64) PRIMARY KEY,
  `qrCodeId` VARCHAR(64) NOT NULL UNIQUE, -- Human-readable ID like QR-001, QR-002
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `locationId` INT NOT NULL,
  `locationCode` VARCHAR(10) NOT NULL, -- 'BEL', 'DAV', 'SHI'
  `locationName` VARCHAR(100) NOT NULL, -- 'Belagavi', 'Davanagere', 'Shivamogga'
  `sectionId` VARCHAR(64) NULL,
  `sectionName` VARCHAR(150) NULL,
  `feedbackFormId` VARCHAR(64) NULL, -- Reference to FeedbackQuestions set
  `targetUrl` TEXT NOT NULL, -- Full URL that QR code points to
  `qrCodeDataUrl` LONGTEXT NULL, -- Base64 PNG data URL
  `qrCodeSvg` LONGTEXT NULL, -- SVG string
  `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
  `scanCount` INT NOT NULL DEFAULT 0,
  `lastScannedAt` TIMESTAMP NULL,
  `createdBy` INT NOT NULL,
  `createdByName` VARCHAR(150) NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT,
  INDEX `idx_qr_code_id` (`qrCodeId`),
  INDEX `idx_location_id` (`locationId`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_by` (`createdBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. FeedbackQrScan - QR Code Scan Tracking
CREATE TABLE IF NOT EXISTS `FeedbackQrScan` (
  `id` VARCHAR(64) PRIMARY KEY,
  `qrCodeId` VARCHAR(64) NOT NULL,
  `qrCodeRefId` VARCHAR(64) NOT NULL, -- References FeedbackQrCode.qrCodeId
  `scannedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `deviceType` VARCHAR(50) NULL, -- 'mobile', 'tablet', 'desktop'
  `browser` VARCHAR(100) NULL,
  `os` VARCHAR(100) NULL,
  `referrer` TEXT NULL,
  `country` VARCHAR(100) NULL,
  `city` VARCHAR(100) NULL,
  `isFeedbackSubmitted` TINYINT(1) DEFAULT 0,
  `feedbackId` VARCHAR(64) NULL, -- References Feedback.id if submitted
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`qrCodeRefId`) REFERENCES `FeedbackQrCode`(`qrCodeId`) ON DELETE CASCADE,
  INDEX `idx_qr_code_ref_id` (`qrCodeRefId`),
  INDEX `idx_scanned_at` (`scannedAt`),
  INDEX `idx_feedback_submitted` (`isFeedbackSubmitted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. FeedbackForm - Reusable Feedback Form Templates (optional enhancement)
CREATE TABLE IF NOT EXISTS `FeedbackForm` (
  `id` VARCHAR(64) PRIMARY KEY,
  `formId` VARCHAR(64) NOT NULL UNIQUE, -- Human-readable like FORM-001
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `questionsJson` JSON NOT NULL, -- Array of question objects
  `isDefault` TINYINT(1) DEFAULT 0,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `createdBy` INT NOT NULL,
  `createdByName` VARCHAR(150) NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT,
  INDEX `idx_form_id` (`formId`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default feedback form
INSERT INTO `FeedbackForm` (`id`, `formId`, `name`, `description`, `questionsJson`, `isDefault`, `status`, `createdBy`, `createdByName`)
SELECT 
  'form_default_001',
  'FORM-001',
  'Standard Customer Experience Survey',
  'Default 5-question customer satisfaction survey for all locations',
  '[
    {"id": "q1", "question": "How satisfied are you with your overall shopping experience today?", "category": "Shopping Experience", "options": ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very dissatisfied"], "required": true, "position": 1},
    {"id": "q2", "question": "Did you find the product you were looking for?", "category": "Product Availability", "options": ["Yes, exactly what I wanted", "Yes, with assistance", "Partially", "No"], "required": true, "position": 2},
    {"id": "q3", "question": "How would you rate the quality & variety of our collection?", "category": "Collection Quality", "options": ["Excellent", "Good", "Average", "Poor"], "required": true, "position": 3},
    {"id": "q4", "question": "How would you rate the behavior and helpfulness of our staff?", "category": "Staff Courtesy", "options": ["Extremely helpful", "Helpful", "Average", "Poor"], "required": true, "position": 4},
    {"id": "q5", "question": "How likely are you to recommend BSC Exclusive to your friends and family?", "category": "Store Recommendation", "options": ["Definitely recommend", "Probably recommend", "Neutral", "Not recommend"], "required": true, "position": 5}
  ]',
  1,
  'active',
  1,
  'System Admin'
WHERE NOT EXISTS (SELECT 1 FROM `FeedbackForm` WHERE `formId` = 'FORM-001');

-- Add foreign key column to Feedback table to track which QR code it came from
ALTER TABLE `Feedback` ADD COLUMN `qrCodeId` VARCHAR(64) NULL AFTER `sectionId`;
ALTER TABLE `Feedback` ADD INDEX `idx_qr_code_id` (`qrCodeId`);