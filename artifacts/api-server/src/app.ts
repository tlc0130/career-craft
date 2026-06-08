import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalLimiter, authLimiter, aiLimiter } from "./middlewares/rateLimit";

const app: Express = express();

// Behind Replit's single reverse proxy — trust exactly one hop so the client
// IP used for rate limiting is the real one, not the proxy's.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = (process.env["REPLIT_DOMAINS"] ?? "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => `https://${d}`);

if (process.env["NODE_ENV"] !== "production") {
  allowedOrigins.push("http://localhost:80", "http://localhost:20047");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

const PgSession = connectPgSimple(session);

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

const isProduction = process.env["NODE_ENV"] === "production";

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "strict" : "lax",
    },
  }),
);

// Rate limiting: tight buckets on auth + AI, a loose backstop on everything.
app.use("/api/auth", authLimiter);
app.use("/api/ai", aiLimiter);
app.use("/api", generalLimiter);

app.use("/api", router);

export default app;
