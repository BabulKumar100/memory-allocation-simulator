# Memory Allocation Simulator

An interactive, full-stack web application that demonstrates how operating systems allocate memory to processes using four classic memory allocation algorithms: First Fit, Best Fit, Worst Fit, and Next Fit.

**Live Demo:** [Memory Allocation Simulator](https://client-pied-seven-88.vercel.app/)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Allocation Algorithms](#allocation-algorithms)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Limitations](#limitations)

## Overview

Memory allocation is an important concept in operating systems. It involves assigning available memory to processes according to their memory requirements.

This project provides an interactive way to understand and compare different memory allocation strategies. Users can configure memory blocks and processes, execute simulations, view allocation results, and observe how much memory remains available after each allocation.

The application is designed for students, developers, and anyone interested in learning operating system memory management.

## Features

- **Interactive Simulation:** Run memory allocation simulations with customizable memory blocks and processes.
- **Four Allocation Algorithms:** Choose First Fit, Best Fit, Worst Fit, or Next Fit.
- **Memory Visualization:** View memory blocks, allocated processes, and remaining memory.
- **Step-by-Step Results:** Examine allocation states and statistics after each process.
- **Live Statistics:** View memory utilization, free memory, allocated processes, and allocation success rate.
- **Failed Allocation Details:** Identify processes that could not be allocated and inspect the available free memory.
- **Allocation Table:** Review process sizes, assigned blocks, remaining space, and allocation status.
- **CSV Export:** Export simulation results for further analysis.
- **Simulation Reset:** Reset the current simulation and start again.
- **Local Fallback:** The client can use the shared allocation engine locally when the backend is unavailable.
- **Optional History Persistence:** MongoDB can be configured to support simulation history endpoints.

## Allocation Algorithms

### 1. First Fit

First Fit selects the first memory block, in memory order, that has enough remaining space for the current process.

### 2. Best Fit

Best Fit selects the eligible memory block with the smallest amount of remaining space that can accommodate the process.

### 3. Worst Fit

Worst Fit selects the eligible memory block with the largest amount of remaining space.

### 4. Next Fit

Next Fit continues searching from the position after the previous successful allocation. It wraps around to the beginning when necessary.

### Algorithm Comparison

| Algorithm | Selection Strategy |
|---|---|
| First Fit | First suitable block |
| Best Fit | Smallest suitable block |
| Worst Fit | Largest suitable block |
| Next Fit | First suitable block found from the previous search position |

The results depend on the order and sizes of the memory blocks and processes. Running the same workload with different algorithms helps demonstrate how allocation strategies affect memory usage and failed allocations.

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
│   │   ├── components/
│   │   ├── services/
│   │   ├── algorithms/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── algorithms/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── shared/
│   │   └── allocation.js
│   ├── package.json
│   └── server.js
├── shared/
├── package.json
├── .gitignore
├── LICENSE
└── README.md
```

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

Keep the backend and frontend running while testing the complete application.

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

Runs a memory allocation simulation.

Example request:

```json
{
  "algorithm": "firstFit",
  "blocks": [
    { "id": "Block 1", "size": 100 },
    { "id": "Block 2", "size": 500 },
    { "id": "Block 3", "size": 200 }
  ],
  "processes": [
    { "id": "P1", "size": 212 },
    { "id": "P2", "size": 100 }
  ]
}
```

Supported algorithm identifiers:

- `firstFit`
- `bestFit`
- `worstFit`
- `nextFit`

The API validates the submitted data and returns allocation results, memory snapshots, and summary statistics.

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

If deploying from the repository root instead, verify the root `package.json` scripts and ensure all required server files and dependencies are included in the deployment.

## Limitations

- The project does not include authentication or user accounts.
- Persistent simulation history requires a working MongoDB connection.
- Algorithm comparisons are performed by running the algorithms separately.
- The simulator models contiguous memory allocation and does not implement paging, segmentation, or memory compaction.
- Step navigation displays recorded simulation states; it does not represent a real-time operating-system memory allocation process.

## Future Improvements

- Add side-by-side algorithm comparisons.
- Introduce charts for memory utilization and fragmentation.
- Add user accounts and personalized simulation history.
- Improve automated testing and error reporting.
- Expand the simulator with additional memory management techniques.

## License

This project is released under the MIT License. See the [LICENSE](LICENSE) file for details.
