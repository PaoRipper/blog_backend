const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const conn = require("./db_config");
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");

const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

app.set("view engine", "ejs");

const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors(corsOptions));

app.use(
  session({
    secret: "bonn",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log("user serialize = ", user);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  conn.query("SELECT * FROM users WHERE googleid = ?", [id], (err, rows) => {
    if (err) return done(err);
    if (!rows || rows.length === 0) {
      return done(null, false);
    }
    return done(null, rows[0]);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8000/auth/google/bonn",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, done) {
      const users = {
        id: profile.id,
        username: profile.displayName,
        accessToken,
      };
      conn.query(
        "SELECT * FROM users WHERE googleid = ?",
        [profile.id],
        (err, rows) => {
          if (err) throw err;
          if (rows.length <= 0) {
            conn.query(
              "INSERT INTO users (username, email, googleid) VALUES (?, ?, ?)",
              [profile.displayName, profile.emails[0].value, profile.id],
              (error, results) => {
                if (results) {
                  done(null, users);
                }
              }
            );
          }
          done(null, users);
        }
      );
    }
  )
);

app.get("/", (req, res) => {
  res.send("INDEX");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/bonn",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:3000/signup",
    successRedirect: "http://localhost:3000",
  })
);

app.get("/auth/google/success", (req, res) => {
  if (req.isAuthenticated()) {
    const sessionId = req.cookies["connect.sid"];
    const data = { user: req.user, connect_sid: sessionId, auth: true };
    res.status(200).send({ message: "success", data });
  }
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
  conn.query(
    "SELECT posts.*, comments.commentText FROM posts LEFT JOIN comments ON posts.postID = comments.postID",
    (err, results) => {
      if (err) throw err;
      res.json(results);
    }
  );
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
  res.json(users);
});

app.post("/login", (req, res) => {
  const { email, password, type } = req.body;
  // Check if user exists and password is correct
  conn.query(
    "SELECT * FROM users WHERE email = ? AND type = ?",
    [email, type],
    (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        bcrypt.compare(password, results[0].password, (error, result) => {
          if (error) throw error;
          if (result) {
            const username = results[0].username;
            const token = jwt.sign(
              { auth: true, username, email, password },
              process.env.SECRET_KEY,
              {
                expiresIn: "6h",
              }
            );
            return res.status(200).send({ auth: true, token, username });
          }
          return res
            .status(401)
            .send({ message: "Invalid email or password." });
        });
      } else {
        return res
          .status(503)
          .send({ auth: false, message: "Record not found" });
      }
    }
  );
});

app.post("/register", (req, res) => {
  const { username, password, email, type } = req.body;
  // Check if user is already taken
  conn.query(
    "SELECT * FROM users WHERE email = ? AND googleid IS NULL",
    [email],
    async (err, result) => {
      if (err) throw err;
      if (result.length > 0) {
        return res.status(409).send({ message: "Email is already taken" });
      }

      // Add new user to database
      const encryptedPassword = await bcrypt.hash(password, 10);
      conn.query(
        "INSERT INTO users (username, password, email, type) VALUES (?, ?, ?, ?)",
        [username, encryptedPassword, email, type],
        (err, result) => {
          if (err) throw err;
          const token = jwt.sign(
            { id: result.userID, username, email },
            process.env.SECRET_KEY,
            {
              expiresIn: "1h",
            }
          );
          res.status(201).send({ auth: true, token });
        }
      );
    }
  );
});

app.listen(8000, () => {
  console.log(`Listening on port 8000`);
});
