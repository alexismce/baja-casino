import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const host = "127.0.0.1";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function startServer(port, databasePath) {
  const child = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      DATABASE_PATH: databasePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const processInfo = {
    child,
    stdout: "",
    stderr: "",
    error: null,
    closed: false,
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data) => {
    processInfo.stdout += data;
  });
  child.stderr.on("data", (data) => {
    processInfo.stderr += data;
  });
  child.on("error", (error) => {
    processInfo.error = error;
  });
  processInfo.close = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      processInfo.closed = true;
      resolve({ code, signal });
    });
  });
  return processInfo;
}

function diagnostics(info) {
  return `stdout:\n${info.stdout}\nstderr:\n${info.stderr}${info.error ? `\nprocess error: ${info.error.message}` : ""}`;
}

function waitForStartup(info, port) {
  return new Promise((resolve, reject) => {
    const expected = `Lucky Lounge is running at http://${host}:${port}`;
    const timer = setTimeout(
      () =>
        finish(new Error(`Server startup timed out.\n${diagnostics(info)}`)),
      10000,
    );
    function finish(error) {
      clearTimeout(timer);
      info.child.stdout.off("data", onData);
      if (error) reject(error);
      else resolve();
    }
    function onData() {
      if (info.stdout.includes(expected)) finish();
    }
    info.child.stdout.on("data", onData);
    info.close.then(({ code, signal }) =>
      finish(
        new Error(
          `Server exited before startup (code ${code}, signal ${signal}).\n${diagnostics(info)}`,
        ),
      ),
    );
    onData();
  });
}

async function stopServer(info) {
  if (info.closed) return;
  info.child.kill("SIGTERM");
  const forceTimer = setTimeout(() => info.child.kill("SIGKILL"), 5000);
  let timeout;
  try {
    await Promise.race([
      info.close,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Server did not exit.\n${diagnostics(info)}`)),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(forceTimer);
    clearTimeout(timeout);
  }
}

function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
}

test(
  "server starts on the configured port and persists a session across restart",
  { timeout: 45000 },
  async (t) => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "lucky-lounge-startup-"),
    );
    const databasePath = path.join(directory, "casino.db");
    const processes = [];
    t.after(async () => {
      let results;
      try {
        results = await Promise.allSettled(processes.map(stopServer));
      } finally {
        await rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      }
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length)
        throw new AggregateError(
          failures.map((result) => result.reason),
          "Server cleanup failed.",
        );
    });

    const port = await freePort();
    const baseUrl = `http://${host}:${port}`;
    const launch = async () => {
      const info = startServer(port, databasePath);
      processes.push(info);
      await waitForStartup(info, port);
      return info;
    };

    try {
      const first = await launch();
      assert.ok((await stat(databasePath)).isFile());

      const health = await request(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      const healthData = await health.json();
      assert.equal(healthData.ok, true);
      assert.equal(healthData.database.integrity, "ok");
      assert.equal(healthData.database.foreignKeysEnabled, true);

      const state = await request(`${baseUrl}/api/state`);
      assert.equal(state.status, 200);
      assert.deepEqual(await state.json(), {
        balance: 1000,
        maxBet: 100,
        authenticated: false,
      });
      const setCookie = state.headers.get("set-cookie");
      assert.match(setCookie, /^lucky_session=[^;]+;/);
      const cookie = setCookie.split(";")[0];

      const play = await request(`${baseUrl}/api/play`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: baseUrl,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game: "coin",
          bet: 10,
          choice: "heads",
          requestId: "startup-test",
        }),
      });
      assert.equal(play.status, 200);
      const result = await play.json();
      assert.ok([990, 1010].includes(result.balance));
      assert.equal(
        first.closed,
        false,
        `Server exited unexpectedly.\n${diagnostics(first)}`,
      );
      await stopServer(first);

      const second = await launch();
      const restored = await request(`${baseUrl}/api/state`, {
        headers: { Cookie: cookie },
      });
      assert.equal(restored.status, 200);
      assert.deepEqual(await restored.json(), {
        balance: result.balance,
        maxBet: 100,
        authenticated: false,
      });
      assert.equal(restored.headers.get("set-cookie"), null);
      assert.equal(
        second.closed,
        false,
        `Server exited unexpectedly.\n${diagnostics(second)}`,
      );
    } catch (error) {
      const logs = processes
        .map((info, index) => `Server ${index + 1}:\n${diagnostics(info)}`)
        .join("\n");
      error.message += `\n${logs}`;
      throw error;
    }
  },
);
