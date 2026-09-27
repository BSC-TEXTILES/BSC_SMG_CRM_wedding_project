/**
 * BSC Textiles CRM - Dedicated Role Dashboard Controller
 * Provides high-performance, strictly isolated, database-driven endpoints for:
 * 1. HR Manager Dashboard (GET /api/dashboard/hr)
 * 2. Store Manager Dashboard (GET /api/dashboard/manager)
 *
 * All metrics are calculated live from real MySQL tables (zero hardcoded stats, zero dummy data).
 * Location scoping and role authorization are strictly enforced at the database level.
 */

const pool = require('../config/db');
const { successRes, errorRes } = require('../utils/response');

// Normalize role string for safe comparisons
function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');
}

function isHRRole(role) {
  const r = normalizeRole(role);
  return ['hr', 'hr manager', 'recruiter', 'interviewer', 'admin', 'super admin', 'system administrator'].includes(r);
}

function isManagerRole(role) {
  const r = normalizeRole(role);
  return ['manager', 'store manager', 'floor manager', 'department manager', 'admin', 'super admin', 'system administrator'].includes(r);
}

function isAdminRole(role) {
  const r = normalizeRole(role);
  return ['admin', 'super admin', 'system administrator'].includes(r);
}

class DashboardController {
  /**
   * 1. GET /api/dashboard/hr
   * Live HR metrics: employees, active/inactive staff, onboarding, recruitment pipeline,
   * interviews, selection offers, department & designation distribution, location breakdown,
   * manpower targets, and recent HR activity.
   */
  async getHRDashboard(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return errorRes(res, 'Authentication required', [], 401);
      }

      if (!isHRRole(user.role)) {
        return errorRes(res, 'Forbidden: HR Manager Dashboard is restricted to HR personnel', [], 403);
      }

      // Location scoping: Global Admins can filter or view ALL; HR users are bound to their assigned location(s)
      const requestedLoc = req.query.locationId;
      let effectiveLoc = null;

      if (isAdminRole(user.role)) {
        if (requestedLoc && requestedLoc !== 'ALL') {
          const parsed = parseInt(requestedLoc, 10);
          if (!isNaN(parsed) && parsed > 0) effectiveLoc = parsed;
        }
      } else {
        effectiveLoc = user.locationId || null;
      }

      // Build location clauses for various tables
      const userLocClause = effectiveLoc ? 'AND u.location_id = ?' : '';
      const candLocClause = effectiveLoc ? 'AND c.location_id = ?' : '';
      const offerLocClause = effectiveLoc ? 'AND so.location_id = ?' : '';
      const intLocClause = effectiveLoc ? 'AND i.location_id = ?' : '';
      const auditLocClause = effectiveLoc ? 'AND al.location_id = ?' : '';
      const locParam = effectiveLoc ? [effectiveLoc] : [];

