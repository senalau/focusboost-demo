# FocusBoost Deployment Notes

This package has been cleaned for deployment:

- `.env` was removed.
- OpenAI secrets should be configured only on the backend deployment platform.
- Root `.env.example` contains only frontend `VITE_` variables.
- `server/.env.example` contains backend-only variables.
- `node_modules`, `dist`, `.DS_Store`, and `__MACOSX` are excluded from the clean package.

## Backend: Render

Create a new Web Service:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Environment variables:

```txt
OPENAI_API_KEY=your_real_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
```

After deployment, test:

```txt
https://your-backend-url.onrender.com/health
```

## Frontend: Vercel

Create/import the project:

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variable:

```txt
VITE_FOCUSBOOST_API_BASE=https://your-backend-url.onrender.com
```

## Local development

Terminal 1:

```bash
npm install
npm run dev
```

Terminal 2:

```bash
cd server
npm install
OPENAI_API_KEY=your_real_key npm start
```
