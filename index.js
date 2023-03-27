const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors")
const conn = require("./db_config");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors())

app.get("/", (req, res) => {
  res.send("BLOG API");
});

// GET all users
app.get("/users", (req, res) => {
  conn.query("SELECT * FROM users", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// POST a new user
app.post("/user", (req, res) => {
  const { username, password, email } = req.body;

  // Check if user with same email already exists
  conn.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      // This email already exist
      return res.status(409).send({ message: "Email already exist" });
    }
    // Insert new user
    conn.query(
      "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
      [username, password, email],
      (err, results) => {
        if (err) throw err;
        const user = { message: "success", data: { username, email } };
        res.json(user);
      }
    );
  });
});

// GET ALL posts
app.get("/posts", (req, res) => {
  conn.query("SELECT posts.*, comments.commentText FROM posts LEFT JOIN comments ON posts.postID = comments.postID", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// POST a new post
app.post("/post", (req, res) => {
  const { title, content, userID } = req.body;

  conn.query(
    "INSERT INTO posts (postTitle, postText, userID) VALUES (?, ?, ?)",
    [title, content, userID],
    (err, results) => {
      if (err) throw err;
      const post = { message: "success", data: { title, content, userID } };
      res.json(post);
    }
  );
});

// GET ALL comments
app.get("/comments", (req, res) => {
  conn.query("SELECT * FROM comments", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// POST a new comment
app.post("/comment", (req, res) => {
  const { content, userID, postID } = req.body;

  conn.query(
    "INSERT INTO comments (commentText, userID, postID) VALUES (?, ?, ?)",
    [content, userID, postID],
    (err, results) => {
      if (err) throw err;
      const comment = { message: "success", data: { content, userID, postID } };
      res.json(comment);
    }
  );
});

app.get("/nodbusers", (req, res) => {
  const users = [
    { id: 1, name: "pao", age: 20 },
    { id: 2, name: "pao2", age: 25 },
  ];
  res.json(users)
});

app.listen(8000, () => {
  console.log(`Listening on port 8000`);
});