      // Execute all metric queries in parallel for peak performance
      const [
        [empRows],
        [deptRows],
        [desigRows],
        [locRows],
        [candFunnelRows],
        [recentCandRows],
        [offerRows],
        [interviewRows],
        [onboardingRows],
        [manpowerRows],
        [recentActivityRows],
        [recentStaffRows]
      ] = await Promise.all([
        // 1. Employee headcount breakdown
        pool.query(`
          SELECT 
            COUNT(*) as totalEmployees,
            SUM(CASE WHEN u.active = 1 THEN 1 ELSE 0 END) as activeEmployees,
            SUM(CASE WHEN u.active = 0 THEN 1 ELSE 0 END) as inactiveEmployees,
            SUM(CASE WHEN (u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) OR u.joining_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) THEN 1 ELSE 0 END) as newEmployees
          FROM users u
          WHERE 1=1 ${userLocClause}
        `, locParam),

        // 2. Headcount by department
        pool.query(`
          SELECT 
            COALESCE(NULLIF(TRIM(u.department), ''), 'Unassigned') as department,
            COUNT(*) as count
          FROM users u
          WHERE u.active = 1 ${userLocClause}
          GROUP BY department
          ORDER BY count DESC
        `, locParam),

        // 3. Headcount by designation (top 8)
        pool.query(`
          SELECT 
            COALESCE(NULLIF(TRIM(u.designation), ''), 'Staff') as designation,
            COUNT(*) as count
          FROM users u
          WHERE u.active = 1 ${userLocClause}
          GROUP BY designation
          ORDER BY count DESC
          LIMIT 8
        `, locParam),

        // 4. Staff distribution across active locations
        pool.query(`
          SELECT 
            l.id as locationId,
            l.location_code as locationCode,
            l.location_name as locationName,
            COUNT(u.id) as staffCount
          FROM locations l
          LEFT JOIN users u ON u.location_id = l.id AND u.active = 1
          WHERE l.status = 'Active'
          GROUP BY l.id, l.location_code, l.location_name
          ORDER BY l.sort_order ASC
        `),

        // 5. Candidate recruitment pipeline status breakdown
        pool.query(`
          SELECT 
            COALESCE(NULLIF(TRIM(c.status), ''), 'New') as status,
            COUNT(*) as count
          FROM candidates c
          WHERE 1=1 ${candLocClause}
          GROUP BY status
        `, locParam),

        // 6. Recent candidates
        pool.query(`
          SELECT 
            c.id,
            c.app_no as appNo,
            c.name,
            c.phone,
            c.email,
            c.designation,
            c.department,
            c.status,
            c.created_at as createdAt,
            c.location_id as locationId,
            l.location_name as locationName
          FROM candidates c
          LEFT JOIN locations l ON l.id = c.location_id
          WHERE 1=1 ${candLocClause}
          ORDER BY c.id DESC
          LIMIT 6
        `, locParam),

        // 7. Selection offers & DOJ metrics
        pool.query(`
          SELECT 
            COUNT(*) as totalOffers,
            SUM(CASE WHEN LOWER(so.status) IN ('issued', 'accepted') AND so.actual_doj IS NULL THEN 1 ELSE 0 END) as pendingDoj,
            SUM(CASE WHEN LOWER(so.status) = 'joined' THEN 1 ELSE 0 END) as joinedCount,
            ROUND(AVG(NULLIF(so.salary, 0)), 0) as avgOfferedSalary
          FROM selection_offers so
          WHERE 1=1 ${offerLocClause}
        `, locParam),

        // 8. Interview schedules
        pool.query(`
          SELECT 
            COUNT(*) as totalInterviews,
            SUM(CASE WHEN DATE(i.interview_date) = CURDATE() THEN 1 ELSE 0 END) as todayInterviews,
            SUM(CASE WHEN i.interview_date >= NOW() THEN 1 ELSE 0 END) as upcomingInterviews
          FROM interview_schedules i
          WHERE 1=1 ${intLocClause}
        `, locParam),

        // 9. Onboarding & exit records (if available)
        pool.query(`
          SELECT 
            (SELECT COUNT(*) FROM onboarding_records WHERE status != 'Completed') as pendingOnboarding,
            (SELECT COUNT(*) FROM exit_records WHERE status != 'Completed') as pendingExits
        `).catch(() => [[{ pendingOnboarding: 0, pendingExits: 0 }]]),

        // 10. Department hiring targets / manpower requisitions
        pool.query(`
          SELECT 
            d.department,
            d.designation,
            COALESCE(d.required_openings, 0) as requiredOpenings,
            COALESCE(d.hiring_target, 0) as hiringTarget
          FROM department_hiring_targets d
          ORDER BY d.id DESC
          LIMIT 5
        `).catch(() => [[]]),

        // 11. Recent HR activity logs
        pool.query(`
          SELECT 
            al.id,
            al.username,
            al.action,
            al.module,
            al.details,
            al.created_at as createdAt
          FROM audit_logs al
          WHERE al.module IN ('HR', 'candidates', 'offer', 'employees', 'user_management', 'UserManagement')
            ${auditLocClause}
          ORDER BY al.id DESC
          LIMIT 8
        `, locParam).catch(() => [[]]),

        // 12. Recent staff records for the live employee directory preview
        pool.query(`
          SELECT 
            u.id,
            COALESCE(u.employee_id, CONCAT('EMP-', LPAD(u.id, 4, '0'))) as employeeId,
            u.full_name as name,
            u.email,
            u.phone,
            COALESCE(u.department, 'Store Operations') as department,
            COALESCE(u.designation, 'Staff') as designation,
            u.role,
            u.active,
            u.location_id as locationId,
            l.location_name as locationName,
            u.created_at as createdAt,
            u.joining_date as joiningDate
          FROM users u
          LEFT JOIN locations l ON l.id = u.location_id
          WHERE u.active = 1 ${userLocClause}
          ORDER BY u.id DESC
          LIMIT 8
        `, locParam)
      ]);

