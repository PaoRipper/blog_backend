const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const conn = require("./db_config");
const passport = require("passport");
const session = require("express-session");

const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

app.use(
  session({
    secret: "Bonn",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log('googleid = ', user.googleid);
  done(null, user.googleid);
});

passport.deserializeUser((id, done) => {
  console.log('deserialize');
  conn.query(
    "SELECT * FROM users WHERE googleid = ?",
    [id],
    (err, rows) => {
      if (err) return done(err);
      done(null, rows[0]);
    }
  );
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8000/auth/google/bonn",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      if (profile) {
        conn.query(
          "INSERT INTO users (username, email, googleid) VALUES (?, ?, ?)",
          [profile.displayName, profile.emails[0].value, profile.id],
          (err, result) => {
            if (err) return cb(err);
            const user = {
              id: result.insertId,
              googleid: profile.id,
              email: profile.emails[0].value,
              username: profile.displayName,
            };
            return cb(null, user);
          }
        );
      }
    }
  )
);

app.get("/", (req, res) => {
  res.send("/");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/bonn",
  passport.authenticate("google", {
    successRedirect: "http://localhost:3000",
    failureRedirect: "http://localhost:3000/signup",
  })
  // (req, res) => {
  //   // Successful authentication, redirect home.
  // }
);

app.get("/googlelogin/success", (req, res) => {
  console.log("req.user = ", req.user);
  if (req.user) {
    console.log(req.user);
    res.status(200).json({
      success: true,
      user: req.user,
      cookies: req.cookies
    })
  }
})

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
  const { email, password } = req.body;
  // Check if user exists and password is correct
  conn.query(
    "SELECT * FROM users WHERE users.email = ?",
    [email],
    (err, results) => {
      if (err) throw err;
      bcrypt.compare(password, results[0].password, (error, result) => {
        if (error) throw error;
        if (result) {
          const token = jwt.sign(
            { auth: true, username: results[0].username, email, password },
            process.env.SECRET_KEY,
            {
              expiresIn: "1h",
            }
          );
          return res
            .status(200)
            .send({ auth: true, token, username: results[0].username });
        }
        return res.status(401).send({ message: "Invalid email or password." });
      });
    }
  );
});

app.post("/register", (req, res) => {
  const { username, password, email } = req.body;
  // Check if user is already taken
  conn.query(
    "SELECT * FROM users WHERE users.email = ?",
    [email],
    async (err, result) => {
      if (err) throw err;
      if (result.length > 0) {
        return res.status(409).send({ message: "Email is already taken" });
      }

      // Add new user to database
      const encryptedPassword = await bcrypt.hash(password, 10);
      conn.query(
        "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
        [username, encryptedPassword, email],
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
