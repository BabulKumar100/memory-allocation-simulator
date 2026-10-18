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
The server is deployed as a standalone service (Railway Root Directory is set to `server`), so the container only receives the contents of `server/`. If the shared module sat at the repo root, the deployed app would crash with `ERR_MODULE_NOT_FOUND: file:///shared/allocation.js`. Keeping it under `server/` means it ships with the server while the client still imports the exact same file through the `@shared` Vite alias, so there is only ever one copy.

To instead deploy from the repo root, remove the Root Directory setting in Railway and add a root `package.json` with `"build": "npm install --prefix server"` and `"start": "node server/server.js"`.

## Notes
- The demo models variable-sized allocations inside each listed memory partition. It keeps each partition as a separate region and reduces its remaining free space after every successful allocation.
- Because leftover space in a partition stays available for later processes, the UI labels it **Free / Remaining** rather than "Wasted". To switch to a strict fixed-partition model, the leftover space would have to be marked unavailable after the first allocation.
- Metrics reported per step: allocated processes, processed processes, success rate, failed processes, free memory and utilization.
- The history API requires a configured MongoDB connection. Login/authentication is not included in this starter.
