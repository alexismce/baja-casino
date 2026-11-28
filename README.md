[baja_casino_readme.md](https://github.com/user-attachments/files/35525078/baja_casino_readme.md)
# Baja Casino

Live deployment: [baja-casino.com](https://baja-casino.com)

## Overview

`baja-casino` is a Node.js web application deployed on Railway (`npm install` and `npm run start`) with a `/health` healthcheck endpoint.

> Note: Update the sections below with your exact application stack, environment variables, and game/API details as you finalize your source files.

## Project Structure

Reference files in the repository include:

- `package.json` — Dependencies, Node engine requirement (`>=20.0.0`), and `start` / `build` scripts.
- `docs/project-structure.md` — Project layout notes.
- `docs/baja-casino-improvement-schedule.md` — Planned improvements and milestones.
- `docs/github-actions-metadata-reference.md` — CI/CD metadata reference.
- `.github/instructions/` — Postman collection and request guidelines.

## Getting Started Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file (do not commit secrets) with any required variables such as `PORT`, database URLs, or session/Socket.IO settings.

3. **Start the server:**
   ```bash
   npm run start
   ```

## Deployment (Railway)

- **Runtime:** Node.js `>=20.0.0` (built via Railpack).
- **Build & Start:** Runs `npm install` followed by `npm run start`.
- **Healthcheck:** Expects a `200` response on `/health`.
- **Tip:** Keep `node_modules` excluded via `.gitignore` and `.dockerignore` so builds and archives stay lightweight and avoid stale cached artifacts.

## Troubleshooting Checklist

- **Deploy Logs:** Check Railway **Deploy Logs** (not just Build Logs) for runtime exceptions or missing environment variables after startup.
- **Build Step:** If your frontend or TypeScript code requires compilation, add a `"build"` script in `package.json` and ensure your build command runs before `npm run start`.
- **Browser Console & Network (`F12`):** Inspect failed network requests, CORS issues, or WebSocket/Socket.IO connection errors on `baja-casino.com`.