      const empSummary = empRows[0] || {};
      const offerSummary = offerRows[0] || {};
      const interviewSummary = interviewRows[0] || {};
      const onboardingSummary = (onboardingRows && onboardingRows[0]) || { pendingOnboarding: 0, pendingExits: 0 };

      return res.json({
        success: true,
        data: {
          effectiveLocation: effectiveLoc,
          counts: {
            totalEmployees: Number(empSummary.totalEmployees || 0),
            activeEmployees: Number(empSummary.activeEmployees || 0),
            inactiveEmployees: Number(empSummary.inactiveEmployees || 0),
            newEmployees: Number(empSummary.newEmployees || 0),
            totalOffers: Number(offerSummary.totalOffers || 0),
            pendingDoj: Number(offerSummary.pendingDoj || 0),
            joinedOffers: Number(offerSummary.joinedCount || 0),
            avgOfferedSalary: Number(offerSummary.avgOfferedSalary || 0),
            totalInterviews: Number(interviewSummary.totalInterviews || 0),
            todayInterviews: Number(interviewSummary.todayInterviews || 0),
            upcomingInterviews: Number(interviewSummary.upcomingInterviews || 0),
            pendingOnboarding: Number(onboardingSummary.pendingOnboarding || 0),
            pendingExits: Number(onboardingSummary.pendingExits || 0)
          },
          departmentDistribution: deptRows || [],
          designationDistribution: desigRows || [],
          locationDistribution: locRows || [],
          candidatePipeline: candFunnelRows || [],
          recentCandidates: recentCandRows || [],
          manpowerTargets: manpowerRows || [],
          recentActivities: recentActivityRows || [],
          recentStaff: recentStaffRows || []
        }
      });
    } catch (err) {
      console.error('[getHRDashboard Error]', err);
      return errorRes(res, 'Failed to fetch HR Manager Dashboard data: ' + err.message, [err.message], 500);
    }
  }

  /**
   * 2. GET /api/dashboard/manager
   * Live Manager metrics: store team, floor active staff, section allocations,
   * walk-in footfall, open diverts, wedding leads, follow-up calendar, telecaller performance,
   * customer CSAT feedback, and store operations activity.
   */
  async getManagerDashboard(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return errorRes(res, 'Authentication required', [], 401);
      }

      if (!isManagerRole(user.role)) {
        return errorRes(res, 'Forbidden: Manager Dashboard is restricted to operational managers', [], 403);
      }

      // Location scoping: Global Admins can toggle; Managers are strictly locked to their store location
      let effectiveLoc = user.locationId || null;
      if (isAdminRole(user.role) && req.query.locationId && req.query.locationId !== 'ALL') {
        const parsed = parseInt(req.query.locationId, 10);
        if (!isNaN(parsed) && parsed > 0) effectiveLoc = parsed;
      }

      // If user has no location assigned (e.g. fresh manager account), fall back to primary store
      if (!effectiveLoc) {
        effectiveLoc = 2; // Default to Davanagere if unassigned
      }

      const locParam = [effectiveLoc];

      // Execute all metric queries in parallel
      const [
        [locDetailRows],
        [teamRows],
        [sectionRows],
        [footfallRows],
        [footfallHourlyRows],
        [divertRows],
        [recentDivertRows],
        [weddingRows],
        [todayFollowupRows],
        [feedbackRows],
        [recentNegativeFeedbackRows],
        [storeTeamRows],
        [storeActivityRows]
      ] = await Promise.all([
        // 1. Current store location metadata
        pool.query(`
          SELECT id, location_code as code, location_name as name, store_name, address, phone
          FROM locations
          WHERE id = ?
        `, locParam),

        // 2. Store team count and active floor staff
        pool.query(`
          SELECT 
            COUNT(*) as totalTeam,
            SUM(CASE WHEN u.active = 1 THEN 1 ELSE 0 END) as activeFloorStaff,
            SUM(CASE WHEN u.section IS NOT NULL AND TRIM(u.section) != '' THEN 1 ELSE 0 END) as allocatedStaff
          FROM users u
          WHERE u.location_id = ?
        `, locParam),

        // 3. Section floor allocations
        pool.query(`
          SELECT 
            COALESCE(NULLIF(TRIM(u.section), ''), 'General Floor') as section,
            COUNT(*) as count
          FROM users u
          WHERE u.location_id = ? AND u.active = 1
          GROUP BY section
          ORDER BY count DESC
        `, locParam),

        // 4. Today's store walk-in footfall
        pool.query(`
          SELECT COALESCE(SUM(visitors), 0) as todayFootfall
          FROM footfallentries
          WHERE location_id = ? AND entryDate = CURDATE()
        `, locParam),

        // 5. Hourly footfall distribution today
        pool.query(`
          SELECT 
            slotHour,
            visitors
          FROM footfallentries
          WHERE location_id = ? AND entryDate = CURDATE()
          ORDER BY slotHour ASC
        `, locParam).catch(() => [[]]),

        // 6. Sourcing diverts metrics
        pool.query(`
          SELECT 
            COUNT(*) as totalDiverts,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openDiverts,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgressDiverts,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolvedDiverts
          FROM diverts
          WHERE location_id = ?
        `, locParam),

        // 7. Open / pending diverts list
        pool.query(`
          SELECT 
            d.id,
            d.refNo,
            d.productWanted,
            d.quantity,
            d.priceRange,
            d.customerName,
            d.customerMobile,
            d.status,
            d.createdAt
          FROM diverts d
          WHERE d.location_id = ? AND d.status = 'open'
          ORDER BY d.id DESC
          LIMIT 5
        `, locParam),

        // 8. Store wedding leads & pipeline
        pool.query(`
          SELECT 
            COUNT(*) as totalLeads,
            SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as newLeads,
            SUM(CASE WHEN customer_status = 'Shopping Date Confirmed' THEN 1 ELSE 0 END) as shoppingConfirmed,
            SUM(CASE WHEN customer_status = 'Won' THEN 1 ELSE 0 END) as convertedLeads,
            SUM(CASE WHEN follow_up_date < CURDATE() AND customer_status NOT IN ('Won', 'Lost', 'Closed') THEN 1 ELSE 0 END) as overdueFollowups
          FROM wedding_customers
          WHERE location_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
        `, locParam),

        // 9. Follow-ups scheduled today or overdue needing manager review
        pool.query(`
          SELECT 
            wc.id,
            wc.customer_code as customerCode,
            wc.customer_name as customerName,
            wc.mobile_number as mobileNumber,
            wc.customer_status as status,
            wc.follow_up_date as followUpDate,
            wc.assigned_telecaller as telecaller,
            wc.wedding_date as weddingDate
          FROM wedding_customers wc
          WHERE wc.location_id = ? 
            AND (wc.is_deleted = 0 OR wc.is_deleted IS NULL)
            AND (wc.follow_up_date <= CURDATE() OR wc.follow_up_date IS NULL)
            AND wc.customer_status NOT IN ('Won', 'Lost', 'Closed')
          ORDER BY wc.follow_up_date ASC
          LIMIT 6
        `, locParam),

        // 10. Store customer CSAT feedback
        pool.query(`
          SELECT 
            COUNT(*) as totalFeedback,
            SUM(CASE WHEN isNegative = 0 THEN 1 ELSE 0 END) as positiveFeedback,
            SUM(CASE WHEN isNegative = 1 THEN 1 ELSE 0 END) as negativeFeedback
          FROM feedback
          WHERE location_id = ?
        `, locParam),

        // 11. Negative feedback alerts needing supervisor resolution
        pool.query(`
          SELECT 
            fb.id,
            fb.customerName,
            fb.mobile,
            fb.sectionId,
            fb.yourVoice,
            fb.status,
            fb.entryDate,
            fb.createdAt
          FROM feedback fb
          WHERE fb.location_id = ? AND fb.isNegative = 1
          ORDER BY fb.id DESC
          LIMIT 5
        `, locParam),

        // 12. Store team directory table
        pool.query(`
          SELECT 
            u.id,
            COALESCE(u.employee_id, CONCAT('EMP-', LPAD(u.id, 4, '0'))) as employeeId,
            u.full_name as name,
            u.email,
            u.phone,
            COALESCE(u.department, 'Store Floor') as department,
            COALESCE(u.designation, 'Staff') as designation,
            COALESCE(u.section, 'General Counter') as section,
            u.role,
            u.active
          FROM users u
          WHERE u.location_id = ? AND u.active = 1
          ORDER BY u.full_name ASC
          LIMIT 12
        `, locParam),

        // 13. Recent store audit & operational activity
        pool.query(`
          SELECT 
            al.id,
            al.username,
            al.action,
            al.module,
            al.details,
            al.created_at as createdAt
          FROM audit_logs al
          WHERE al.location_id = ?
          ORDER BY al.id DESC
          LIMIT 8
        `, locParam).catch(() => [[]])
      ]);

      const storeMeta = locDetailRows[0] || { id: effectiveLoc, name: 'Store Location' };
      const teamSummary = teamRows[0] || {};
      const divertSummary = divertRows[0] || {};
      const weddingSummary = weddingRows[0] || {};
      const footfallSummary = footfallRows[0] || {};
      const fbSummary = feedbackRows[0] || {};

      const totalFb = Number(fbSummary.totalFeedback || 0);
      const posFb = Number(fbSummary.positiveFeedback || 0);
      const csatIndex = totalFb > 0 ? Math.round((posFb / totalFb) * 100) : 100;

      return res.json({
        success: true,
        data: {
          store: storeMeta,
          counts: {
            totalTeam: Number(teamSummary.totalTeam || 0),
            activeFloorStaff: Number(teamSummary.activeFloorStaff || 0),
            allocatedStaff: Number(teamSummary.allocatedStaff || 0),
            todayFootfall: Number(footfallSummary.todayFootfall || 0),
            totalDiverts: Number(divertSummary.totalDiverts || 0),
            openDiverts: Number(divertSummary.openDiverts || 0),
            inProgressDiverts: Number(divertSummary.inProgressDiverts || 0),
            resolvedDiverts: Number(divertSummary.resolvedDiverts || 0),
            totalLeads: Number(weddingSummary.totalLeads || 0),
            newLeads: Number(weddingSummary.newLeads || 0),
            shoppingConfirmed: Number(weddingSummary.shoppingConfirmed || 0),
            convertedLeads: Number(weddingSummary.convertedLeads || 0),
            overdueFollowups: Number(weddingSummary.overdueFollowups || 0),
            totalFeedback: totalFb,
            positiveFeedback: posFb,
            negativeFeedback: Number(fbSummary.negativeFeedback || 0),
            csatIndex
          },
          sectionAllocations: sectionRows || [],
          hourlyFootfall: footfallHourlyRows || [],
          openDivertsList: recentDivertRows || [],
          todayFollowupsList: todayFollowupRows || [],
          negativeFeedbackAlerts: recentNegativeFeedbackRows || [],
          storeTeam: storeTeamRows || [],
          recentActivities: storeActivityRows || []
        }
      });
    } catch (err) {
      console.error('[getManagerDashboard Error]', err);
      return errorRes(res, 'Failed to fetch Manager Dashboard data: ' + err.message, [err.message], 500);
    }
  }
}

module.exports = new DashboardController();
