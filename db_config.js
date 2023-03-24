require("dotenv").config();
const mysql = require("mysql");

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

conn.connect((err) => {
  if (err) {
    console.error("Error connecting to database", err.stack);
    return;
  }
  console.log("Connected to database with ID: ", conn.threadId);
});

module.exports = conn;
