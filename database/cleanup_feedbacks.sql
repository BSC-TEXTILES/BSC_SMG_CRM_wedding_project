-- ====================================================================
-- BSC Enterprise HRMS - Clean All Feedback Details & Test Records
-- Run this script in MySQL / phpMyAdmin on your database to wipe test feedback
-- ====================================================================

-- 1. Remove associated negative feedback entries from CallQueue
DELETE FROM CallQueue 
WHERE customerName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar', 'Valued Customer')
   OR mobile IN ('+919654186453', '9654186453', '+919849865416', '9849865416', '+919864685465', '9864685465', '+919987866534', '9987866534', '+919845464464', '9845464464', '+919798564168', '9798564168', '+918986541564', '8986541564', '6874685', '9741234567', '9845012345', '9876543210')
   OR LOWER(customerName) LIKE '%test%'
   OR LOWER(customerName) LIKE '%demo%'
   OR LOWER(customerName) LIKE '%trial%'
   OR feedbackId IN (
     SELECT id FROM Feedback 
     WHERE customerName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
        OR custName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
        OR LOWER(customerName) LIKE '%test%'
        OR LOWER(customerName) LIKE '%demo%'
        OR LOWER(customerName) LIKE '%trial%'
   );

-- 2. Remove all test and legacy Feedback records
DELETE FROM Feedback 
WHERE customerName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
   OR custName IN ('Trial', 'test', 'demo', 'Demo', 'Test', 'T1', 'Suresh Gowda', 'Anita Patil', 'Ramesh Kumar')
   OR mobile IN ('+919654186453', '9654186453', '+919849865416', '9849865416', '+919864685465', '9864685465', '+919987866534', '9987866534', '+919845464464', '9845464464', '+919798564168', '9798564168', '+918986541564', '8986541564', '6874685', '9741234567', '9845012345', '9876543210')
   OR custMobile IN ('+919654186453', '9654186453', '+919849865416', '9849865416', '+919864685465', '9864685465', '+919987866534', '9987866534', '+919845464464', '9845464464', '+919798564168', '9798564168', '+918986541564', '8986541564', '6874685', '9741234567', '9845012345', '9876543210')
   OR LOWER(customerName) LIKE '%test%'
   OR LOWER(customerName) LIKE '%demo%'
   OR LOWER(customerName) LIKE '%trial%'
   OR customerName = 'T1';

-- 3. Reset orphan scan references
UPDATE FeedbackQrScan SET isFeedbackSubmitted = 0, feedbackId = NULL 
WHERE feedbackId IS NOT NULL AND feedbackId NOT IN (SELECT id FROM Feedback);

-- To completely wipe ALL feedback and start 100% fresh:
-- TRUNCATE TABLE CallQueue;
-- TRUNCATE TABLE Feedback;
-- UPDATE FeedbackQrScan SET isFeedbackSubmitted = 0, feedbackId = NULL;
-- UPDATE FeedbackQrCode SET scanCount = 0;
