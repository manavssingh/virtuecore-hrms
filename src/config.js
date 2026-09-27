require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'virtue_core_enterprise_hrms_super_secret_jwt_key_2026',
  dbPath: path.resolve(process.env.DB_PATH || './data/virtuecore.db')
};
