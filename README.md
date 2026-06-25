# DealMind AI Dashboard — Backend

This is a small server with one job: securely talk to HubSpot using your
private access token, and hand back clean data to the dashboard frontend.

Your HubSpot token never goes near the browser — it lives only here,
as an environment variable on the hosting platform.

## What this does

- `GET /` — health check, confirms the server is alive
- `POST /api/login` — checks the dashboard password
- `GET /api/contacts` — fetches your HubSpot contacts, extracts lead score /
  category / at-risk status from the notes text, and returns simplified JSON

## Deploying (Railway — recommended, free tier)

1. Go to railway.app and sign up (free, no credit card needed for the free tier)
2. Click "New Project" → "Deploy from GitHub repo" OR "Empty Project" if you
   don't want to use GitHub yet
3. If using an empty project: click "Add a service" → "Empty Service", then
   you can drag-and-drop or upload these files directly, or connect a GitHub repo
4. Once the service exists, go to its "Variables" tab and add:
   - `HUBSPOT_TOKEN` = your real HubSpot token
   - `DASHBOARD_PASSWORD` = a password you choose
   - `ALLOWED_ORIGIN` = `*` for now (we'll tighten this once the frontend is live)
5. Railway will detect this is a Node app and run `npm install` then `npm start`
   automatically
6. Once deployed, Railway gives you a public URL like
   `https://dealmind-backend.up.railway.app` — copy this, the frontend will need it

## Testing it worked

Visit your Railway URL directly in a browser. You should see:
```json
{"status": "DealMind AI dashboard backend is running"}
```

If you see that, the backend is live and ready for the frontend to connect to it.

## Important notes

- Never commit a real `.env` file with your actual token to GitHub — use
  `.env.example` as the template only, and set real values in Railway's
  Variables tab instead
- The lead score / category extraction in this version is a simple text
  search inside whatever HubSpot properties contain text. If your AI Agent
  saves the lead score somewhere specific (like a custom property), tell
  Claude and this can be made more precise
