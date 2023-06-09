// External dependencies
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

// Internal dependencies
const conn = require("./db_config");
const { getAllUsers, getPostByUserId, usersFollowPosts, addNewUser, getAllPosts, getPostByPostId, deletePostByPostId, addNewPost, getAllComments, addNewComment, login, register, listen, index, getPostsUserFollow, deleteUserFollowPost, getAllCommentsByPostId, getAllPostsWithFollow } = require("./routes");
const { serverPort, googleClientId, googleClientSecret, domain } = require("./constant");
const { corsOptions } = require("./cors");

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(
  session({
    secret: "bonn",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      domain: domain
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport
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
      clientID: googleClientId,
      clientSecret: googleClientSecret,
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

// Google OAuth
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

// Routes
app.get("/", index);

// Users
app.get("/users", getAllUsers);
app.get("/users/:userId/posts", getPostByUserId);
app.get("/users/:userId/follow/", getPostsUserFollow);
app.post("/user", addNewUser);

// Followers
app.post("/users/:userId/follow/:postId", usersFollowPosts);
app.delete("/users/:userId/follow/:postId", deleteUserFollowPost);

// Posts
app.get("/posts", getAllPosts);
app.get("/posts/follow/:userId", getAllPostsWithFollow);
app.get("/post/:id", getPostByPostId);
app.delete("/post/:id", deletePostByPostId);
app.post("/post", addNewPost);

// Comments
app.get("/comments", getAllComments);
app.get("/comments/:postId", getAllCommentsByPostId);
app.post("/comment", addNewComment);

// Authentication
app.post("/login", login);
app.post("/register", register);

// Listen
app.listen(serverPort, listen);
