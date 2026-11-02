# TaskFlow

A small team task tracker built with React, Express and MongoDB. Create projects, share them with teammates, and move tasks from to do through in progress to done.

## Run locally

You need Node.js 20+ and MongoDB. To run MongoDB with Docker, use `docker compose up -d` from the project root.

Copy `.env.example` to `backend/.env`. Replace `JWT_SECRET` with a long random value before starting the API.

Start the backend:

```sh
cd backend
npm install
npm run seed
npm run dev
```

In a second terminal, start the frontend:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The API runs at http://localhost:4101; its public health check is `/api/health`.

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

## Demo accounts

Run `npm run seed` in `backend` first. Both accounts share the two sample projects.

| Account | Email | Password |
| --- | --- | --- |
| Aarav Shah (project owner) | aarav@taskflow.example | TaskflowDemo123! |
| Meera Rao (team member) | meera@taskflow.example | TaskflowDemo123! |

Use the credentials above to sign in. You can also register a separate account; new accounts start with an empty workspace.

The seed adds two projects: Customer portal launch and Support knowledge base. They contain seven tasks with descriptions, priorities, assignees and due dates, plus an initial activity entry per project. All names and records are fictional.

Rerunning the seed preserves existing account passwords and task edits and does not duplicate records. It recreates missing sample records. The script refuses to run when `NODE_ENV=production`; use it only against a local demo database.

## What is implemented

- Registration and sign-in with bcrypt password hashes and JWT sessions that expire after 12 hours.
- A responsive workspace with project navigation, live progress summaries, and board/list views.
- Task creation, editing, due dates, priorities and deletion, with drag-and-drop status changes.
- Task search, priority filtering and a project activity feed.
- Owner/member access checks for private project resources.
- API routes for project editing/deletion, adding registered members by email, and viewing activity.

Member management and task assignment are not exposed in the current UI. The data model supports assignees, but the API does not yet offer assignment editing.

## Configuration

Backend settings are listed in `.env.example`. The frontend defaults to `http://localhost:4101/api`; set `VITE_API_URL` in `frontend/.env` to use another API address. Keep the configured `CLIENT_URL` consistent with the frontend origin.

## Checks

```sh
cd backend
npm test
```

The API smoke test uses a separate temporary MongoDB database and removes it afterward. MongoDB must be running locally.

```sh
cd frontend
npm run build
```

## Repository notes

`backend/src` contains the API, models, authentication and seed script. `frontend/src` contains the React workspace and API client. Docker Compose starts only MongoDB.

Environment files, installed packages and build output are ignored by Git. Demo passwords above are public local-development credentials; never reuse them for a deployed account. Before deploying, replace local settings, use HTTPS, and review token storage and login abuse protection.
