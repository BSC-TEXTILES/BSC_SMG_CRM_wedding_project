-- Enterprise HRMS & Recruitment Management System Database Schema
-- MySQL 8.0 - Singular Table Names (PascalCase), camelCase Columns
-- Engine: InnoDB, Charset: utf8mb4_unicode_ci

CREATE DATABASE IF NOT EXISTS `u101820758_bsc_smg_crm` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `u101820758_bsc_smg_crm`;

-- 1. Company
CREATE TABLE IF NOT EXISTS `Company` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `companyName` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `website` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `logoUrl` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Role
CREATE TABLE IF NOT EXISTS `Role` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `roleName` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Permission
CREATE TABLE IF NOT EXISTS `Permission` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `permissionName` VARCHAR(100) NOT NULL UNIQUE,
  `module` VARCHAR(100) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. RolePermission Junction
CREATE TABLE IF NOT EXISTS `RolePermission` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `roleId` INT NOT NULL,
  `permissionId` INT NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Department
CREATE TABLE IF NOT EXISTS `Department` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `departmentName` VARCHAR(150) NOT NULL UNIQUE,
  `code` VARCHAR(50) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Designation
CREATE TABLE IF NOT EXISTS `Designation` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `departmentId` INT NULL,
  `designationName` VARCHAR(150) NOT NULL UNIQUE,
  `roleScope` VARCHAR(50) NOT NULL DEFAULT 'All',
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. User
CREATE TABLE IF NOT EXISTS `User` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `roleId` INT NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `mobile` VARCHAR(20) NULL,
  `password` VARCHAR(255) NOT NULL,
  `fullName` VARCHAR(150) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'HR',
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `failedLogins` INT NOT NULL DEFAULT 0,
  `lockedUntil` TIMESTAMP NULL,
  `passwordChangedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. UserSession
CREATE TABLE IF NOT EXISTS `UserSession` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `token` VARCHAR(500) NOT NULL,
  `refreshToken` VARCHAR(500) NULL,
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `expiresAt` TIMESTAMP NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. PasswordReset
CREATE TABLE IF NOT EXISTS `PasswordReset` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `resetToken` VARCHAR(255) NOT NULL UNIQUE,
  `expiresAt` TIMESTAMP NOT NULL,
  `used` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Candidate
CREATE TABLE IF NOT EXISTS `Candidate` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidateCode` VARCHAR(50) NOT NULL UNIQUE,
  `appNo` VARCHAR(50) NOT NULL UNIQUE,
  `candidateName` VARCHAR(150) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(150) NULL,
  `dob` DATE NULL,
  `gender` VARCHAR(20) NULL,
  `cityState` VARCHAR(150) NULL,
  `address` TEXT NULL,
  `designationId` INT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `occupation` VARCHAR(150) NULL,
  `qualification` VARCHAR(100) NULL,
  `experience` VARCHAR(100) NULL,
  `currentSalary` VARCHAR(50) NULL,
  `expectedSalary` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `noticePeriod` VARCHAR(100) NULL,
  `ownVehicle` VARCHAR(10) NULL DEFAULT 'No',
  `source` VARCHAR(50) NOT NULL DEFAULT 'Walk-in',
  `referrer` VARCHAR(150) NULL,
  `referrerEmpNo` VARCHAR(50) NULL,
  `sourceDetail` VARCHAR(255) NULL,
  `q1` TEXT NULL,
  `q2` TEXT NULL,
  `q3` TEXT NULL,
  `q4` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'New',
  `daysInPipeline` INT NOT NULL DEFAULT 0,
  `salary` VARCHAR(50) NULL,
  `resumeUrl` TEXT NULL,
  `photoUrl` TEXT NULL,
  `aadharUrl` TEXT NULL,
  `remarks` TEXT NULL,
  `isDuplicatePhone` VARCHAR(10) NOT NULL DEFAULT 'No',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. CandidateDocument
