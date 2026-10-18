# Memory Allocation Simulator

A MERN-based Operating Systems project inspired by the supplied dark dashboard reference. Includes First Fit, Best Fit, Worst Fit, Next Fit, process queue, memory partitions, step navigation, result table, CSV export, API, and optional MongoDB history endpoints.

## Requirements
- Node.js 18+ (Node 20 LTS recommended)
- npm
- MongoDB Atlas only if you want persistence/history

## Run locally

### 1. Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
The simulation API works without MongoDB. To enable saved history endpoints, set `MONGODB_URI` in `server/.env`.

### 2. Frontend (new terminal)
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL, normally http://localhost:5173.

The frontend has a local JavaScript fallback if the API is not running, but run both servers to test the full-stack API.

## Important folders
- `server/shared/allocation.js`: single source of truth for allocation logic, limits and validation (imported by both server and client)
- `client/src/App.jsx`: main dashboard and UI state
- `client/src/components/MemoryMap.jsx`: memory visualization
- `server/controllers/simulateController.js`: REST handler for `/api/simulate`
- `server/routes/`: REST API routes
- `server/models/Simulation.js`: MongoDB schema

### Why `shared` lives inside `server/`
The deployed module must ship with the code that imports it. If the shared module sat at the repo root while the service only receives `server/`, the app would crash at runtime with `ERR_MODULE_NOT_FOUND: file:///shared/allocation.js`. Keeping it under `server/` means it always ships alongside `server.js`, while the client still imports the exact same file through the `@shared` Vite alias, so there is only ever one copy.

Rule to follow: nothing under `server/` may import outside `server/` (no `../../` imports), otherwise the deployed app breaks.

### Deployment
The root `package.json` exists only so the builder can build and start the server without any dashboard configuration:

- `build`: `npm install --prefix server` — installs the server dependencies
- `start`: `node server/server.js` — starts the API

This works whether the Railway service root is the repository root or is set to `server/`, because `server/package.json` also has its own `start` script.

Set `MONGODB_URI` in the service variables to enable history storage; without it the simulation API still works and history endpoints are disabled.

## Notes
- The demo models variable-sized allocations inside each listed memory partition. It keeps each partition as a separate region and reduces its remaining free space after every successful allocation.
- Because leftover space in a partition stays available for later processes, the UI labels it **Free / Remaining** rather than "Wasted". To switch to a strict fixed-partition model, the leftover space would have to be marked unavailable after the first allocation.
- Metrics reported per step: allocated processes, processed processes, success rate, failed processes, free memory and utilization.
- The history API requires a configured MongoDB connection. Login/authentication is not included in this starter.
