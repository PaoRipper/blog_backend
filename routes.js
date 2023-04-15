const conn = require("./db_config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");


// INDEX
const index = (req, res) => {
    res.send("INDEX");
}

// USERS
const getAllUsers = (req, res) => {
    conn.query("SELECT * FROM users", (err, results) => {
        if (err) throw err;
        res.json(results);
    });
}
const getPostByUserId = (req, res) => {
    const userId = req.params.userId
    const sortBy = req.query.sortBy
    let filtered = "DESC"

    switch (sortBy) {
        case "Most comments":
            filtered = "DESC"
            break;
        case "Less comments":
            filtered = "ASC"
        default:
            break;
    }

    conn.query(`SELECT p.*, c.comments_count \
  FROM posts p LEFT JOIN (SELECT postID, count(*) AS comments_count FROM comments GROUP BY postID) c \
  ON p.postID = c.postID WHERE p.userID = ? ORDER BY c.comments_count ${filtered}`, userId, (err, rows) => {
        if (err) throw err;
        res.json(rows);
    })
}
const getPostsUserFollow = (req, res) => {
    const userId = req.params.userId
    const sortBy = req.query.sortBy
    let filtered = "DESC"

    switch (sortBy) {
        case "Most comments":
            filtered = "DESC"
            break;
        case "Less comments":
            filtered = "ASC"
        default:
            break;
    }

    const query = `SELECT p.*, c.comments_count \
    FROM posts p LEFT JOIN (SELECT postID, count(*) AS comments_count FROM comments GROUP BY postID) c \
    ON p.postID = c.postID JOIN users_follow_posts ufp ON p.postID = ufp.postId \
    WHERE ufp.userId = ? ORDER BY c.comments_count ${filtered}`

    conn.query(query, [userId], (err, rows) => {
        if (err) throw err;
        return res.json(rows)
    })
}
const usersFollowPosts = (req, res) => {
    const userId = req.params.userId;
    const postId = req.params.postId;

    conn.query("SELECT * FROM users WHERE userID = ?", userId, (err, rows) => {
        if (err) throw err;
        if (rows.length <= 0) {
            return res.status(404).send({ message: "User not found" })
        }
        conn.query("SELECT * FROM posts WHERE postID = ?", postId, (err, rows) => {
            if (err) throw err;
            if (rows.length <= 0) {
                return res.status(404).send({ message: "Post not found" })
            }
            conn.query("SELECT * FROM users_follow_posts WHERE userId = ? AND postId = ?", [userId, postId], (err, rows) => {
                if (err) throw err;
                if (rows.length > 0) {
                    return res.status(400).send({ message: "User already following this post" })
                }
                conn.query("INSERT INTO users_follow_posts (userId, postId) VALUES (?, ?)", [userId, postId], (err, rows) => {
                    if (err) throw err;
                    return res.status(201).json({ message: "User is now following the post" })
                });
            })
        })
    })
}
const addNewUser = (req, res) => {
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
}


// POSTS
const getAllPosts = (req, res) => {
    conn.query(
        "SELECT posts.postID, posts.postText, posts.created_at, users.username, comments.commentText \
        FROM posts LEFT JOIN comments ON posts.postID = comments.postID LEFT JOIN users ON users.userID = posts.userID",
        (err, results) => {
            if (err) throw err;
            res.json(results);
        }
    );
}
const getPostByPostId = (req, res) => {
    const { id } = req.params;
    conn.query(
        "SELECT posts.postID, posts.postText as body, posts.userID, users.username, comments.commentText as comment, comments.userID as commentUser \
    FROM posts LEFT JOIN users ON posts.userID = users.userID \
    LEFT JOIN comments ON posts.postID = comments.postID \
    WHERE posts.postID = ?",
        [id],
        (err, rows) => {
            if (err) throw err;
            if (rows.length > 0) {
                console.log(rows);
                res.json(rows);
            } else {
                res.status(404).send({ message: "No record found" });
            }
        }
    );
}
const deletePostByPostId = (req, res) => {
    const id = req.params.id;
    conn.query("DELETE FROM posts WHERE postID = ?", id, (err, rows) => {
        if (err) throw err;
        res.status(200).send({ message: "success" });
    })
}
const addNewPost = (req, res) => {
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
}

// COMMENTS
const getAllComments = (req, res) => {
    conn.query("SELECT * FROM comments", (err, results) => {
        if (err) throw err;
        res.json(results);
    });
}
const addNewComment = (req, res) => {
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
}

// LOGIN
const login = (req, res) => {
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
                        const { userID, username } = results[0]
                        const token = jwt.sign(
                            { auth: true, userID, username, email, password },
                            process.env.SECRET_KEY,
                            { expiresIn: "3h" }
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
}

// REGISTER
const register = (req, res) => {
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
}

// LISTEN
const listen = () => {
    console.log(`Listening on port ${process.env.SERVER_PORT}`);
}

module.exports = {
    index,
    getAllUsers,
    getPostByUserId,
    getPostsUserFollow,
    usersFollowPosts,
    addNewUser,
    getAllPosts,
    getPostByPostId,
    deletePostByPostId,
    addNewPost,
    getAllComments,
    addNewComment,
    login,
    register,
    listen
}