CREATE TABLE IF NOT EXISTS `CandidateDocument` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidateId` INT NOT NULL,
  `documentType` VARCHAR(50) NOT NULL, -- 'Resume', 'Photo', 'Aadhar', 'Other'
  `fileName` VARCHAR(255) NOT NULL,
  `filePath` TEXT NOT NULL,
  `fileSize` INT NOT NULL DEFAULT 0,
  `fileExtension` VARCHAR(20) NOT NULL,
  `uploadedBy` INT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. CandidateHistory / ActivityLog
CREATE TABLE IF NOT EXISTS `CandidateHistory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidateId` INT NOT NULL,
  `appNo` VARCHAR(50) NOT NULL,
  `actionType` VARCHAR(50) NOT NULL,
  `icon` VARCHAR(10) NULL DEFAULT '📋',
  `label` VARCHAR(150) NOT NULL,
  `score` INT NULL,
  `maxScore` INT NULL,
  `remarks` TEXT NULL,
  `assignedBy` VARCHAR(150) NULL,
  `byUser` VARCHAR(150) NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT 'navy',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. InterviewRound
CREATE TABLE IF NOT EXISTS `InterviewRound` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `designation` VARCHAR(100) NOT NULL DEFAULT 'All',
  `roundName` VARCHAR(100) NOT NULL, -- 'HR', 'Round 2', etc.
  `qId` INT NOT NULL DEFAULT 1,
  `question` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'score',
  `maxScore` INT NOT NULL DEFAULT 10,
  `options` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. InterviewSchedule
CREATE TABLE IF NOT EXISTS `InterviewSchedule` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidateId` INT NOT NULL,
  `appNo` VARCHAR(50) NOT NULL,
  `candidateName` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `call1Date` TIMESTAMP NULL,
  `call1Remarks` TEXT NULL,
  `call2Date` TIMESTAMP NULL,
  `call2Remarks` TEXT NULL,
  `interviewDate` TIMESTAMP NULL,
  `interviewRemarks` TEXT NULL,
  `step` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. InterviewPanel / Token
CREATE TABLE IF NOT EXISTS `InterviewPanel` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `candidateId` INT NOT NULL,
  `appNo` VARCHAR(50) NOT NULL,
  `candidateName` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `assignedName` VARCHAR(150) NOT NULL,
  `assignedDesignation` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `scoresJson` LONGTEXT NULL,
  `remarks` TEXT NULL,
  `completedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. InterviewFeedback / Evaluation
CREATE TABLE IF NOT EXISTS `InterviewFeedback` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidateId` INT NOT NULL,
  `appNo` VARCHAR(50) NOT NULL UNIQUE,
  `hrScoreJson` LONGTEXT NULL,
  `assignedScoreJson` LONGTEXT NULL,
  `isNewRole` BOOLEAN NOT NULL DEFAULT FALSE,
  `suggestedDesignation` VARCHAR(100) NULL,
  `suggestionReason` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Offer
CREATE TABLE IF NOT EXISTS `Offer` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `candidateId` INT NOT NULL,
  `appNo` VARCHAR(50) NOT NULL UNIQUE,
  `candidateName` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `noticePeriod` VARCHAR(100) NULL,
  `estDoj` DATE NULL,
  `actualDoj` DATE NULL,
  `call1Date` TIMESTAMP NULL,
  `call1Remarks` TEXT NULL,
  `call2Date` TIMESTAMP NULL,
  `call2Remarks` TEXT NULL,
  `confirmDate` TIMESTAMP NULL,
  `confirmRemarks` TEXT NULL,
  `offerStatus` VARCHAR(50) NOT NULL DEFAULT 'Pending Accept',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. OfferDocument
CREATE TABLE IF NOT EXISTS `OfferDocument` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `offerId` INT NOT NULL,
  `documentType` VARCHAR(50) NOT NULL, -- 'Offer Letter', 'Signed Offer', etc.
  `fileName` VARCHAR(255) NOT NULL,
  `filePath` TEXT NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Employee
