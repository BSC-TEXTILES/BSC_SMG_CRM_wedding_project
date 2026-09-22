const { pool } = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');
const { getLocationFilter } = require('../middleware/auth');

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userFullName = req.user?.fullName;
    const isAdmin = ['Super Admin', 'Admin'].includes(userRole);

    const { clause: locClause, params: locParams } = await getLocationFilter(req, '');
    const { clause: wLocClause, params: wLocParams } = await getLocationFilter(req, 'w');

    let callerClause = '';
    const callerParams = [];
    if (!isAdmin) {
      callerClause = ' AND (assigned_telecaller_id = ? OR assigned_telecaller = ?)';
      callerParams.push(userId, userFullName);
    }

    const customerParams = [...locParams, ...callerParams];
    const customerFilter = `${locClause}${callerClause}`;

    const [totalCustomersRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 ${customerFilter}`,
      customerParams
    );
    const totalCustomers = totalCustomersRows[0]?.total || 0;

    const [todayFollowUpRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND follow_up_date = CURDATE() ${customerFilter}`,
      customerParams
    );
    const todayFollowUps = todayFollowUpRows[0]?.total || 0;

    const [overdueFollowUpRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND follow_up_date < CURDATE() AND customer_status NOT IN ('Converted','Closed','Cancelled','Visited') ${customerFilter}`,
      customerParams
    );
    const overdueFollowUps = overdueFollowUpRows[0]?.total || 0;

    const [upcomingFollowUpRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND follow_up_date > CURDATE() AND follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) ${customerFilter}`,
      customerParams
    );
    const upcomingFollowUps = upcomingFollowUpRows[0]?.total || 0;

    let callLogFilter = `${wLocClause}`;
    const callLogParams = [...wLocParams];
    if (!isAdmin) {
      callLogFilter += ' AND (c.telecaller_id = ? OR c.telecaller_name = ?)';
      callLogParams.push(userId, userFullName);
    }

    const [callsCompletedTodayRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE c.call_date = CURDATE() AND w.is_deleted = 0 ${callLogFilter}`,
      callLogParams
    );
    const callsCompletedToday = callsCompletedTodayRows[0]?.total || 0;

    const [totalCallsRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE w.is_deleted = 0 ${callLogFilter}`,
      callLogParams
    );
    const totalCalls = totalCallsRows[0]?.total || 0;

    const [noAnswerTodayRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE c.call_date = CURDATE() AND c.call_outcome = 'No Answer' AND w.is_deleted = 0 ${callLogFilter}`,
      callLogParams
    );
    const noAnswerToday = noAnswerTodayRows[0]?.total || 0;

    const [convertedRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND customer_status = 'Converted' ${customerFilter}`,
      customerParams
    );
    const convertedCount = convertedRows[0]?.total || 0;

    const followUpCompletionRate = todayFollowUps + overdueFollowUps > 0
      ? ((todayFollowUps / (todayFollowUps + overdueFollowUps)) * 100).toFixed(1)
      : 0;

    const [statusRows] = await pool.query(
      `SELECT customer_status, COUNT(*) AS count FROM wedding_customers WHERE is_deleted = 0 ${customerFilter} GROUP BY customer_status`,
      customerParams
    );
    const statusBreakdown = {};
    statusRows.forEach(row => {
      statusBreakdown[row.customer_status || 'Unknown'] = row.count;
    });

    return successRes(res, {
      totalCustomers,
      todayFollowUps,
      overdueFollowUps,
      upcomingFollowUps,
      callsCompletedToday,
      totalCalls,
      noAnswerToday,
      convertedCount,
      followUpCompletionRate: Number(followUpCompletionRate),
      statusBreakdown,
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return errorRes(res, 'Failed to fetch dashboard stats');
  }
};

