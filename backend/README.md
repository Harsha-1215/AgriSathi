# AGRISATHI API

This is a CommonJS Express service, listening on port 5001 by default so it can run alongside the existing frontend API on port 5000. Authentication, farmer, assistant, and crop-doctor endpoints use the same PostgreSQL user and role records and the shared HTTP-only JWT cookie; they do not create a separate account system per module. Protected routes verify the JWT cookie (or bearer token) using `JWT_SECRET` and `AUTH_COOKIE_NAME`. Do not copy production keys into this repository.

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm run db:sync
npm run dev
```

Run `npm run db:sync` to create the module tables in a local database. Production schema changes should use migrations. The API fails fast when the database URL or shared JWT secret is missing.

Use `npm run db:migrate` to apply tracked production schema changes. An initial administrator can be provisioned with `npm run auth:provision-admin` using the required admin environment values; never enable public administrator registration.

## APIs

- `POST /api/auth/register`
- `POST /api/auth/voice/register`
- `POST /api/auth/voice/verify-registration`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh-token`
- `GET /api/auth/me`
- `PUT /api/auth/interaction-mode`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-reset-otp`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET /api/public/platform-info`
- `GET /api/public/features`
- `GET /api/public/homepage-content`
- `GET /api/public/announcements`
- `GET /api/public/featured-crops`
- `GET /api/public/featured-videos`
- `GET /api/public/featured-products`
- `GET /api/public/featured-services`
- `GET /api/public/statistics`
- `POST /api/public/contact`
- `POST /api/public/newsletter/subscribe`
- `POST /api/public/newsletter/unsubscribe`
- `GET|PUT /api/farmers/profile`
- `GET /api/farmers/profile/completion`
- `GET|POST /api/farmers/farms`
- `GET|PUT|DELETE /api/farmers/farms/:id`
- `GET|POST /api/farmers/crops`
- `GET|PUT|DELETE /api/farmers/crops/:id`
- `GET /api/farmers/dashboard`
- `GET /api/farmers/dashboard/weather`
- `GET /api/farmers/dashboard/upcoming-activities`
- `GET /api/farmers/dashboard/recommended-videos`
- `POST /api/assistant/ask`
- `POST /api/assistant/transcribe`
- `POST /api/assistant/speech`
- `GET /api/voice/settings`
- `POST /api/voice/speech-to-text`
- `POST /api/voice/process-command`
- `POST /api/voice/text-to-speech`
- `POST /api/voice/session`
- `GET /api/voice/session/:id`
- `GET|POST /api/bookings`
- `GET /api/bookings/:id`
- `PUT /api/bookings/:id/status`
- `GET /api/assistant/languages`
- `GET /api/assistant/settings`
- `POST|GET /api/assistant/conversations`
- `GET /api/assistant/conversations/:id`
- `GET|POST /api/assistant/conversations/:id/messages`
- `DELETE /api/assistant/conversations/:id`
- `POST /api/assistant/conversations/:conversationId/messages/:messageId/feedback`
- `POST /api/crop-doctor/analyze` (multipart field `image`)
- `GET /api/crop-doctor/history`
- `GET /api/crop-doctor/history/:id`
- `GET /api/crop-doctor/history/:id/status`
- `POST /api/crop-doctor/history/:id/feedback`
- `DELETE /api/crop-doctor/history/:id`
- `GET /api/crop-doctor/crops`
- `GET /api/crop-doctor/diseases`
- `GET /api/crop-doctor/diseases/:id`
- `POST /api/crop-doctor/consultation`
- `GET /api/weather/current`
- `GET /api/weather/forecast`
- `GET /api/weather/forecast/hourly`
- `GET /api/weather/alerts`
- `GET /api/weather/advisory`
- `GET /api/weather/search?q=...`
- `GET|POST /api/weather/locations`
- `PATCH /api/weather/locations/:id/default`
- `DELETE /api/weather/locations/:id`
- `GET|PUT /api/weather/preferences`
- `POST /api/land-measurements/calculate`
- `POST /api/land-measurements/convert`
- `POST /api/land-measurements/boundaries`
- `GET /api/land-measurements/units`
- `GET /api/land-measurements/location`
- `POST|GET /api/land-measurements`
- `GET|PUT|DELETE /api/land-measurements/:id`
- `GET /api/calculators/supported`
- `POST /api/calculators/convert`
- `GET /api/calculators/recommendations`
- `POST /api/calculators/:type/calculate` (`seed`, `fertilizer`, `pesticide`, `irrigation`, `spacing`, `yield`, `expenses`, `profit-loss`, `loan`)
- `GET /api/calculators/history`
- `GET|DELETE /api/calculators/history/:id`
- `GET /api/crop-knowledge/categories`
- `GET /api/crop-knowledge/search?q=...`
- `GET /api/crop-knowledge/diseases`
- `GET /api/crop-knowledge/pests`
- `GET /api/crop-knowledge/:cropId/fertilizer`
- `GET /api/crop-knowledge/:cropId/irrigation`
- `GET /api/crop-knowledge/crops`
- `GET /api/crop-knowledge/crops/:cropId`
- `GET /api/crop-knowledge/calendars`
- `GET /api/crop-knowledge/recommendations`
- `GET /api/crop-knowledge/bookmarks`
- `POST|DELETE /api/crop-knowledge/bookmarks/:cropId`
- `GET /api/crop-knowledge/recent`
- `GET /api/market/commodities`
- `GET /api/market/prices`
- `GET /api/market/compare`
- `GET /api/market/history/:commodityId`
- `GET|POST|DELETE /api/market/favorites`
- `GET|POST|DELETE /api/market/price-alerts`
- `POST /api/admin/market/sync`
- `GET|POST|PUT /api/admin/crop-knowledge/crops`
- `POST /api/admin/crop-knowledge/categories`
- `POST|PUT /api/admin/crop-knowledge/pests`
- `POST|PUT /api/admin/crop-knowledge/diseases`
- `GET /api/admin/crop-knowledge/pending`
- `POST /api/admin/crop-knowledge/crops/:cropId/image` (multipart field `image`)
- `GET /api/admin/crop-knowledge/knowledge`
- `POST /api/admin/crop-knowledge/crops/:cropId/knowledge`
- `PUT /api/admin/crop-knowledge/knowledge/:id`
- `GET /api/admin/crop-knowledge/knowledge/:id/revisions`
- `POST /api/admin/crop-knowledge/crops/:cropId/stages`
- `POST /api/admin/crop-knowledge/crops/:cropId/calendars`
- `POST /api/admin/crop-knowledge/recommendations`

