
// Kharcha API: Express + MongoDB (Mongoose) + JWT auth.
// Runs as a single serverless function on Vercel, or locally with npm start.

try {
  require("dotenv").config();
} catch (e) {
  // dotenv is only needed locally
}

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { MONGODB_URI, JWT_SECRET } = process.env;

const CATEGORIES = [
  "food", "transport", "bills", "shopping",
  "health", "fun", "study", "other"
];

const METHODS = ["UPI", "Card", "Cash"];

/* ---------- Database connection ---------- */

const cache = global._kharchaMongo || (global._kharchaMongo = {
  conn: null,
  promise: null
});

async function connect() {
  if (cache.conn) return cache.conn;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}

/* ---------- Database schemas ---------- */

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  budget: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const expenseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    max: 10000000
  },
  category: {
    type: String,
    enum: CATEGORIES,
    required: true
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/
  },
  note: {
    type: String,
    default: "",
    maxlength: 80,
    trim: true
  },
  method: {
    type: String,
    enum: METHODS,
    default: "UPI"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.models.User ||
  mongoose.model("User", userSchema);

const Expense = mongoose.models.Expense ||
  mongoose.model("Expense", expenseSchema);

/* ---------- Helper functions ---------- */

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong on the server."
    });
  });

const toExpense = (e) => ({
  id: String(e._id),
  amount: e.amount,
  category: e.category,
  date: e.date,
  note: e.note || "",
  method: e.method,
  createdAt: new Date(e.createdAt).getTime()
});

const toUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  budget: u.budget || 0
});

const signToken = (u) =>
  jwt.sign(
    { sub: String(u._id) },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

function validDate(s) {
  if (
    typeof s !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s)
  ) return false;

  const d = new Date(s + "T00:00:00Z");

  return !isNaN(d) &&
    d.toISOString().slice(0, 10) === s;
}

function cleanExpense(body) {
  const b = body || {};

  const amount = Math.round(Number(b.amount) * 100) / 100;

  if (!(amount > 0) || amount > 10000000) {
    return {
      error: "Enter an amount between 0.01 and 1,00,00,000."
    };
  }

  if (!CATEGORIES.includes(b.category)) {
    return { error: "Pick a valid category." };
  }

  if (!validDate(b.date)) {
    return { error: "Pick a valid date." };
  }

  const method = METHODS.includes(b.method)
    ? b.method
    : "UPI";

  const note = typeof b.note === "string"
    ? b.note.trim().slice(0, 80)
    : "";

  return {
    value: {
      amount,
      category: b.category,
      date: b.date,
      note,
      method
    }
  };
}

/* ---------- Authentication middleware ---------- */

async function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ")
      ? h.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Please log in."
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        error: "Please log in again."
      });
    }

    req.user = user;
    next();

  } catch (err) {
    res.status(401).json({
      error: "Your session expired. Please log in again."
    });
  }
}

/* ---------- API routes ---------- */

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1
      ? "connected"
      : "not connected"
  });
});

router.post("/auth/register", wrap(async (req, res) => {
  const { name, email, password } = req.body || {};

  if (
    typeof name !== "string" ||
    name.trim().length < 2
  ) {
    return res.status(400).json({
      error: "Enter your name."
    });
  }

  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email.trim())
  ) {
    return res.status(400).json({
      error: "Enter a valid email address."
    });
  }

  if (
    typeof password !== "string" ||
    password.length < 6
  ) {
    return res.status(400).json({
      error: "Password must be at least 6 characters."
    });
  }

  const exists = await User.findOne({
    email: email.trim().toLowerCase()
  });

  if (exists) {
    return res.status(409).json({
      error: "An account with this email already exists. Try logging in."
    });
  }

  const user = await User.create({
    name: name.trim(),
    email: email.trim(),
    passwordHash: await bcrypt.hash(password, 10)
  });

  res.status(201).json({
    token: signToken(user),
    user: toUser(user)
  });
}));

router.post("/auth/login", wrap(async (req, res) => {
  const { email, password } = req.body || {};

  const user = typeof email === "string"
    ? await User.findOne({
        email: email.trim().toLowerCase()
      })
    : null;

  const ok = user &&
    typeof password === "string" &&
    (await bcrypt.compare(password, user.passwordHash));

  if (!ok) {
    return res.status(401).json({
      error: "Incorrect email or password."
    });
  }

  res.json({
    token: signToken(user),
    user: toUser(user)
  });
}));

router.get("/auth/me", auth, wrap(async (req, res) => {
  res.json({
    user: toUser(req.user)
  });
}));

router.get("/expenses", auth, wrap(async (req, res) => {
  const list = await Expense.find({
    user: req.user._id
  })
    .sort({ date: -1, createdAt: -1 })
    .limit(5000);

  res.json({
    expenses: list.map(toExpense)
  });
}));

router.post("/expenses", auth, wrap(async (req, res) => {
  const { value, error } = cleanExpense(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const doc = await Expense.create({
    ...value,
    user: req.user._id
  });

  res.status(201).json(toExpense(doc));
}));

router.put("/expenses/:id", auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({
      error: "Expense not found."
    });
  }

  const { value, error } = cleanExpense(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const doc = await Expense.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user._id
    },
    value,
    { new: true }
  );

  if (!doc) {
    return res.status(404).json({
      error: "Expense not found."
    });
  }

  res.json(toExpense(doc));
}));

router.delete("/expenses/:id", auth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({
      error: "Expense not found."
    });
  }

  const r = await Expense.deleteOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!r.deletedCount) {
    return res.status(404).json({
      error: "Expense not found."
    });
  }

  res.json({ ok: true });
}));

router.put("/budget", auth, wrap(async (req, res) => {
  const budget = Number(
    req.body && req.body.budget
  );

  if (!(budget >= 0) || budget > 100000000) {
    return res.status(400).json({
      error: "Enter a budget in rupees."
    });
  }

  req.user.budget = Math.round(budget);
  await req.user.save();

  res.json({
    budget: req.user.budget
  });
}));

/* ---------- Express application ---------- */

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));

// Serve the frontend from the public folder on Vercel and locally.
app.use(express.static(path.join(__dirname, "..", "public")));

// Check configuration and connect to MongoDB.
app.use(async (req, res, next) => {
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not set");
    }

    await connect();
    next();

  } catch (err) {
    console.error(err.message);

    res.status(500).json({
      error: "The server is not configured or cannot reach the database."
    });
  }
});

// API routes.
app.use("/api", router);
app.use("/", router);

// Local development only.
if (require.main === module) {
  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log("Kharcha running on http://localhost:" + port);
  });
}

module.exports = app;