const getFollowUpPipeline = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userFullName = req.user?.fullName;
    const isAdmin = ['Super Admin', 'Admin'].includes(userRole);

    const { clause: wLocClause, params: wLocParams } = await getLocationFilter(req, 'w');

    let callerClause = '';
    const callerParams = [];
    if (!isAdmin) {
      callerClause = ' AND (w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)';
      callerParams.push(userId, userFullName);
    }

    const customerFilter = `${wLocClause}${callerClause}`;
    const customerParams = [...wLocParams, ...callerParams];

    const baseSelect = `
      SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.wedding_date,
        w.expected_shopping_date, w.preferred_shopping_category, w.estimated_family_size,
        w.follow_up_date, w.preferred_call_time, w.customer_status, w.call_status,
        w.total_calls_count, w.last_call_date, w.last_call_outcome,
        l.location_name, l.location_code,
        DATEDIFF(CURDATE(), w.follow_up_date) AS overdue_days,
        DATEDIFF(w.follow_up_date, CURDATE()) AS days_until,
        (SELECT COUNT(*) FROM wedding_call_logs cl WHERE cl.customer_id = w.id) AS total_calls_count
      FROM wedding_customers w
      LEFT JOIN locations l ON w.location_id = l.id
      WHERE w.is_deleted = 0 ${customerFilter}
    `;

    const [todayRows] = await pool.query(
      `${baseSelect} AND w.follow_up_date = CURDATE() ORDER BY w.preferred_call_time ASC`,
      customerParams
    );

    const [overdueRows] = await pool.query(
      `${baseSelect} AND w.follow_up_date < CURDATE() AND w.customer_status NOT IN ('Converted','Closed','Cancelled','Visited') ORDER BY w.follow_up_date ASC`,
      customerParams
    );

    const [upcomingRows] = await pool.query(
      `${baseSelect} AND w.follow_up_date > CURDATE() AND w.follow_up_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) ORDER BY w.follow_up_date ASC LIMIT 20`,
      customerParams
    );

    const [callbackRows] = await pool.query(
      `SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.wedding_date,
        w.expected_shopping_date, w.preferred_shopping_category, w.estimated_family_size,
        w.follow_up_date, w.preferred_call_time, w.customer_status, w.call_status,
        w.total_calls_count, w.last_call_date, w.last_call_outcome,
        l.location_name, l.location_code,
        (SELECT COUNT(*) FROM wedding_call_logs cl WHERE cl.customer_id = w.id) AS total_calls_count
      FROM wedding_customers w
      LEFT JOIN locations l ON w.location_id = l.id
      WHERE w.is_deleted = 0 AND w.call_status = 'Call Back Requested' ${customerFilter}
      ORDER BY w.updated_at DESC LIMIT 20`,
      customerParams
    );

    return successRes(res, {
      todayFollowUps: todayRows,
      overdueFollowUps: overdueRows,
      upcomingFollowUps: upcomingRows,
      callbackRequests: callbackRows,
    });
  } catch (error) {
    console.error('getFollowUpPipeline error:', error);
    return errorRes(res, 'Failed to fetch follow-up pipeline');
  }
};

const getCallHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userFullName = req.user?.fullName;
    const isAdmin = ['Super Admin', 'Admin'].includes(userRole);

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const { date } = req.query;

    const { clause: wLocClause, params: wLocParams } = await getLocationFilter(req, 'w');

    let callerClause = '';
    const callerParams = [];
    if (!isAdmin) {
      callerClause = ' AND (c.telecaller_id = ? OR c.telecaller_name = ?)';
      callerParams.push(userId, userFullName);
    }

    let dateFilter = '';
    const dateParams = [];
    if (date) {
      dateFilter = ' AND c.call_date = ?';
      dateParams.push(date);
    }

    const callLogFilter = `${wLocClause}${callerClause}${dateFilter}`;
    const callLogParams = [...wLocParams, ...callerParams, ...dateParams];

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM wedding_call_logs c
       JOIN wedding_customers w ON c.customer_id = w.id
       WHERE w.is_deleted = 0 ${callLogFilter}`,
      callLogParams
    );
    const total = countRows[0]?.total || 0;

    const query = `
      SELECT c.id, c.customer_id, c.call_date, c.call_time, c.telecaller_name, c.telecaller_id,
        c.call_status, c.call_outcome, c.remarks, c.next_follow_up_date, c.next_follow_up_time,
        c.expected_shopping_date_updated, c.created_at,
        w.customer_name, w.mobile_number, w.customer_code, w.customer_status,
        l.location_name, l.location_code
      FROM wedding_call_logs c
      JOIN wedding_customers w ON c.customer_id = w.id
      LEFT JOIN locations l ON w.location_id = l.id
      WHERE w.is_deleted = 0 ${callLogFilter}
      ORDER BY c.call_date DESC, c.call_time DESC
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...callLogParams, limit, offset];

    const [callHistory] = await pool.query(query, queryParams);

    return successRes(res, {
      callHistory,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('getCallHistory error:', error);
    return errorRes(res, 'Failed to fetch call history');
  }
};

