require("dotenv").config();
const mysql = require("mysql2");

// const conn = mysql.createConnection({
//   host: "aws.connect.psdb.cloud",
//   user: "xa80auhipyzevo6ch2bs",
//   password: "pscale_pw_F4ANAVDVs83Az1QSySbaGhc8xeCKnlJ5tlVjiehb2TE",
//   database: "bonn_db",
//   ssl: { "rejectUnauthorized": true }
// });

const conn = mysql.createConnection(process.env.DATABASE_URL)

conn.connect((err) => {
  if (err) {
    console.error("Error connecting to database", err.stack);
    return;
  }
  console.log("Connected to database with ID: ", conn.threadId);
});

module.exports = conn;
