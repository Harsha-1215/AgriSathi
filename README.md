# AGRISATHI

The project is organized as a frontend application and a CommonJS backend:

- `frontend/` — React and Vite application.
- `backend/` — Express API, Sequelize models, and PostgreSQL integrations.

## Run locally

1. Copy `frontend/.env.example` to `frontend/.env`. Keep `VITE_API_BASE_URL` pointed at the existing authentication/farmer API; `VITE_MODULE_API_BASE_URL` points to the new module service.
2. Install frontend dependencies with `npm --prefix frontend install`.
3. Copy `backend/.env.example` to `backend/.env`. Configure PostgreSQL, the existing JWT cookie contract, and only the providers you intend to use.
4. Install backend dependencies with `npm --prefix backend install`.
5. Create the backend tables with `npm --prefix backend run db:sync` for local development.
6. Start the module API with `npm run dev:backend` (port 5001 by default) and the UI with `npm run dev`. The existing auth/farmer API must also be running at its configured URL.

The root `npm run build` command builds the frontend. The module backend verifies the existing API's JWT cookie and does not replace its authentication or farmer-data routes. It requires a configured database and matching JWT secret; AI, speech, image-storage, and official-alert integrations report unavailable until their environment settings are supplied. Never put provider credentials in `frontend/.env`.

## Backend API

The authenticated APIs for the voice assistant, Crop Doctor, weather, land measurement, smart farming calculators, and Crop Knowledge Hub are mounted below `/api`. See `backend/README.md` for endpoints and provider details. Land boundaries and calculator histories remain private to their farmer. Calculator results are input-based estimates rather than agronomic recommendations; pesticide math requires a user-confirmed label rate. The crop catalog does not fabricate cultivation advice or seasonal calendars: those appear only after source-attributed admin verification. The land map defaults to attributed OpenStreetMap tiles. Review the tile provider's current usage policy for deployment traffic and configure a compliant provider through `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION` when needed.
