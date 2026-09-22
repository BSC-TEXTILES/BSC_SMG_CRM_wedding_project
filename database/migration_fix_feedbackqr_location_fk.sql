-- ============================================================
-- FIX: FeedbackQrCode.locationId foreign key constraint
-- Change FK from Company(id) to locations(id)
-- The entire feedback/QR system uses the `locations` table,
-- not the `Company` table. This migration fixes the FK mismatch.
-- Safe to re-run (idempotent).
-- ============================================================

SET @dbname = DATABASE();

-- 1. Drop the old FK constraint referencing Company(id) if it exists
SET @constraint_name = (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'FeedbackQrCode'
    AND COLUMN_NAME = 'locationId'
    AND REFERENCED_TABLE_NAME = 'Company'
  LIMIT 1
);

SET @sql = IF(
  @constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE `FeedbackQrCode` DROP FOREIGN KEY `', @constraint_name, '`'),
  'SELECT 1'
);
PREPARE drop_fk FROM @sql;
EXECUTE drop_fk;
DEALLOCATE PREPARE drop_fk;

-- 2. Add new FK referencing locations(id)
-- Only add if the column doesn't already reference locations
SET @existing_locations_fk = (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'FeedbackQrCode'
    AND COLUMN_NAME = 'locationId'
    AND REFERENCED_TABLE_NAME = 'locations'
  LIMIT 1
);

SET @sql = IF(
  @existing_locations_fk IS NULL,
  'ALTER TABLE `FeedbackQrCode` ADD CONSTRAINT `FeedbackQrCode_ibfk_location` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE add_fk FROM @sql;
EXECUTE add_fk;
DEALLOCATE PREPARE add_fk;

-- 3. Fix any existing QR codes that have locationId values not in locations table
-- Map old Company-based IDs to locations-based IDs if needed
-- BEL=1, DAV=2, SHI=3 are the same in both tables (by design in migration_location.sql)
-- But if Company had different auto-increment IDs, we need to remap

-- First, check if there are orphaned locationId values
UPDATE `FeedbackQrCode` fqc
  INNER JOIN `locations` l ON l.location_code = fqc.locationCode
SET fqc.locationId = l.id
WHERE fqc.locationId NOT IN (SELECT id FROM `locations`)
  AND fqc.locationCode IS NOT NULL;

-- 4. Verify all FeedbackQrCode.locationId values now reference valid locations
SELECT fqc.id, fqc.qrCodeId, fqc.locationId, fqc.locationCode, fqc.locationName,
       CASE WHEN l.id IS NOT NULL THEN 'VALID' ELSE 'INVALID' END as fk_status
FROM FeedbackQrCode fqc
LEFT JOIN locations l ON fqc.locationId = l.id
WHERE fqc.deletedAt IS NULL;

-- Done
SELECT 'FeedbackQrCode FK fix complete' AS migration_status;
