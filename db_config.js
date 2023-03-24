require("dotenv").config();
const mysql = require("mysql");

const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "123456789",
  database: "blog_db",
});

conn.connect((err) => {
  if (err) {
    console.error("Error connecting to database", err.stack);
    return;
  }
  console.log("Connected to database with ID: ", conn.threadId);
});

module.exports = conn;
