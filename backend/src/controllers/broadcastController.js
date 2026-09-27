const pool = require('../config/db');

exports.getBroadcasts = async (req, res) => {
  try {
    if (!req.user || req.user.role === 'Guest' || req.user.id === 'anonymous') {
      return res.json({ success: true, broadcasts: [] });
    }
    const [rows] = await pool.query('SELECT * FROM broadcast_messages ORDER BY created_at DESC');
    res.json({ success: true, broadcasts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createBroadcast = async (req, res) => {
  try {
    const { title, subject, message, priority, category, target_role, sender_name, status, require_ack, pinned } = req.body;
    
    if (!title || !message || !sender_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const [result] = await pool.query(
      `INSERT INTO broadcast_messages 
      (title, subject, message, priority, category, target_role, sender_name, status, require_ack, pinned) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, subject || null, message, priority || 'normal', category || 'General', target_role || 'Everyone', sender_name, status || 'Sent', require_ack ? 1 : 0, pinned ? 1 : 0]
    );

    const newId = result.insertId;
    const [newMsgRows] = await pool.query('SELECT * FROM broadcast_messages WHERE id = ?', [newId]);
    const newBroadcast = newMsgRows[0];

    // Emit socket event to all clients
    const io = req.app.get('io');
    if (io) {
      io.emit('NEW_BROADCAST', newBroadcast);
    }

    res.json({ success: true, broadcast: newBroadcast });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM broadcast_messages WHERE id = ?', [id]);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('DELETE_BROADCAST', { id });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
