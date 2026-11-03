
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "Z",
  enableKeepAlive: true
});

// Set every connection's MySQL session timezone to UTC
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

module.exports = pool;
