-- Default Data Seed Script for BSC Enterprise HRMS
USE `u101820758_bsc_smg_crm`;

-- Seed Users (Default passwords are set via environment variables in production)
INSERT INTO `users` (`username`, `password`, `role`, `full_name`, `active`) VALUES
('hr@bsctextiles.com', '$2b$10$aJTX5LNvHOQjpp3ljG6mo.RMJFeIs0NwH9XKTfjV2CKmTCJ/jcHte', 'HR', 'HR Admin', TRUE),
('manager@bsctextiles.com', '$2b$10$aJTX5LNvHOQjpp3ljG6mo.RMJFeIs0NwH9XKTfjV2CKmTCJ/jcHte', 'Manager', 'Store Manager', TRUE),
('admin@bsctextiles.com', '$2b$10$aJTX5LNvHOQjpp3ljG6mo.RMJFeIs0NwH9XKTfjV2CKmTCJ/jcHte', 'Admin', 'Admin', TRUE)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `password` = VALUES(`password`), `active` = VALUES(`active`);

-- Seed Designations
INSERT INTO `designations` (`role_scope`, `name`, `active`) VALUES
('All', 'Sales Executive', TRUE),
('All', 'Floor Manager', TRUE),
('All', 'Cashier', TRUE),
('All', 'Billing Executive', TRUE),
('All', 'Store Keeper', TRUE)
ON DUPLICATE KEY UPDATE `active` = VALUES(`active`);

-- Seed Interview Questions
INSERT INTO `interview_questions` (`designation`, `round`, `q_id`, `question`, `type`, `max_score`, `options`, `active`) VALUES
('All', 'HR', 1, 'Communication & confidence', 'score', 15, '', TRUE),
('All', 'HR', 2, 'Previous work experience', 'score', 15, '', TRUE),
('All', 'HR', 3, 'Textile/retail knowledge', 'score', 15, '', TRUE),
('All', 'HR', 4, 'Expected salary reasonable?', 'score', 10, '', TRUE),
('All', 'HR', 5, 'Can join immediately?', 'select', 0, 'Yes immediately,After 1 week,After 15 days,After 1 month', TRUE),
('All', 'Round 2', 1, 'Job knowledge & product skills', 'score', 20, '', TRUE),
('All', 'Round 2', 2, 'Problem solving & decision making', 'score', 15, '', TRUE),
('All', 'Round 2', 3, 'Team fit & attitude', 'score', 15, '', TRUE),
('All', 'Round 2', 4, 'Customer handling ability', 'score', 10, '', TRUE),
('All', 'Round 2', 5, 'Overall recommendation', 'score', 10, '', TRUE);

-- Seed Page Visibility Defaults
INSERT INTO `page_visibility` (`role_page_key`, `role`, `page_key`, `allowed`) VALUES
('HR_dashboard', 'HR', 'dashboard', TRUE),
('HR_candidates', 'HR', 'candidates', TRUE),
('HR_interview', 'HR', 'interview', TRUE),
('HR_offer', 'HR', 'offer', TRUE),
('HR_settings', 'HR', 'settings', FALSE),
('Manager_dashboard', 'Manager', 'dashboard', TRUE),
('Manager_candidates', 'Manager', 'candidates', TRUE),
('Manager_interview', 'Manager', 'interview', TRUE),
('Manager_offer', 'Manager', 'offer', FALSE),
('Manager_settings', 'Manager', 'settings', FALSE),
('Admin_dashboard', 'Admin', 'dashboard', TRUE),
('Admin_candidates', 'Admin', 'candidates', TRUE),
('Admin_interview', 'Admin', 'interview', TRUE),
('Admin_offer', 'Admin', 'offer', TRUE),
('Admin_settings', 'Admin', 'settings', TRUE)
ON DUPLICATE KEY UPDATE `allowed` = VALUES(`allowed`);
