import { createServer } from "node:http";
import { Server } from "socket.io";
import { attachRealtime, createApp, isSameOrigin } from "./src/app.js";
import { sessionStore } from "./src/session-store.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
// Railway's proxy cannot reach a loopback-only listener.
const host =
  process.env.HOST ??
  (process.env.RAILWAY_ENVIRONMENT_NAME ? "0.0.0.0" : "127.0.0.1");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = createServer(createApp());
const io = new Server(server, {
  serveClient: true,
  maxHttpBufferSize: 1024,
  allowRequest: (request, callback) => callback(null, isSameOrigin(request)),
});

io.engine.on("headers", (headers) => {
  headers["Content-Security-Policy"] =
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  headers["X-Content-Type-Options"] = "nosniff";
  headers["X-Frame-Options"] = "DENY";
  headers["Referrer-Policy"] = "no-referrer";
});
attachRealtime(io);

server.listen(port, host, () => {
  console.log(`Lucky Lounge is running at http://${host}:${port}`);
});
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Cannot start Lucky Lounge: http://${host}:${port} is already in use. Stop the existing server or choose another PORT.`,
    );
  } else {
    console.error("The game server could not start:", error);
  }
  sessionStore.close();
  process.exitCode = 1;
});

let stopping = false;
function stopServer(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}. Stopping...`);

  io.close(() => {
    server.close(() => {
      sessionStore.close();
      console.log("Game server stopped.");
    });
  });

  const forceStopTimer = setTimeout(() => {
    console.error("Server did not stop in time; forcing process exit.");
    process.exit(1);
  }, 5000);
  forceStopTimer.unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopServer(signal));
}
