/**
 * Dev proxy: binds 0.0.0.0:PORT immediately so the platform can detect it,
 * then starts Metro on PORT+1 and transparently proxies all HTTP traffic.
 * WebSocket upgrades (used by Metro HMR) are also forwarded.
 */

const http = require("http");
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");

const PORT = parseInt(process.env.PORT || "25089", 10);
const METRO_PORT = parseInt(process.env.METRO_PORT || String(PORT + 1), 10);
const projectRoot = path.resolve(__dirname, "..");

function log(msg) {
  process.stdout.write(`[dev-proxy] ${msg}\n`);
}

// ── Forward an HTTP request to Metro ─────────────────────────────────────────
function forwardRequest(req, res) {
  const options = {
    hostname: "127.0.0.1",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    // Metro not ready yet — return a 200 loading page so platform health-checks pass
    if (!res.headersSent) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2"></head>` +
          `<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#080B17;color:#DBC157">` +
          `<div style="text-align:center"><h2>Starting Metro…</h2><p>The dev server is warming up. This page will refresh automatically.</p></div>` +
          `</body></html>`
      );
    }
  });

  req.pipe(proxyReq, { end: true });
}

// ── Forward a WebSocket upgrade (Metro HMR) ───────────────────────────────────
function forwardUpgrade(req, clientSocket, head) {
  const target = net.createConnection(METRO_PORT, "127.0.0.1", () => {
    target.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (head && head.length) target.write(head);
  });
  target.pipe(clientSocket);
  clientSocket.pipe(target);
  target.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => target.destroy());
}

// ── Create the proxy server, bind to 0.0.0.0 ────────────────────────────────
const server = http.createServer(forwardRequest);
server.on("upgrade", forwardUpgrade);

server.listen(PORT, "0.0.0.0", () => {
  log(`Proxy listening on 0.0.0.0:${PORT} → Metro on 127.0.0.1:${METRO_PORT}`);
});

// ── Start Metro on METRO_PORT ─────────────────────────────────────────────────
log(`Starting Metro on port ${METRO_PORT}…`);

const expo = spawn(
  path.join(projectRoot, "node_modules", ".bin", "expo"),
  ["start", "--localhost", "--port", String(METRO_PORT)],
  {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(METRO_PORT) },
    stdio: "inherit",
  }
);

expo.on("error", (err) => {
  log(`Failed to start expo: ${err.message}`);
  process.exit(1);
});

expo.on("exit", (code) => {
  log(`Expo exited with code ${code}`);
  server.close();
  process.exit(code ?? 0);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  log("Shutting down…");
  expo.kill();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