CREATE TABLE IF NOT EXISTS `Employee` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employeeCode` VARCHAR(50) NOT NULL UNIQUE,
  `candidateId` INT NULL,
  `fullName` VARCHAR(150) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(150) NULL,
  `departmentId` INT NULL,
  `designationId` INT NULL,
  `joiningDate` DATE NOT NULL,
  `salary` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. EmployeeDocument
CREATE TABLE IF NOT EXISTS `EmployeeDocument` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employeeId` INT NOT NULL,
  `documentType` VARCHAR(50) NOT NULL, -- 'Relieving Letter', 'Experience Certificate', 'Passport', 'Pan Card', 'Aadhar'
  `fileName` VARCHAR(255) NOT NULL,
  `filePath` TEXT NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Attendance
CREATE TABLE IF NOT EXISTS `Attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employeeId` INT NOT NULL,
  `attendanceDate` DATE NOT NULL,
  `inTime` TIME NULL,
  `outTime` TIME NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Present', -- 'Present', 'Absent', 'Half Day', 'Leave'
  `remarks` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. LeaveRequest
CREATE TABLE IF NOT EXISTS `LeaveRequest` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employeeId` INT NOT NULL,
  `leaveType` VARCHAR(50) NOT NULL, -- 'Casual', 'Sick', 'Earned', 'Unpaid'
  `fromDate` DATE NOT NULL,
  `toDate` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
  `approvedBy` INT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Holiday
CREATE TABLE IF NOT EXISTS `Holiday` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `holidayName` VARCHAR(150) NOT NULL,
  `holidayDate` DATE NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Onboarding
CREATE TABLE IF NOT EXISTS `Onboarding` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recordId` VARCHAR(50) NOT NULL UNIQUE,
  `candidateId` INT NULL,
  `empName` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `joiningDate` DATE NOT NULL,
  `progress` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'On Track',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. ExitRequest
CREATE TABLE IF NOT EXISTS `ExitRequest` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `recordId` VARCHAR(50) NOT NULL UNIQUE,
  `employeeId` INT NULL,
  `empName` VARCHAR(150) NOT NULL,
  `designation` VARCHAR(100) NOT NULL,
  `lwd` DATE NOT NULL, -- Last Working Day
  `progress` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. ExitDocument
CREATE TABLE IF NOT EXISTS `ExitDocument` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `exitRequestId` INT NOT NULL,
  `documentType` VARCHAR(50) NOT NULL, -- 'No Dues', 'Clearance Slip', 'FnF Settlement'
  `fileName` VARCHAR(255) NOT NULL,
  `filePath` TEXT NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`exitRequestId`) REFERENCES `ExitRequest`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Asset
CREATE TABLE IF NOT EXISTS `Asset` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `assetName` VARCHAR(150) NOT NULL,
  `assetCode` VARCHAR(50) NOT NULL UNIQUE,
  `category` VARCHAR(100) NOT NULL,
  `assignedTo` INT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Available', -- 'Available', 'Assigned', 'In Repair', 'Retired'
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`assignedTo`) REFERENCES `Employee`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. Notification
CREATE TABLE IF NOT EXISTS `Notification` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `readStatus` BOOLEAN NOT NULL DEFAULT FALSE,
  `link` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 29. EmailTemplate
CREATE TABLE IF NOT EXISTS `EmailTemplate` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `templateName` VARCHAR(100) NOT NULL UNIQUE,
  `subject` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `variables` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 30. SMSLog
CREATE TABLE IF NOT EXISTS `SMSLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mobile` VARCHAR(20) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Sent',
  `response` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 31. ActivityLog