const getPerformanceMetrics = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userFullName = req.user?.fullName;
    const isAdmin = ['Super Admin', 'Admin'].includes(userRole);

    const period = req.query.period || 'today';

    let periodCondition = '';
    if (period === 'week') {
      periodCondition = ' AND c.call_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      periodCondition = ' AND c.call_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    } else {
      periodCondition = ' AND c.call_date = CURDATE()';
    }

    const { clause: locClause, params: locParams } = await getLocationFilter(req, '');
    const { clause: wLocClause, params: wLocParams } = await getLocationFilter(req, 'w');

    let callerClause = '';
    const callerParams = [];
    if (!isAdmin) {
      callerClause = ' AND (assigned_telecaller_id = ? OR assigned_telecaller = ?)';
      callerParams.push(userId, userFullName);
    }

    const customerParams = [...locParams, ...callerParams];
    const customerFilter = `${locClause}${callerClause}`;

    let callLogFilter = `${wLocClause}`;
    const callLogParams = [...wLocParams];
    if (!isAdmin) {
      callLogFilter += ' AND (c.telecaller_id = ? OR c.telecaller_name = ?)';
      callLogParams.push(userId, userFullName);
    }

    const [totalAssignedRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND assigned_telecaller_id IS NOT NULL ${customerFilter}`,
      customerParams
    );
    const totalAssigned = totalAssignedRows[0]?.total || 0;

    const [totalCallsRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE w.is_deleted = 0 ${callLogFilter}${periodCondition}`,
      [...callLogParams]
    );
    const totalCalls = totalCallsRows[0]?.total || 0;

    const [contactedRows] = await pool.query(
      `SELECT COUNT(DISTINCT c.customer_id) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE w.is_deleted = 0 AND c.call_outcome != 'No Answer' ${callLogFilter}${periodCondition}`,
      [...callLogParams]
    );
    const contactedCount = contactedRows[0]?.total || 0;

    const [connectedRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE w.is_deleted = 0 AND c.call_status = 'Connected' ${callLogFilter}${periodCondition}`,
      [...callLogParams]
    );
    const connectedCount = connectedRows[0]?.total || 0;

    const [noAnswerRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_call_logs c JOIN wedding_customers w ON c.customer_id = w.id WHERE w.is_deleted = 0 AND c.call_outcome = 'No Answer' ${callLogFilter}${periodCondition}`,
      [...callLogParams]
    );
    const noAnswerCount = noAnswerRows[0]?.total || 0;

    const [convertedRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND customer_status = 'Converted' ${customerFilter}`,
      customerParams
    );
    const convertedCount = convertedRows[0]?.total || 0;

    let convertedPeriodFilter = '';
    const convertedPeriodParams = [...customerParams];
    if (period === 'week') {
      convertedPeriodFilter = ' AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      convertedPeriodFilter = ' AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    } else {
      convertedPeriodFilter = ' AND DATE(updated_at) = CURDATE()';
    }

    const [convertedThisPeriodRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wedding_customers WHERE is_deleted = 0 AND customer_status = 'Converted' ${customerFilter}${convertedPeriodFilter}`,
      convertedPeriodParams
    );
    const convertedThisPeriod = convertedThisPeriodRows[0]?.total || 0;

    const connectionRate = totalCalls > 0
      ? ((connectedCount / totalCalls) * 100).toFixed(1)
      : 0;

    const contactRate = totalCalls > 0
      ? ((contactedCount / totalCalls) * 100).toFixed(1)
      : 0;

    return successRes(res, {
      totalAssigned,
      totalCalls,
      contactedCount,
      connectedCount,
      noAnswerCount,
      convertedCount,
      convertedThisPeriod,
      connectionRate: Number(connectionRate),
      contactRate: Number(contactRate),
    });
  } catch (error) {
    console.error('getPerformanceMetrics error:', error);
    return errorRes(res, 'Failed to fetch performance metrics');
  }
};

const getCustomerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userFullName = req.user?.fullName;
    const isAdmin = ['Super Admin', 'Admin'].includes(userRole);

    const [customerRows] = await pool.query(
      `SELECT w.*, l.location_name, l.location_code
       FROM wedding_customers w
       LEFT JOIN locations l ON w.location_id = l.id
       WHERE w.id = ? AND w.is_deleted = 0`,
      [id]
    );

    if (customerRows.length === 0) {
      return errorRes(res, 'Customer not found', [], 404);
    }

    const customer = customerRows[0];

    // Verify location isolation for non-global admins
    if (!isAdmin) {
      let allowed = req.user?.allowedLocations;
      if (!Array.isArray(allowed) || allowed.length === 0) {
        allowed = req.user?.locationId ? [req.user.locationId] : [];
      }
      if (allowed.length > 0 && !allowed.includes(customer.location_id)) {
        return errorRes(res, 'Access denied: customer belongs to another location', [], 403);
      }

      const matchesAssignedId = customer.assigned_telecaller_id === userId;
      const matchesAssignedName = customer.assigned_telecaller === userFullName;
      const matchesLocation = req.user?.locationId && customer.location_id === req.user?.locationId;

      if (!matchesAssignedId && !matchesAssignedName && !matchesLocation) {
        return errorRes(res, 'Access denied: customer not assigned to you', [], 403);
      }
    }

    const [callLogs] = await pool.query(
      `SELECT * FROM wedding_call_logs WHERE customer_id = ? ORDER BY call_date DESC, call_time DESC`,
      [id]
    );

    const communications = callLogs.map(log => ({
      type: 'call',
      date: log.call_date,
      time: log.call_time,
      status: log.call_status,
      outcome: log.call_outcome,
      remarks: log.remarks,
      telecaller: log.telecaller_name,
    }));

    const statusHistory = [];
    if (customer.customer_status) {
      statusHistory.push({
        status: customer.customer_status,
        updated_at: customer.updated_at,
      });
    }

    await logAction({
      user_id: userId,
      action: 'VIEW_CUSTOMER_DETAIL',
      details: JSON.stringify({ customer_id: id }),
    });

    return successRes(res, {
      customer,
      call_logs: callLogs,
      notes: customer.customer_notes,
      communications,
      status_history: statusHistory,
    });
  } catch (error) {
    console.error('getCustomerDetail error:', error);
    return errorRes(res, 'Failed to fetch customer detail');
  }
};

const getRecentCustomers = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userFullName = req.user?.fullName;
    const isAdmin = ['Super Admin', 'Admin'].includes(userRole);

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const { clause: wLocClause, params: wLocParams } = await getLocationFilter(req, 'w');

    let callerClause = '';
    const callerParams = [];
    if (!isAdmin) {
      callerClause = ' AND (w.assigned_telecaller_id = ? OR w.assigned_telecaller = ?)';
      callerParams.push(userId, userFullName);
    }

    const customerFilter = `${wLocClause}${callerClause}`;
    const customerParams = [...wLocParams, ...callerParams];

    const query = `
      SELECT w.id, w.customer_code, w.customer_name, w.mobile_number, w.email,
        w.wedding_date, w.expected_shopping_date, w.preferred_shopping_category,
        w.estimated_family_size, w.assigned_telecaller, w.assigned_telecaller_id,
        w.follow_up_date, w.preferred_call_time, w.customer_status, w.call_status,
        w.total_calls_count, w.last_call_date, w.last_call_outcome,
        w.created_at, w.updated_at,
        l.location_name, l.location_code
      FROM wedding_customers w
      LEFT JOIN locations l ON w.location_id = l.id
      WHERE w.is_deleted = 0 ${customerFilter}
      ORDER BY w.updated_at DESC
      LIMIT ?
    `;
    const queryParams = [...customerParams, limit];

    const [customers] = await pool.query(query, queryParams);

    return successRes(res, { customers });
  } catch (error) {
    console.error('getRecentCustomers error:', error);
    return errorRes(res, 'Failed to fetch recent customers');
  }
};

module.exports = {
  getDashboardStats,
  getFollowUpPipeline,
  getCallHistory,
  getPerformanceMetrics,
  getCustomerDetail,
  getRecentCustomers,
};
