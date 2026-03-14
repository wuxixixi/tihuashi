# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

墨韵 AI (Mo Yun AI) is an AI-powered Chinese painting appreciation and poetry composition application. Users upload Chinese paintings, receive AI-generated analysis, and can generate poems in various classical Chinese styles based on their personal reflections.

## Commands

### Backend (from `backend/`)
```bash
npm start          # Run server (port 3001 by default)
npm test           # Run Jest integration tests
npm run test:watch # Run tests in watch mode
```

### Frontend (from `frontend/`)
```bash
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm test           # Run Vitest tests
npm run test:watch # Run tests in watch mode
```

### Run All Tests
```bash
cd backend && npm test && cd ../frontend && npm test
```

## Architecture

### Backend (`backend/server.js`)
- **Framework**: Express.js single-file server
- **Database**: SQLite via `better-sqlite3` with WAL mode (file: `moyun.db`)
- **File Uploads**: Multer, stored in `backend/uploads/`, max 10MB, supports jpeg/jpg/png/webp
- **AI Integration**:
  - Image analysis: Doubao Vision API (multimodal, streaming SSE responses)
  - Poetry generation: DMX API (OpenAI-compatible chat completions)
  - API credentials configured via environment variables (see `backend/.env.example`)

### Frontend (`frontend/src/`)
- **Framework**: React 18 with Vite
- **Structure**:
  - `App.jsx` - Main component with tab navigation (Create/History)
  - `components/` - UI components (UploadPanel, PoemPanel, HistoryPanel, etc.)
  - `contexts/` - React contexts (ThemeContext, ToastContext)
  - `hooks/` - Custom hooks (useKeyboardShortcuts)
- **API Base**: `http://localhost:3001` (hardcoded in App.jsx)

### Key API Endpoints
- `POST /api/upload` - Upload image
- `POST /api/analyze` - Analyze painting with vision AI
- `POST /api/poem` - Generate poem based on analysis and user feeling
- `GET /api/history` - List history with pagination/search/filter
- `POST /api/save` - Save a record
- `PATCH /api/history/:id` - Edit poem/title
- `PATCH /api/history/:id/favorite` - Toggle favorite
- `DELETE /api/history/:id` - Delete record
- `GET /api/export` - Export history (JSON/CSV)
- `POST /api/import` - Import records

### Poetry Styles
Defined in `STYLE_PROMPTS` object in server.js: 五言绝句, 七言绝句, 五言律诗, 七言律诗, 古体诗, and various 词 styles (婉约, 豪放, 田园, 边塞).

## Testing

- **Backend**: Integration tests in `backend/__tests__/server.integration.test.js` using Jest + supertest. External AI calls are mocked. Uses separate test database (`test-moyun.db`).
- **Frontend**: Unit tests in `frontend/src/App.test.jsx` using Vitest + @testing-library/react with mocked fetch.

## Deployment

Both services have Dockerfiles:
- Backend: `backend/Dockerfile` - node:18-alpine, exposes port 3001
- Frontend: `frontend/Dockerfile` - Multi-stage build, nginx:alpine, exposes port 80

## Environment Variables

Backend requires (see `.env.example`):
- `DMX_API_KEY` - API key for DMX/Doubao services
- `DMX_BASE_URL` - API base URL (default: https://www.dmxapi.cn/v1)
- `DMX_MODEL` - Text model (default: gpt-5-mini)
- `VISION_MODEL` - Vision model (default: Doubao-1.5-vision-pro-32k)
- `PORT` - Server port (default: 3001)
- `DB_PATH` - SQLite database path (optional)