CREATE TABLE IF NOT EXISTS `ActivityLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NULL,
  `module` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 32. AuditLog
CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NULL,
  `username` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `oldValue` LONGTEXT NULL,
  `newValue` LONGTEXT NULL,
  `details` TEXT NULL,
  `ipAddress` VARCHAR(45) NULL,
  `browser` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 33. Report
CREATE TABLE IF NOT EXISTS `Report` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reportName` VARCHAR(150) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `format` VARCHAR(20) NOT NULL DEFAULT 'CSV', -- 'CSV', 'Excel', 'PDF'
  `generatedBy` INT NULL,
  `filePath` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  FOREIGN KEY (`generatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 34. Setting / SystemSetting
CREATE TABLE IF NOT EXISTS `Setting` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `settingKey` VARCHAR(100) NOT NULL UNIQUE,
  `settingValue` TEXT NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'General',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 35. PageVisibility
CREATE TABLE IF NOT EXISTS `PageVisibility` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rolePageKey` VARCHAR(100) NOT NULL UNIQUE,
  `role` VARCHAR(50) NOT NULL,
  `pageKey` VARCHAR(50) NOT NULL,
  `allowed` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 36. Sections (Store Floor Departments/Sections)
CREATE TABLE IF NOT EXISTS `Sections` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `sectionType` VARCHAR(50) DEFAULT 'retail',
  `manager` VARCHAR(100) NULL,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 37. FootfallEntries (Hourly Store Visitor Tracking)
-- Uniqueness must include location_id: a per-(date, slot) key lets one store's
-- save overwrite another store's via ON DUPLICATE KEY UPDATE.
CREATE TABLE IF NOT EXISTS `FootfallEntries` (
  `id` VARCHAR(50) PRIMARY KEY,
  `location_id` INT NOT NULL DEFAULT 2,
  `entryDate` DATE NOT NULL,
  `slotHour` INT NOT NULL,
  `visitors` INT NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `submittedBy` VARCHAR(100) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_loc_date_slot` (`location_id`, `entryDate`, `slotHour`),
  INDEX `idx_footfall_date` (`entryDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 38. DailySummaries (Daily Store Operational Bill Tallies)
CREATE TABLE IF NOT EXISTS `DailySummaries` (
  `id` VARCHAR(50) PRIMARY KEY,
  `entryDate` DATE NOT NULL UNIQUE,
  `billsCount` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 39. FeedbackQuestions (Dynamic Customer Survey Questions)
CREATE TABLE IF NOT EXISTS `FeedbackQuestions` (
  `id` VARCHAR(50) PRIMARY KEY,
  `question` TEXT NOT NULL,
  `options` JSON NULL,
  `position` INT DEFAULT 0,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 40. Feedback (Customer Feedback Submissions)
CREATE TABLE IF NOT EXISTS `Feedback` (
  `id` VARCHAR(50) PRIMARY KEY,
  `entryDate` DATE NOT NULL,
  `customerName` VARCHAR(150) NULL,
  `mobile` VARCHAR(20) NULL,
  `dob` DATE NULL,
  `sectionId` VARCHAR(50) NULL,
  `answers` JSON NULL,
  `voice` TEXT NULL,
  `source` VARCHAR(20) DEFAULT 'qr',
  `isNegative` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 41. CallQueue (Negative Customer Feedback Escalation Queue)
CREATE TABLE IF NOT EXISTS `CallQueue` (
  `id` VARCHAR(50) PRIMARY KEY,
  `feedbackId` VARCHAR(50) NOT NULL,
  `entryDate` DATE NOT NULL,
  `customerName` VARCHAR(150) NULL,
  `mobile` VARCHAR(20) NULL,
  `status` VARCHAR(20) DEFAULT 'new',
  `notes` TEXT NULL,
  `attempts` INT DEFAULT 0,
  `escalated` BOOLEAN DEFAULT FALSE,
  `followUpDate` DATE NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 42. DivertReasons (Reason Codes for Sourcing Diverts)
CREATE TABLE IF NOT EXISTS `DivertReasons` (
  `id` VARCHAR(50) PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `label` VARCHAR(150) NOT NULL,
  `isActive` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 43. Diverts (Merchandise Sourcing Divert Requests)
-- Column list mirrors what crmController.createDivert writes. Keep the two in
-- sync: a missing column here makes every sourcing divert INSERT fail on a
-- fresh install even though the API answers 200 for reads.
CREATE TABLE IF NOT EXISTS `Diverts` (
  `id` VARCHAR(64) PRIMARY KEY,
  `location_id` INT NOT NULL DEFAULT 2,
  `refNo` INT AUTO_INCREMENT UNIQUE KEY,
  `entryDate` DATE NOT NULL,
  `sectionId` VARCHAR(150) NULL,
  `productWanted` TEXT NOT NULL,
  `quantity` INT DEFAULT 1,
  `priceRange` VARCHAR(128) NULL,
  `reasonCode` VARCHAR(64) NULL DEFAULT 'OUT_OF_STOCK',
  `customerName` VARCHAR(150) NULL,
  `customerMobile` VARCHAR(32) NULL,
  `status` VARCHAR(32) NULL DEFAULT 'open',
  `createdBy` VARCHAR(100) NULL,
  `pmNotes` TEXT NULL,
  `size` VARCHAR(64) NULL,
  `colour` VARCHAR(64) NULL,
  `other_product_details` TEXT NULL,
  `required_by_date` VARCHAR(32) NULL,
  `reference_image` VARCHAR(512) NULL,
  `remarks` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_diverts_loc` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 44. DivertUpdates (Audit Log Trail for Sourcing Diverts)
CREATE TABLE IF NOT EXISTS `DivertUpdates` (
  `id` VARCHAR(50) PRIMARY KEY,
  `divertId` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `note` TEXT NULL,
  `actorId` VARCHAR(50) NULL,
  `actorRole` VARCHAR(50) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_divert_updates_divert` (`divertId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45. CashSettlements (Daily POS Counter Cash Settlement Headers)
CREATE TABLE IF NOT EXISTS `CashSettlements` (
  `id` VARCHAR(50) PRIMARY KEY,
  `entryDate` DATE NOT NULL UNIQUE,
  `saleAmount` DECIMAL(12,2) DEFAULT 0.00,
  `billsCount` INT DEFAULT 0,
  `cashTotal` DECIMAL(12,2) DEFAULT 0.00,
  `cardTotal` DECIMAL(12,2) DEFAULT 0.00,
  `upiTotal` DECIMAL(12,2) DEFAULT 0.00,
  `submittedBy` VARCHAR(50) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 46. CashCounterReports (POS Cashier Breakdown Items)
CREATE TABLE IF NOT EXISTS `CashCounterReports` (
  `id` VARCHAR(50) PRIMARY KEY,
  `settlementId` VARCHAR(50) NOT NULL,
  `counterName` VARCHAR(100) NOT NULL,
  `cashierName` VARCHAR(150) NOT NULL,
  `billsCount` INT DEFAULT 0,
  `saleAmount` DECIMAL(12,2) DEFAULT 0.00,
  `cashAmount` DECIMAL(12,2) DEFAULT 0.00,
  `cardAmount` DECIMAL(12,2) DEFAULT 0.00,
  `upiAmount` DECIMAL(12,2) DEFAULT 0.00,
  `staffDiscount` DECIMAL(12,2) DEFAULT 0.00,
  `customerDiscount` DECIMAL(12,2) DEFAULT 0.00,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 47. VmChecklistPoints (Visual Merchandising Inspection Criteria)
CREATE TABLE IF NOT EXISTS `VmChecklistPoints` (
  `id` VARCHAR(50) PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `section` VARCHAR(100) DEFAULT 'General',
  `position` INT DEFAULT 0,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 48. VmSubmissions (VM Inspection Submission Header)
CREATE TABLE IF NOT EXISTS `VmSubmissions` (
  `id` VARCHAR(50) PRIMARY KEY,
  `entryDate` DATE NOT NULL,
  `shift` VARCHAR(20) DEFAULT 'Opening',
  `floor` VARCHAR(50) DEFAULT '1st Floor',
  `scorePercent` DECIMAL(5,2) DEFAULT 0.00,
  `submittedBy` VARCHAR(50) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 49. VmSubmissionEntries (VM Inspection Individual Point Scores)
CREATE TABLE IF NOT EXISTS `VmSubmissionEntries` (
  `id` VARCHAR(50) PRIMARY KEY,
  `submissionId` VARCHAR(50) NOT NULL,
  `pointId` VARCHAR(50) NOT NULL,
  `pointTitle` VARCHAR(255) NOT NULL,
  `score` VARCHAR(10) NOT NULL DEFAULT 'Pass',
  `remarks` TEXT NULL,
  `photoUrl` TEXT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 50. Shifts (Store Operational Staff Shift Definitions)
CREATE TABLE IF NOT EXISTS `Shifts` (
  `id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `startTime` TIME NOT NULL,
  `endTime` TIME NOT NULL,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 51. AttendanceRecords (Staff Attendance Check-In / Check-Out Logs)
CREATE TABLE IF NOT EXISTS `AttendanceRecords` (
  `id` VARCHAR(50) PRIMARY KEY,
  `entryDate` DATE NOT NULL,
  `userId` VARCHAR(50) NOT NULL,
  `shiftId` VARCHAR(50) NULL,
  `status` VARCHAR(20) DEFAULT 'Present',
  `checkIn` DATETIME NULL,
  `checkOut` DATETIME NULL,
  `workedMinutes` INT DEFAULT 0,
  `markedBy` VARCHAR(50) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_user_date` (`userId`, `entryDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 52. RosterEntries (Planned Shift Assignments)
CREATE TABLE IF NOT EXISTS `RosterEntries` (
  `id` VARCHAR(50) PRIMARY KEY,
  `entryDate` DATE NOT NULL,
  `userId` VARCHAR(50) NOT NULL,
  `shiftId` VARCHAR(50) NOT NULL,
  `notes` TEXT NULL,
  `createdBy` VARCHAR(50) NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_roster_user_date` (`userId`, `entryDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 53. Broadcast (Store Broadcast Announcement Messages)
CREATE TABLE IF NOT EXISTS `Broadcast` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `category` VARCHAR(50) DEFAULT 'General',
  `priority` VARCHAR(20) DEFAULT 'normal',
  `created_by` VARCHAR(100) DEFAULT 'Admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 54. Feedback (Customer Feedback Repository)
CREATE TABLE IF NOT EXISTS `Feedback` (
  `id` VARCHAR(64) PRIMARY KEY,
  `date` VARCHAR(32) NULL,
  `source` VARCHAR(32) DEFAULT 'qr',
  `area` VARCHAR(150) NULL,
  `yourVoice` TEXT NULL,
  `custName` VARCHAR(255) NULL,
  `custMobile` VARCHAR(32) NULL,
  `custDob` VARCHAR(32) NULL,
  `q0` VARCHAR(255) NULL,
  `q0_other` VARCHAR(255) NULL,
  `q1` VARCHAR(255) NULL,
  `q1_other` VARCHAR(255) NULL,
  `q2` VARCHAR(255) NULL,
  `q2_other` VARCHAR(255) NULL,
  `q3` VARCHAR(255) NULL,
  `q3_other` VARCHAR(255) NULL,
  `q4` VARCHAR(255) NULL,
  `q4_other` VARCHAR(255) NULL,
  `q5` VARCHAR(255) NULL,
  `q5_other` VARCHAR(255) NULL,
  `q6` VARCHAR(255) NULL,
  `q6_other` VARCHAR(255) NULL,
  `q7` VARCHAR(255) NULL,
  `q7_other` VARCHAR(255) NULL,
  `status` VARCHAR(32) DEFAULT 'new',
  `actionTaken` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  `isNegative` TINYINT(1) DEFAULT 0,
  `answers` TEXT NULL,
  `voice` TEXT NULL,
  `entryDate` VARCHAR(32) NULL,
  `customerName` VARCHAR(255) NULL,
  `mobile` VARCHAR(32) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

