const pool = require('../config/db');
const { getLocationFilter, getEffectiveLocationId } = require('../middleware/auth');

class DeptHiringController {
  // GET /api/dept-hiring/targets
  async getHiringTargets(req, res) {
    try {
      let targets = [];
      try {
        const { clause: locClause, params: locParams } = await getLocationFilter(req, 'department_hiring_targets');
        const [rows] = await pool.query(`SELECT * FROM department_hiring_targets WHERE 1=1 ${locClause} ORDER BY department, section`, locParams);
        targets = rows || [];
      } catch (e) {
        targets = [];
      }

      // Also calculate actual joined counts per dept, section, designation from candidates/employees
      let joinedCounts = {};
      try {
        const { clause: cLocClause, params: cLocParams } = await getLocationFilter(req, 'candidates');
        const [candRows] = await pool.query(`
          SELECT designation, COUNT(*) as cnt 
          FROM candidates 
          WHERE status = 'Joined' ${cLocClause}
          GROUP BY designation
        `, cLocParams);
        (candRows || []).forEach(r => {
          if (r.designation) {
            joinedCounts[r.designation.toLowerCase()] = r.cnt;
          }
        });
      } catch (e) {}

      return res.json({
        success: true,
        targets,
        joinedCounts
      });
    } catch (err) {
      console.error('[getHiringTargets Error]', err);
      return res.json({ success: false, targets: [], joinedCounts: {} });
    }
  }

  // POST /api/dept-hiring/targets
  async saveHiringTarget(req, res) {
    try {
      const { department, section, designation, requiredOpenings, hiringTarget, remarks } = req.body;
      if (!department || !section || !designation) {
        return res.status(400).json({ success: false, error: 'Department, section and designation are required' });
      }

      const reqCount = parseInt(requiredOpenings, 10) || 0;
      const targetCount = parseInt(hiringTarget, 10) || reqCount;
      const locId = getEffectiveLocationId(req) || (req.user && req.user.locationId) || 2;

      await pool.query(`
        INSERT INTO department_hiring_targets (department, section, designation, required_openings, hiring_target, remarks, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          required_openings = VALUES(required_openings),
          hiring_target = VALUES(hiring_target),
          remarks = VALUES(remarks),
          updated_at = CURRENT_TIMESTAMP
      `, [department, section, designation, reqCount, targetCount, remarks || '', locId]);

      return res.json({ success: true, message: 'Hiring target updated successfully' });
    } catch (err) {
      console.error('[saveHiringTarget Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/section-allocations
  async getSectionAllocations(req, res) {
    try {
      let allocations = [];
      try {
        const { clause: locClause, params: locParams } = await getLocationFilter(req, 'section_allocations');
        const [rows] = await pool.query(`SELECT * FROM section_allocations WHERE 1=1 ${locClause}`, locParams);
        allocations = rows || [];
      } catch (e) {
        allocations = [];
      }
      return res.json({ success: true, allocations });
    } catch (err) {
      console.error('[getSectionAllocations Error]', err);
      return res.json({ success: false, allocations: [] });
    }
  }

  // POST /api/section-allocations
  async saveSectionAllocation(req, res) {
    try {
      const { employeeId, appNo, employeeName, department, section, assignedBy, notes } = req.body;
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required' });
      }

      const locId = getEffectiveLocationId(req) || (req.user && req.user.locationId) || 2;

      await pool.query(`
        INSERT INTO section_allocations (employee_id, app_no, employee_name, department, section, assigned_by, notes, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          department = VALUES(department),
          section = VALUES(section),
          assigned_by = VALUES(assigned_by),
          notes = VALUES(notes),
          updated_at = CURRENT_TIMESTAMP
      `, [employeeId, appNo || '', employeeName || '', department || '', section || '', assignedBy || 'HR', notes || '', locId]);

      return res.json({ success: true, message: 'Section allocation saved successfully' });
    } catch (err) {
      console.error('[saveSectionAllocation Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/section-allocations/bulk
  async bulkSaveSectionAllocation(req, res) {
    try {
      const { employees, section, action, assignedBy } = req.body;
      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ success: false, error: 'No employees selected' });
      }

      const targetSection = action === 'remove' ? '' : (section || '');
      const locId = getEffectiveLocationId(req) || (req.user && req.user.locationId) || 2;

      for (const emp of employees) {
        const empId = emp.employeeId || emp.id || emp.appNo;
        if (!empId) continue;

        await pool.query(`
          INSERT INTO section_allocations (employee_id, app_no, employee_name, department, section, assigned_by, location_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            section = VALUES(section),
            assigned_by = VALUES(assigned_by),
            updated_at = CURRENT_TIMESTAMP
        `, [
          String(empId), 
          emp.appNo || '', 
          emp.employeeName || emp.name || '', 
          emp.department || '', 
          targetSection, 
          assignedBy || 'HR',
          locId
        ]);
      }

      return res.json({ success: true, message: `Bulk updated section for ${employees.length} employees` });
    } catch (err) {
      console.error('[bulkSaveSectionAllocation Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/dept-hiring/sections
  async getDepartmentSections(req, res) {
    try {
      let sections = [];
      try {
        const [rows] = await pool.query('SELECT * FROM department_sections WHERE active = TRUE ORDER BY department, section_name');
        sections = rows || [];
      } catch (e) {
        sections = [];
      }
      return res.json({ success: true, sections });
    } catch (err) {
      console.error('[getDepartmentSections Error]', err);
      return res.json({ success: false, sections: [] });
    }
  }

  // POST /api/dept-hiring/sections/add
  async addDepartmentSection(req, res) {
    try {
      const { department, sectionName, description } = req.body;
      if (!department || !sectionName) {
        return res.status(400).json({ success: false, error: 'Department and section name are required' });
      }

      await pool.query(`
        INSERT INTO department_sections (department, section_name, description, active)
        VALUES (?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
          description = VALUES(description),
          active = TRUE,
          updated_at = CURRENT_TIMESTAMP
      `, [department.trim(), sectionName.trim(), description || '']);

      return res.json({ success: true, message: 'Section added successfully' });
    } catch (err) {
      console.error('[addDepartmentSection Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/dept-hiring/sections/edit
  async editDepartmentSection(req, res) {
    try {
      const { id, department, sectionName, description } = req.body;
      if (!id || !department || !sectionName) {
        return res.status(400).json({ success: false, error: 'ID, department and section name are required' });
      }

      await pool.query(`
        UPDATE department_sections
        SET department = ?, section_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [department.trim(), sectionName.trim(), description || '', id]);

      return res.json({ success: true, message: 'Section updated successfully' });
    } catch (err) {
      console.error('[editDepartmentSection Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/dept-hiring/sections/delete
  async deleteDepartmentSection(req, res) {
    try {
      const { id, department, sectionName } = req.body;
      if (id) {
        await pool.query(`DELETE FROM department_sections WHERE id = ?`, [id]);
      } else if (department && sectionName) {
        await pool.query(`DELETE FROM department_sections WHERE department = ? AND section_name = ?`, [department, sectionName]);
      } else {
        return res.status(400).json({ success: false, error: 'Section ID or Department & Section Name required' });
      }
      return res.json({ success: true, message: 'Section deleted successfully' });
    } catch (err) {
      console.error('[deleteDepartmentSection Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new DeptHiringController();
