-- ============================================================
-- BSC STORE OPERATIONS MULTI-LOCATION MIGRATION
-- Run once (idempotent). Safe to re-run.
-- Assigns Davanagere (location_id = 2) to existing unassigned data
-- ============================================================

SET @dbname = DATABASE();

-- 1. Add location_id to FootfallEntries & compound unique key (location_id, entryDate, slotHour)
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'FootfallEntries'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE FootfallEntries ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ensure compound index exists on FootfallEntries
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'FootfallEntries'
      AND INDEX_NAME = 'idx_loc_date_slot'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE FootfallEntries ADD UNIQUE KEY idx_loc_date_slot (location_id, entryDate, slotHour)"
));
PREPARE alterIndex FROM @preparedStatement;
EXECUTE alterIndex;
DEALLOCATE PREPARE alterIndex;

-- 2. Add location_id to DailySummaries & compound unique key
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'DailySummaries'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE DailySummaries ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Add location_id to Feedback
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'Feedback'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE Feedback ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id, ADD INDEX idx_feedback_location (location_id, entryDate)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 4. Add location_id to CallQueue
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'CallQueue'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE CallQueue ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id, ADD INDEX idx_callqueue_location (location_id)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 5. Add location_id to Diverts
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'Diverts'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE Diverts ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id, ADD INDEX idx_diverts_location (location_id)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 6. Add location_id to CashSettlements
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'CashSettlements'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE CashSettlements ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id, ADD INDEX idx_cash_location (location_id, entryDate)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 7. Add location_id to VmSubmissions
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'VmSubmissions'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE VmSubmissions ADD COLUMN location_id INT NOT NULL DEFAULT 2 AFTER id, ADD INDEX idx_vmsub_location (location_id)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8. Add location_id to VmFloors
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'VmFloors'
      AND COLUMN_NAME = 'location_id'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE VmFloors ADD COLUMN location_id INT NULL DEFAULT 2 AFTER id, ADD INDEX idx_vmfloor_location (location_id)"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Update existing records if any had 0 or NULL
UPDATE FootfallEntries SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE DailySummaries SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE Feedback SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE CallQueue SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE Diverts SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE CashSettlements SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE VmSubmissions SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
UPDATE VmFloors SET location_id = 2 WHERE location_id = 0 OR location_id IS NULL;
