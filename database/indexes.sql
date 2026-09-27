-- Database Index Optimization Script for BSC Enterprise HRMS
USE `u101820758_bsc_smg_crm`;

-- Candidate Indexes
CREATE INDEX IF NOT EXISTS `idx_candidate_email` ON `Candidate` (`email`);
CREATE INDEX IF NOT EXISTS `idx_candidate_mobile` ON `Candidate` (`mobile`);
CREATE INDEX IF NOT EXISTS `idx_candidate_code` ON `Candidate` (`candidateCode`);
CREATE INDEX IF NOT EXISTS `idx_candidate_status` ON `Candidate` (`status`);
CREATE INDEX IF NOT EXISTS `idx_candidate_designation` ON `Candidate` (`designation`);
CREATE INDEX IF NOT EXISTS `idx_candidate_created_at` ON `Candidate` (`createdAt`);

-- Employee Indexes
CREATE INDEX IF NOT EXISTS `idx_employee_code` ON `Employee` (`employeeCode`);
CREATE INDEX IF NOT EXISTS `idx_employee_email` ON `Employee` (`email`);
CREATE INDEX IF NOT EXISTS `idx_employee_mobile` ON `Employee` (`mobile`);
CREATE INDEX IF NOT EXISTS `idx_employee_joining_date` ON `Employee` (`joiningDate`);
CREATE INDEX IF NOT EXISTS `idx_employee_dept` ON `Employee` (`departmentId`);
CREATE INDEX IF NOT EXISTS `idx_employee_desig` ON `Employee` (`designationId`);
CREATE INDEX IF NOT EXISTS `idx_employee_status` ON `Employee` (`status`);

-- Interview Schedules & Panels Indexes
CREATE INDEX IF NOT EXISTS `idx_interview_date` ON `InterviewSchedule` (`interviewDate`);
CREATE INDEX IF NOT EXISTS `idx_interview_status` ON `InterviewSchedule` (`status`);
CREATE INDEX IF NOT EXISTS `idx_panel_token` ON `InterviewPanel` (`token`);
CREATE INDEX IF NOT EXISTS `idx_panel_status` ON `InterviewPanel` (`status`);

-- Offer Indexes
CREATE INDEX IF NOT EXISTS `idx_offer_status` ON `Offer` (`offerStatus`);
CREATE INDEX IF NOT EXISTS `idx_offer_est_doj` ON `Offer` (`estDoj`);
CREATE INDEX IF NOT EXISTS `idx_offer_actual_doj` ON `Offer` (`actualDoj`);

-- User & Session Indexes
CREATE INDEX IF NOT EXISTS `idx_user_email` ON `User` (`email`);
CREATE INDEX IF NOT EXISTS `idx_user_mobile` ON `User` (`mobile`);
CREATE INDEX IF NOT EXISTS `idx_user_role_id` ON `User` (`roleId`);
CREATE INDEX IF NOT EXISTS `idx_session_token` ON `UserSession` (`token`);

-- Audit & Activity Indexes
CREATE INDEX IF NOT EXISTS `idx_audit_user` ON `AuditLog` (`username`);
CREATE INDEX IF NOT EXISTS `idx_audit_module` ON `AuditLog` (`module`);
CREATE INDEX IF NOT EXISTS `idx_audit_created` ON `AuditLog` (`createdAt`);

-- Selection Offers & Candidate Join Indexes
CREATE INDEX IF NOT EXISTS `idx_so_app_no` ON `selection_offers` (`app_no`);
CREATE INDEX IF NOT EXISTS `idx_so_status` ON `selection_offers` (`status`);
CREATE INDEX IF NOT EXISTS `idx_cand_created_at` ON `candidates` (`created_at`);
CREATE INDEX IF NOT EXISTS `idx_cand_app_no` ON `candidates` (`app_no`);
CREATE INDEX IF NOT EXISTS `idx_cand_loc` ON `candidates` (`location_id`);
