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
  origin: ["http://localhost:3000", "https://blog-frontend-jade-nine.vercel.app"],
  credentials: true,
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors(corsOptions));

app.use(
  session({
    name: "bonn",
    secret: "bonn",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
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
      callbackURL: "https://fluffy-lamb-skirt.cyclic.app/auth/google/bonn",
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
    failureRedirect: "https://blog-frontend-jade-nine.vercel.app//signup",
    successRedirect: "https://blog-frontend-jade-nine.vercel.app/",
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
    "SELECT posts.postID, posts.postText, posts.created_at, users.username, comments.commentText \
    FROM posts LEFT JOIN comments ON posts.postID = comments.postID LEFT JOIN users ON users.userID = posts.userID",
  // conn.query(
  //   "SELECT posts.postID, posts.postText, posts.created_at, users.username, comments.commentText \
  //   FROM posts LEFT JOIN comments ON posts.postID = comments.postID LEFT JOIN users ON users.userID = posts.userID \
  //   GROUP BY posts.postID",
    (err, results) => {
      if (err) throw err;
      res.json(results);
    }
  );
});

app.get("/post/:id", (req, res) => {
  const { id } = req.params;
  conn.query(
    "SELECT posts.postID, posts.postText as body, posts.userID, users.username, comments.commentText as comment, comments.userID as commentUser \
    FROM posts LEFT JOIN users ON posts.userID = users.userID \
    LEFT JOIN comments ON posts.postID = comments.postID \
    WHERE posts.postID = ?",
    // "SELECT posts.*, users.username, comments.commentText as comment, comments.userID as commentUser \
    //   FROM posts JOIN comments ON posts.postID = ? \
    //   AND comments.postID = posts.postID \
    //   JOIN users ON users.userID = posts.userID",
    [id],
    (err, rows) => {
      // conn.query("SELECT posts.*, comments.commentText as comment, comments.userID as commentUser FROM posts, comments WHERE posts.postID = ? AND comments.postID = posts.postID", [id], (err, rows) => {
      if (err) throw err;
      if (rows.length > 0) {
        console.log(rows);
        res.json(rows);
      } else {
        res.status(404).send({ message: "No record found" });
      }
    }
  );
});

// POST a new post
app.post("/post", (req, res) => {
  const { body, userID } = req.body;
  conn.query(
    "INSERT INTO posts (postText, userID) VALUES (?, ?)",
    [body, userID],
    (err, results) => {
      if (err) throw err;
      const post = { message: "success", data: { userID, body } };
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
            const {userID, username} = results[0]
            const token = jwt.sign(
              { auth: true, username, email, password },
              process.env.SECRET_KEY,
              {
                expiresIn: "6h",
              }
            );
            return res.status(200).send({ auth: true, token, userID, username });
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

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Listening on port ${process.env.SERVER_PORT}`);
});
