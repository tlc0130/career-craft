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

// Trust exactly one reverse-proxy hop (nginx on VPS or Replit's proxy) so
// the client IP used for rate limiting is the real one, not the proxy's.
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

const allowedOrigins: string[] = [];

// ALLOWED_ORIGINS — comma-separated list of fully-qualified origins, e.g.
//   https://hiddentechdaily.com,https://www.hiddentechdaily.com
if (process.env["ALLOWED_ORIGINS"]) {
  process.env["ALLOWED_ORIGINS"]
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .forEach((o) => allowedOrigins.push(o));
}

// Legacy Replit support: REPLIT_DOMAINS is a comma-separated list of bare
// hostnames (without protocol); we prefix them with https://.
if (process.env["REPLIT_DOMAINS"]) {
  process.env["REPLIT_DOMAINS"]
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .forEach((d) => allowedOrigins.push(`https://${d}`));
}

if (process.env["NODE_ENV"] !== "production") {
  allowedOrigins.push("http://localhost:80", "http://localhost:5173", "http://localhost:20047");
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
