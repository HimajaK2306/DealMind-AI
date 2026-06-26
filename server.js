// DealMind AI Dashboard Backend — v2
// Adds: HubSpot Notes/Engagements (last meeting summary)
//       Google Calendar events (upcoming meeting, matched by attendee email)
//       A per-contact detail endpoint for the new contact detail page

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Config ----
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ---- Google Calendar client setup ----
let calendarClient = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  calendarClient = google.calendar({ version: 'v3', auth: oAuth2Client });
}

// ---- Password check middleware ----
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

app.get('/', (req, res) => {
  res.json({ status: 'DealMind AI dashboard backend is running', calendarConnected: !!calendarClient });
});

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

// ---- Helper: parse lead score/category/at-risk out of any text blob ----
function extractLeadSignals(text) {
  const scoreMatch = text.match(/Lead Score:\s*(\d{1,3})\/100/i);
  const categoryMatch = text.match(/-\s*(Hot|Warm|Cold)\s*Lead/i);
  const atRisk = /At Risk Client/i.test(text);
  return {
    leadScore: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
    leadCategory: categoryMatch ? categoryMatch[1] : null,
    atRisk,
  };
}

// ---- Helper: fetch HubSpot contacts (basic properties) ----
async function fetchHubspotContacts() {
  const properties = [
    'firstname', 'lastname', 'email', 'company', 'jobtitle', 'phone',
    'lastmodifieddate', 'createdate',
  ];
  const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=${properties.join(',')}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HubSpot contacts error: ${errText}`);
  }
  const data = await response.json();
  return data.results || [];
}

// ---- Helper: fetch Notes engagements associated with a contact ----
// Uses the v3 associations + engagements approach: get note IDs associated
// with the contact, then fetch each note's body.
async function fetchContactNotes(contactId) {
  try {
    // 1. Get associated note IDs
    const assocUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/notes`;
    const assocRes = await fetch(assocUrl, {
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
    });
    if (!assocRes.ok) return [];
    const assocData = await assocRes.json();
    const noteIds = (assocData.results || []).map((r) => r.toObjectId || r.id).filter(Boolean);
    if (noteIds.length === 0) return [];

    // 2. Fetch each note's body (limit to most recent 5 to keep it light)
    const idsToFetch = noteIds.slice(-5);
    const notes = [];
    for (const noteId of idsToFetch) {
      const noteUrl = `https://api.hubapi.com/crm/v3/objects/notes/${noteId}?properties=hs_note_body,hs_timestamp`;
      const noteRes = await fetch(noteUrl, {
        headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
      });
      if (noteRes.ok) {
        const noteData = await noteRes.json();
        notes.push({
          id: noteId,
          body: noteData.properties?.hs_note_body || '',
          timestamp: noteData.properties?.hs_timestamp || null,
        });
      }
    }
    // Most recent first
    notes.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return notes;
  } catch (err) {
    console.error('Error fetching notes for contact', contactId, err.message);
    return [];
  }
}

// ---- Helper: find upcoming Google Calendar event for a given email ----
async function findUpcomingMeeting(email) {
  if (!calendarClient || !email) return null;
  try {
    const now = new Date().toISOString();
    const oneYearOut = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const res = await calendarClient.events.list({
      calendarId: 'primary',
      timeMin: now,
      timeMax: oneYearOut,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = res.data.items || [];
    const match = events.find((ev) =>
      (ev.attendees || []).some((a) => (a.email || '').toLowerCase() === email.toLowerCase())
    );

    if (!match) return null;

    return {
      summary: match.summary || '',
      description: match.description || '',
      start: match.start?.dateTime || match.start?.date || null,
      end: match.end?.dateTime || match.end?.date || null,
      meetLink: match.hangoutLink || null,
      htmlLink: match.htmlLink || null,
    };
  } catch (err) {
    console.error('Error fetching calendar events:', err.message);
    return null;
  }
}

// ---- Main contacts list endpoint (lightweight, for the table view) ----
app.get('/api/contacts', checkPassword, async (req, res) => {
  try {
    if (!HUBSPOT_TOKEN) {
      return res.status(500).json({ error: 'Server misconfigured: HUBSPOT_TOKEN not set' });
    }

    const rawContacts = await fetchHubspotContacts();

    // For the list view, we still need lead score/category, which lives in
    // notes text. To keep the list endpoint fast, we only check notes for
    // this if not already inferable — full detail is fetched on the detail page.
    const contacts = await Promise.all(
      rawContacts.map(async (c) => {
        const p = c.properties || {};
        const notes = await fetchContactNotes(c.id);
        const allNoteText = notes.map((n) => n.body).join(' ');
        const signals = extractLeadSignals(allNoteText);

        return {
          id: c.id,
          firstName: p.firstname || '',
          lastName: p.lastname || '',
          email: p.email || '',
          company: p.company || '',
          jobTitle: p.jobtitle || '',
          phone: p.phone || '',
          leadScore: signals.leadScore,
          leadCategory: signals.leadCategory,
          atRisk: signals.atRisk,
          createdDate: p.createdate || null,
          lastModified: p.lastmodifieddate || null,
        };
      })
    );

    res.json({ contacts });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ---- Detail endpoint: full picture for one contact ----
app.get('/api/contacts/:id', checkPassword, async (req, res) => {
  try {
    if (!HUBSPOT_TOKEN) {
      return res.status(500).json({ error: 'Server misconfigured: HUBSPOT_TOKEN not set' });
    }

    const { id } = req.params;
    const properties = [
      'firstname', 'lastname', 'email', 'company', 'jobtitle', 'phone',
      'lastmodifieddate', 'createdate',
    ];
    const contactUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${id}?properties=${properties.join(',')}`;
    const contactRes = await fetch(contactUrl, {
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
    });

    if (!contactRes.ok) {
      const errText = await contactRes.text();
      return res.status(contactRes.status).json({ error: 'HubSpot API error', details: errText });
    }

    const contactData = await contactRes.json();
    const p = contactData.properties || {};

    const notes = await fetchContactNotes(id);
    const allNoteText = notes.map((n) => n.body).join(' ');
    const signals = extractLeadSignals(allNoteText);

    const upcomingMeeting = await findUpcomingMeeting(p.email);

    res.json({
      id,
      firstName: p.firstname || '',
      lastName: p.lastname || '',
      email: p.email || '',
      company: p.company || '',
      jobTitle: p.jobtitle || '',
      phone: p.phone || '',
      leadScore: signals.leadScore,
      leadCategory: signals.leadCategory,
      atRisk: signals.atRisk,
      createdDate: p.createdate || null,
      lastModified: p.lastmodifieddate || null,
      notes, // array of { id, body, timestamp }, most recent first
      upcomingMeeting, // object or null
    });
  } catch (err) {
    console.error('Error fetching contact detail:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`DealMind AI dashboard backend (v2) running on port ${PORT}`);
  console.log(`Google Calendar connected: ${!!calendarClient}`);
});
