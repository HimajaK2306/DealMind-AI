// DealMind AI Dashboard Backend
// This server's only job: securely talk to HubSpot using a private token
// (stored as an environment variable, never exposed to the browser),
// and return clean, simplified JSON to the dashboard frontend.

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Config (set these as environment variables on Railway/Render) ----
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN; // your HubSpot Private App / Service Key token
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD; // simple shared password for the dashboard
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // set this to your Vercel URL once deployed

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ---- Simple password check middleware ----
// The frontend sends the password in a header on every request.
function checkPassword(req, res, next) {
  const providedPassword = req.headers['x-dashboard-password'];
  if (!DASHBOARD_PASSWORD) {
    return res.status(500).json({ error: 'Server misconfigured: DASHBOARD_PASSWORD not set' });
  }
  if (providedPassword !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  next();
}

// ---- Health check (no password needed, useful for testing deployment) ----
app.get('/', (req, res) => {
  res.json({ status: 'DealMind AI dashboard backend is running' });
});

// ---- Login endpoint: frontend calls this first to verify the password ----
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!DASHBOARD_PASSWORD) {
    return res.status(500).json({ error: 'Server misconfigured: DASHBOARD_PASSWORD not set' });
  }
  if (password === DASHBOARD_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Incorrect password' });
});

// ---- Main endpoint: fetch and simplify contact data from HubSpot ----
app.get('/api/contacts', checkPassword, async (req, res) => {
  try {
    if (!HUBSPOT_TOKEN) {
      return res.status(500).json({ error: 'Server misconfigured: HUBSPOT_TOKEN not set' });
    }

    // Properties we want back from HubSpot for each contact.
    // Adjust these names if your HubSpot property internal names differ.
    const properties = [
      'firstname',
      'lastname',
      'email',
      'company',
      'jobtitle',
      'phone',
      'lastmodifieddate',
      'createdate',
      'hs_lead_status',
      'notes_last_contacted',
      'hs_content_membership_notes', // fallback, not always used
    ];

    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=${properties.join(',')}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'HubSpot API error', details: errText });
    }

    const data = await response.json();

    // We also need the lead score / notes text, which DealMind AI saves
    // into the contact's "notes" via engagements, not a simple property.
    // For now, we look for a custom property pattern (Lead Score: 85/100 - Hot Lead)
    // inside any text property that contains it, as a simple first pass.
    const contacts = (data.results || []).map((c) => {
      const p = c.properties || {};
      const allText = Object.values(p).filter(Boolean).join(' ');
      const scoreMatch = allText.match(/Lead Score:\s*(\d{1,3})\/100/i);
      const categoryMatch = allText.match(/-\s*(Hot|Warm|Cold)\s*Lead/i);
      const atRisk = /At Risk Client/i.test(allText);

      return {
        id: c.id,
        firstName: p.firstname || '',
        lastName: p.lastname || '',
        email: p.email || '',
        company: p.company || '',
        jobTitle: p.jobtitle || '',
        phone: p.phone || '',
        leadScore: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
        leadCategory: categoryMatch ? categoryMatch[1] : null,
        atRisk,
        createdDate: p.createdate || null,
        lastModified: p.lastmodifieddate || null,
      };
    });

    res.json({ contacts });
  } catch (err) {
    console.error('Error fetching HubSpot contacts:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`DealMind AI dashboard backend running on port ${PORT}`);
});
