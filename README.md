# Memory Allocation Simulator

An interactive, full-stack web application that demonstrates how operating systems allocate memory to processes. It covers three memory management models — **contiguous allocation**, **paging**, and **segmentation** — and supports the four classic allocation algorithms: First Fit, Best Fit, Worst Fit, and Next Fit.

**Live Demo:** [Memory Allocation Simulator](https://client-pied-seven-88.vercel.app/)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Memory Management Modes](#memory-management-modes)
- [Allocation Algorithms](#allocation-algorithms)
- [Metrics and Calculations](#metrics-and-calculations)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Limitations](#limitations)
- [Future Improvements](#future-improvements)

## Overview

Memory allocation is an important concept in operating systems. It involves assigning available memory to processes according to their memory requirements.

This project provides an interactive way to understand and compare different memory management strategies. Users can switch between contiguous allocation, paging, and segmentation, configure the inputs for each model, execute simulations, and replay the result step by step to observe how memory changes after every operation.

Two ideas are deliberately kept separate in the implementation:

1. **The allocation engine** decides which block, frame, or hole receives which process. It lives in one shared module that is imported unchanged by both the server and the client.
2. **The interface** only renders the result of that engine. It never re-implements the algorithm, so the numbers shown on screen can never drift from the logic that produced them.

The application is designed for students, developers, and anyone interested in learning operating system memory management.

## Features

- **Three Memory Models:** Switch between contiguous allocation, paging, and segmentation from the header.
- **Four Allocation Algorithms:** Choose First Fit, Best Fit, Worst Fit, or Next Fit.
- **Interactive Simulation:** Configure memory blocks, partitions, frames, or segments, then start the simulation.
- **Step-by-Step Replay:** Move through the simulation with Previous, Next, and Finish. Every step is a complete snapshot of memory and metrics produced by the engine, so stepping backward is exact rather than recomputed.
- **Release and Compaction Steps:** In segmentation mode, release operations and compaction are shown as their own steps with a caption describing what happened.
- **Memory Visualization:** Every region is drawn with a width proportional to its size, with allocated processes and free space drawn as proportional segments inside it.
- **Live Statistics:** View memory utilization, free memory, frames used, internal fragmentation, external fragmentation, and allocation success rate.
- **Failed Allocation Details:** Identify processes that could not be allocated, with the reason and the largest free space that existed at that moment.
- **Page Table and Segment Table:** Inspect the page-to-frame mapping in paging mode and the base and limit of every resident segment in segmentation mode.
- **Allocation Table:** Review process sizes, assigned blocks, frames, or segments, remaining space, and allocation status. The table reflects the step currently being viewed.
- **CSV Export:** Export simulation results with mode-specific columns for further analysis.
- **Simulation Reset:** Reset the current simulation and start again.
- **Local Fallback:** The client can run the shared allocation engine locally when the backend is unavailable, and the result is identical because both use the same module.
- **Optional History Persistence:** MongoDB can be configured to support simulation history endpoints.

## Memory Management Modes

### 1. Contiguous Allocation

The simulator models **variable partitioning**. Each listed partition is tracked as a separate region with a running `remaining` counter:

```text
remaining = previous remaining − allocated process size
```

A process is placed in a block as long as that block still has enough free space, which means leftover space inside a partially filled block remains available to later processes. This is why the interface labels that space **Free / Remaining** rather than *wasted* — it is genuinely reusable.

The required input is a list of memory blocks and a queue of processes.

### 2. Paging

Physical memory is divided into equal-sized **frames**, and each process is divided into pages of that same size. Any page can be placed in any free frame, so a process does not need contiguous memory.

- The required input is the physical memory size, the page size, and a queue of processes.
- The number of frames is `floor(physicalMemory / pageSize)`, and any leftover memory that is smaller than one page cannot be used.
- Because the last page of a process is usually partially filled, paging produces **internal fragmentation**, which is always smaller than one page.
- Paging never produces external fragmentation, because every free frame can hold any page.

**This simulator implements static paging:** all pages of a process are allocated up front when the process arrives. It does not implement demand paging, page faults, or page replacement.

Because all frames are the same size, **Best Fit and Worst Fit have no size-based choice left** — they produce the same result as First Fit. Only Next Fit differs, because it searches frames circularly starting after the last placement. The interface explains this in paging mode rather than hiding it.

### 3. Segmentation

A process is divided into logical segments such as Code, Data, and Stack. Each segment must occupy a contiguous region of memory, but different segments of the same process may be placed anywhere.

- The required input is the total physical memory and an ordered list of operations.
- An **allocation** operation adds one or more named segments for a process.
- A **release** operation frees every segment belonging to a process.
- Releasing a process leaves a **hole** in the middle of memory. Adjacent holes are **coalesced** (merged) after every release.
- Because each segment must be contiguous, the model produces **external fragmentation**: total free memory may be sufficient while no single hole is large enough.
- Allocation is **all-or-nothing**. If any segment of a process cannot be placed, the entire process is rolled back, because a half-loaded process is not a valid state.

**Compaction** is applied only when it is genuinely required: when the largest available hole is smaller than the requested segment **and** the total free memory is large enough to satisfy it. If the total free memory is insufficient, compaction is not attempted, and memory is never shifted without a reason. After compaction, the base addresses in the segment table are recomputed from the live memory layout.

## Allocation Algorithms

All four algorithms share the same filtering step: they first collect only the regions that have at least as much free space as the process needs. They differ solely in which of those eligible regions they choose.

| Algorithm | Selection Strategy |
|---|---|
| First Fit | First suitable block |
| Best Fit | Smallest suitable block |
| Worst Fit | Largest suitable block |
| Next Fit | First suitable block found from the previous search position, wrapping around |

### 1. First Fit

First Fit selects the first memory block, in memory order, that has enough remaining space for the current process.

### 2. Best Fit

Best Fit selects the eligible memory block with the smallest amount of remaining space that can accommodate the process.

### 3. Worst Fit

Worst Fit selects the eligible memory block with the largest amount of remaining space.

### 4. Next Fit

Next Fit continues searching from the position after the previous successful allocation. It wraps around to the beginning when necessary.

In segmentation mode, the same four strategies are applied to the list of free holes. In paging mode, only First Fit and Next Fit are meaningfully different, for the reason described above.

The results depend on the order and sizes of the memory blocks and processes. Running the same workload with different algorithms helps demonstrate how allocation strategies affect memory usage and failed allocations.

## Metrics and Calculations

All statistics are produced by the shared engine and are recomputed after every operation, so the values shown while stepping are historically accurate rather than derived from the final state.

| Metric | Applies to | Calculation |
|---|---|---|
| `totalMemory` | All modes | Sum of all block sizes, or frames × page size, or total physical memory |
| `usedMemory` | All modes | Sum of the sizes of all processes currently allocated |
| `freeMemory` | All modes | `totalMemory − usedMemory` |
| `utilization` | All modes | `usedMemory / totalMemory × 100`, rounded to one decimal place |
| `allocatedProcesses` | All modes | Number of processes placed successfully so far |
| `processedProcesses` | All modes | Number of processes handled so far |
| `successRate` | All modes | `allocatedProcesses / processedProcesses × 100` |
| `failedProcesses` | All modes | The identifier, size, and reason for every process that could not be placed |
| `frameCount` | Paging | `floor(physicalMemory / pageSize)` |
| `framesUsed` / `framesFree` | Paging | Number of frames currently occupied and free |
| `unusableMemory` | Paging | `physicalMemory − frameCount × pageSize`, smaller than one page |
| `internalFragmentation` | Paging | `pagesAllocated × pageSize − processSize`, always smaller than one page |
| `pageTableSize` | Paging | Total number of pages currently resident |
| `largestHole` | Segmentation | Size of the largest free region |
| `holesCount` | Segmentation | Number of free regions |
| `externalFragmentation` | Segmentation | `freeMemory − largestHole` |
| `compactions` | Segmentation | Number of times memory was compacted |
| `segmentsResident` | Segmentation | Number of segments currently in memory |
| `releasedProcesses` | Segmentation | Number of processes that have been released |

Three of these values are frequently confused with each other, so they are kept as separate metrics:

```text
freeMemory            = how much memory is empty in total
largestHole           = the largest single free region
externalFragmentation = freeMemory − largestHole
```

External fragmentation is therefore the free memory that cannot satisfy any request in a single contiguous piece. If all free memory sits in one contiguous hole, external fragmentation is zero — which is exactly what compaction achieves.

Failure reasons are reported in kind, not just as a generic error. In contiguous mode the message names the largest free block at that moment; in paging mode it names the number of frames required and available; in segmentation mode it distinguishes "the total free memory is insufficient" from "the largest hole is too small", because those two cases have different remedies.

### Input Limits

The same limits are enforced on the client and on the server.

| Parameter | Allowed range |
|---|---|
| Memory blocks (contiguous) | 1 – 20 |
| Processes | 1 – 20 |
| Physical memory | 4 – 8192 KB |
| Page size | 1 – 512 KB |
| Frames (paging) | 1 – 64 |
| Segments per process | 1 – 6 |

Division by zero is guarded throughout, so an empty workload reports zeroes rather than failing.

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- Axios
- React Router
- Lucide React
- CSS

### Backend
- Node.js
- Express.js
- Mongoose
- CORS
- dotenv

### Database
- MongoDB (optional, for persistent simulation history)

### Deployment
- Vercel for the frontend
- Railway for the backend
- GitHub for source code management

## Project Structure

```text
memory-allocation-simulator/
├── client/
│   ├── src/
│   │   ├── algorithms/
│   │   │   └── defaultData.js       # Default workload for all three modes
│   │   ├── components/
│   │   │   ├── MemoryMap.jsx        # Shared memory visualization
│   │   │   ├── MemoryPartitions.jsx # Block editor (contiguous)
│   │   │   ├── ProcessQueue.jsx     # Process queue (contiguous and paging)
│   │   │   ├── SegmentQueue.jsx     # Segment and release operations
│   │   │   ├── PageTable.jsx        # Page-to-frame mapping
│   │   │   ├── SegmentTable.jsx     # Base and limit of resident segments
│   │   │   ├── StatCard.jsx         # Statistic card
│   │   │   └── Logo.jsx             # Custom memory-chip logo
│   │   ├── services/
│   │   │   ├── api.js               # API client with local fallback
│   │   │   └── helpers.js           # Time formatting and CSV export
│   │   ├── App.jsx                  # Dashboard layout, mode switching and UI state
│   │   ├── main.jsx                 # Application entry point
│   │   └── styles.css               # Complete design system
│   ├── index.html
│   ├── package.json
│   └── vite.config.js               # @shared alias and dev server settings
├── server/
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── controllers/
│   │   ├── simulateController.js    # Handles POST /api/simulate
│   │   └── historyController.js     # Handles saved simulation history
│   ├── models/
│   │   └── Simulation.js            # Mongoose schema
│   ├── routes/
│   │   ├── simulateRoutes.js
│   │   └── historyRoutes.js
│   ├── shared/                      # Single source of truth for all calculation
│   │   ├── allocation.js            # Dispatcher, contiguous engine, validation
│   │   ├── common.js                # Constants, limits, shared metrics
│   │   ├── paging.js                # Paging engine
│   │   └── segmentation.js          # Segmentation engine
│   ├── package.json
│   └── server.js                    # Server bootstrap and middleware
├── package.json                     # Root manifest, used for deployment
├── .gitignore
├── LICENSE
└── README.md
```

The `server/shared/` directory is intentionally dependency-free: it uses no Node-specific APIs and no browser APIs, which is what allows the same files to run under Node on the server and inside the browser bundle on the client.

## Getting Started

### Prerequisites

Install the following before running the project locally:

- Node.js 18 or newer
- npm
- Git (optional, for cloning the repository)
- MongoDB, only if persistent simulation history is required

### 1. Clone the Repository

```bash
git clone https://github.com/BabulKumar100/memory-allocation-simulator.git
cd memory-allocation-simulator
```

### 2. Start the Backend

Open a terminal and run:

```bash
cd server
npm install
```

Create a `.env` file using `.env.example` as a reference, then configure the required environment variables.

Start the development server:

```bash
npm run dev
```

The API normally runs at:

`http://localhost:5000`

Check the health endpoint:

`http://localhost:5000/api/health`

If port 5000 is already in use, an earlier server instance is still running. Stop it, or set a different `PORT` in `server/.env`.

### 3. Start the Frontend

Open a second terminal from the project root and run:

```bash
cd client
npm install
```

Create the frontend environment file using the available `.env.example` as a reference, if provided.

Start the Vite development server:

```bash
npm run dev
```

Open the local URL shown in the terminal. The default Vite development URL is usually:

`http://localhost:5173`

Keep the backend and frontend running while testing the complete application. If the backend is unavailable, the interface still works using the local fallback described above.

## Environment Variables

Configure environment variables according to the actual files and configuration in the project.

### Backend: `server/.env`

| Variable | Purpose |
|---|---|
| `PORT` | Port used by the Express server. Defaults to `5000` locally. |
| `MONGODB_URI` | MongoDB connection string for persistent history. |
| `CLIENT_URL` | Frontend origin allowed by the backend's CORS configuration. |

### Frontend: `client/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL used by the frontend API client, if configured in the code. |

For local development, the API base URL may be:

```env
VITE_API_URL=http://localhost:5000/api
```

For production, use the deployed backend URL with the `/api` suffix if the frontend configuration expects it:

```env
VITE_API_URL=https://memory-allocation-simulator-production-e0e9.up.railway.app/api
```

In Vercel, configure frontend variables under **Project Settings → Environment Variables**. Redeploy after changing environment variables.

On Railway, configure backend variables under the service's **Variables** section.

**Security:** Never commit `.env` files, database credentials, or other secrets to GitHub. Use `.env.example` to document variable names without including secret values.

## API Reference

The backend exposes the following endpoints.

### Health Check

**GET** `/api/health`

Checks whether the API is running.

Example response:

```json
{
  "status": "ok",
  "service": "Memory Allocator API"
}
```

### Run a Simulation

**POST** `/api/simulate`

Runs a memory allocation simulation and returns the full result, including a snapshot for every step. This endpoint requires no database connection.

The request body carries a `mode` field that selects the memory model. If it is omitted, contiguous allocation is used.

Supported modes: `contiguous`, `paging`, `segmentation`.

Supported algorithm identifiers:

- `firstFit`
- `bestFit`
- `worstFit`
- `nextFit`

#### Contiguous allocation request

```json
{
  "mode": "contiguous",
  "algorithm": "firstFit",
  "blocks": [
    { "id": "Block 1", "size": 100 },
    { "id": "Block 2", "size": 500 },
    { "id": "Block 3", "size": 200 },
    { "id": "Block 4", "size": 300 },
    { "id": "Block 5", "size": 600 }
  ],
  "processes": [
    { "id": "P1", "size": 212 },
    { "id": "P2", "size": 417 },
    { "id": "P3", "size": 112 },
    { "id": "P4", "size": 426 }
  ]
}
```

#### Paging request

```json
{
  "mode": "paging",
  "algorithm": "firstFit",
  "physicalMemory": 64,
  "pageSize": 4,
  "processes": [
    { "id": "P1", "size": 10 },
    { "id": "P2", "size": 6 },
    { "id": "P3", "size": 5 }
  ]
}
```

With this input, 16 frames are generated. P1 occupies 3 pages, P2 occupies 2 pages, and P3 occupies 2 pages, so 7 frames are in use and 9 remain free. The internal fragmentation is 7 KB in total, made up of 2 KB, 2 KB, and 3 KB in the last page of each process.

#### Segmentation request

```json
{
  "mode": "segmentation",
  "algorithm": "firstFit",
  "physicalMemory": 1000,
  "processes": [
    { "id": "P1", "segments": [{ "name": "Code", "size": 200 }, { "name": "Data", "size": 150 }] },
    { "id": "P2", "segments": [{ "name": "Code", "size": 300 }] },
    { "id": "P3", "segments": [{ "name": "Code", "size": 200 }] },
    { "id": "P2", "release": true },
    { "id": "P4", "segments": [{ "name": "Code", "size": 400 }] }
  ]
}
```

An operation with `"release": true` frees every segment belonging to that process ID and does not require a `segments` array.

With this input, releasing P2 leaves 450 KB free across two holes while the largest hole is 300 KB, so external fragmentation is 150 KB. The 400 KB request cannot fit in any single hole, so memory is compacted once and placed; free memory afterwards is 50 KB with zero external fragmentation.

#### Response

The response contains:

- `allocations` — the outcome of every operation, including failures and their reasons.
- `steps` — one entry per operation, each holding the memory snapshot, the allocation table, and the metrics at that point in time, together with a descriptive `operation` object.
- `summary` — the metric set for the final step.
- `totalMemory`, `usedMemory`, and mode-specific fields such as `pageSize`, `frameCount`, `unusableMemory`, `pagingType`, or `physicalMemory`.

Every memory snapshot uses the same shape regardless of mode, which is what allows the interface to reuse a single visualization component:

```json
{
  "blockId": "Block 2",
  "label": "Block 2",
  "start": 200,
  "size": 500,
  "allocated": [{ "processId": "P1", "size": 212, "detail": "page 0" }],
  "remaining": 288
}
```

Invalid input returns HTTP 400 with a descriptive message.

### Simulation History

These endpoints require a configured MongoDB connection.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/simulations` | Retrieve saved simulations |
| POST | `/api/simulations` | Save a simulation |
| DELETE | `/api/simulations/:id` | Delete a saved simulation |

History endpoints may return a service-unavailable response when database persistence is not configured.

## Deployment

### Frontend Deployment — Vercel

The frontend is deployed on Vercel.

**Live website:** [https://client-pied-seven-88.vercel.app/](https://client-pied-seven-88.vercel.app/)

For a Vite frontend in this repository, configure the Vercel project with:

- **Root Directory:** `client`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Ensure the frontend API configuration points to the deployed Railway backend.

### Backend Deployment — Railway

The backend is deployed on Railway.

**Backend URL:** [https://memory-allocation-simulator-production-e0e9.up.railway.app](https://memory-allocation-simulator-production-e0e9.up.railway.app)

**Health Check:** [https://memory-allocation-simulator-production-e0e9.up.railway.app/api/health](https://memory-allocation-simulator-production-e0e9.up.railway.app/api/health)

Configure the Railway service according to the selected service root:

- **Root Directory:** `/server` when deploying directly from the server directory.
- **Build Command:** `npm install`, if required by the service configuration.
- **Start Command:** `npm start`.

The backend's `CLIENT_URL` should match the actual frontend origin so that CORS allows requests from the deployed website.

If deploying from the repository root instead, the root `package.json` provides the build and start scripts:

```json
"scripts": {
  "build": "cd server && npm install",
  "start": "node server/server.js"
}
```

Do not use `npm install --prefix server`, because it writes a local file dependency into `server/package.json` and breaks the container build.

**Rule to follow:** nothing under `server/` may import outside `server/`. Any `../../` import in that directory will work locally but fail in production with `ERR_MODULE_NOT_FOUND`, because the shared module must ship inside the deployed directory. This is why the calculation module lives in `server/shared/` and is consumed by the client through a build-time alias.

## Limitations

- The project does not include authentication or user accounts.
- Persistent simulation history requires a working MongoDB connection.
- Algorithm comparisons are performed by running the algorithms separately; there is no side-by-side comparison view.
- Allocation runs to completion in a single request, so there is no live animation of an allocation in progress. The step controls replay the finished result.
- Paging is implemented as **static paging**. Demand paging, page fault handling, and page replacement policies such as FIFO and LRU are not implemented.
- In paging mode, Best Fit and Worst Fit are not meaningfully different from First Fit, because all frames are the same size. The interface states this explicitly rather than presenting four results as if they were distinct.
- Segmentation implements coalescing and compaction, but not swapping or a backing store.
- Step navigation displays recorded simulation states; it does not represent a real-time operating-system memory allocation process.

## Future Improvements

- Add demand paging with page fault handling.
- Add page replacement policies such as FIFO and LRU.
- Add side-by-side algorithm comparisons.
- Introduce charts for memory utilization and fragmentation.
- Add user accounts and personalized simulation history.
- Improve automated testing and error reporting.
- Expand the simulator with additional memory management techniques.

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
