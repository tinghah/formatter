# Excel Formatter ⚡

A local workstation for uploading, viewing, cleaning, and transforming Excel files — with a live spreadsheet viewer, process logging, and RPA-like action recording.

## Features

- **Live Spreadsheet Viewer** — Interactive Excel display powered by jspreadsheet-ce
- **Data Clean Tool** — Convert each sheet to CSV with PostgreSQL column type suggestions
- **Action Recorder** — RPA-style recording and playback of spreadsheet operations
- **Recent Files** — Browser-cached workspace with instant file access
- **Dark Theme** — Premium glassmorphism UI with smooth animations

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Install

```bash
cd d:\coding\formatter
npm install
cd client && npm install && cd ..
```

### Run (Development)

```bash
npm run dev
```

Or use the batch files:
```
start_server.bat   # Start both servers
stop_server.bat    # Stop both servers
```

### Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8181 |
| Backend API | http://localhost:5555 |

## Architecture

```
├── server/          # Express.js backend (port 5555)
│   ├── routes/      # API endpoints (files, users, tools)
│   ├── data/        # JSON user table + uploads
│   └── output/      # Generated CSV files
├── client/          # Vite frontend (port 8181)
│   └── src/
│       ├── core/    # Storage, API, Logger
│       ├── views/   # Workspace, Workbook
│       ├── components/ # Spreadsheet, LogPanel, ToolPanel
│       └── tools/   # DataClean, Recorder, ToolManager
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files/upload` | POST | Upload Excel file |
| `/api/files/list` | GET | List all uploaded files |
| `/api/files/:id` | GET | Get file data |
| `/api/tools/data-clean` | POST | Run Data Clean |
| `/api/users/:id` | GET/PUT | User management |

## License

MIT