Weather forecasts use live Open-Meteo data and never substitute sample values. Official severe alerts require an explicitly configured `WEATHER_ALERTS_URL`; without it, the API reports that official alerts are unavailable. Gemini, Hugging Face, Cloudinary, Google speech, and TTS endpoints return a clear service-unavailable error when credentials are missing.

Land plot records and boundaries are private to the authenticated farmer. Polygon areas are computed geodesically on the server and self-intersecting or malformed boundaries are rejected. GPS and map values are estimates, not legal or survey-grade measurements. Bigha conversion is disabled unless both `BIGHA_REGION` and `BIGHA_SQUARE_METERS` are configured for the local convention.

Crop Doctor stores private Cloudinary assets and only returns expiring signed image URLs to the authenticated owner. Before analysis, farmers must consent to sending the image to the configured external provider (`CROP_DOCTOR_PROVIDER=gemini` or `huggingface`); consent and its timestamp are stored with the report. Hugging Face inference is optional, requires `HUGGINGFACE_API_TOKEN`, and depends on provider availability and quota. The default PlantVillage classifier has limited crop coverage and is not validated for field conditions. All model output is preliminary, not a confirmed diagnosis; confidence scores are not returned, and the system does not generate chemical dosage advice.

Set `EXPERT_CONSULTATION_API_URL` only when an existing consultation API is available. Requests are forwarded to that configured API; no duplicate consultation database or public image access is created. Images are included only when the farmer explicitly consents and `CONSULTATION_ALLOW_IMAGE=true`.

Authentication uses the existing user and role tables. Manual registration supports farmer, provider, buyer, and seller profiles and remains OTP-free; public admin and agricultural-expert registration are disabled. The separate Telugu voice-registration path creates a farmer account only after SMS OTP verification. Password recovery also uses SMS OTP; email addresses are not accepted for OTP. After verifying a recovery code, the user is signed in directly without changing their password. OTP delivery requires an SMS provider, except for the explicit non-production `AUTH_TEST_OTP_ENABLED=true` option. Service-provider profiles remain pending until an administrator approves them.

SMS Horizon recovery OTP delivery uses `SMSHORIZON_API_KEY`, `SMSHORIZON_USERNAME`, the registered 6-character `SMSHORIZON_SENDER_ID`, `SMSHORIZON_DLT_TEMPLATE_ID`, and the exact approved DLT message in `SMSHORIZON_OTP_MESSAGE_TEMPLATE` with its approved OTP placeholder. The adapter sends URL-encoded fields to the documented SMS Horizon endpoint using Bearer authentication. Do not put API keys in source code or commit `.env`; rotate any key shared in chat or logs.

Password login remains the normal sign-in method. The forgot-password flow sends a recovery OTP only to the registered mobile; successful verification creates a normal authenticated session without changing the existing password. Users may save and switch between normal and voice interaction modes. Voice commands reuse the existing assistant conversation and message tables, and return live marketplace, market-price, approved provider, order, booking, or livestock data where available. Voice listing commands do not create or publish products; they ask for missing details and require the farmer to use the marketplace listing workflow. Service booking requests are only created after explicit confirmation and are visible to the farmer and provider.

The farmer dashboard reads only the signed-in farmer's profile, farms, and crops. Market prices are not seeded or fabricated: an administrator must configure an authorized Data.gov.in resource, unit conventions, and `MARKET_DATA_API_KEY` before synchronizing. Assistant context is limited to the farmer's crop records, published crop knowledge, optional weather, and approved livestock listings; requests are capped by `ASSISTANT_DAILY_LIMIT`.

Crop Doctor only accepts crops from the active crop catalog and published disease references. Reports, images, and feedback are owner-scoped. Model labels are not treated as confidence scores; hosted-model advice is shown only when an exact crop/disease label match exists in published guidance. Published crops and agricultural recommendations require a source.

Smart calculator requests and history are scoped to the authenticated farmer. Seed, nutrient, water, plant population, yield, expenses, and loan outputs are arithmetic estimates from submitted values; no agronomic rates, market prices, loan eligibility, or pesticide instructions are fabricated. Pesticide calculations require confirmation of the entered product-label rate and a source reference. Bigha is not included in calculator conversions without a regional convention.

The local database setup command seeds crop names and broad categories for the Crop Knowledge Hub. Those records deliberately contain no invented seasons, lifecycle durations, dosages, or recommendations. The catalog only shows source-verified cultivation material after an authorized `admin` or `agricultural_content_manager` publishes it with a source. Admin publishing records the publisher and time, and article updates create a revision snapshot. Crop images are optional, signature-checked JPEG/PNG/WebP uploads stored in the public crop-library folder; configure the existing Cloudinary credentials to enable uploads.
