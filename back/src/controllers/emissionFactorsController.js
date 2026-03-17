const pool = require('../db/pool');

const getAll = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM emission_factors ORDER BY category, name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll };
