# DealMind AI

An autonomous sales assistant that takes over the moment a sales meeting ends. It transcribes the call, analyzes the conversation, updates the CRM, sends personalized follow-up emails, books the next meeting, and flags at-risk deals, all without any manual input from the sales rep.

---

## Problem Statement

Sales reps spend only about 34% of their time actually selling. The rest goes into repetitive admin work that follows every meeting:

- Writing meeting notes
- Updating the CRM
- Sending follow-up emails
- Booking the next meeting
- Remembering and tracking action items

This work is necessary but repetitive, and it pulls reps away from the part of the job that actually drives revenue. DealMind AI removes this admin layer entirely so a sales rep's only responsibility is to show up, have the conversation, and close the deal.

---

## Project Overview

The moment a sales meeting ends, DealMind AI:

1. Reads the full meeting transcript using GPT-4o
2. Extracts a summary, action items, buying signals, sentiment, and the next follow-up date mentioned
3. Scores the lead out of 100 and categorizes it as Hot, Warm, or Cold
4. Creates or updates the contact in HubSpot with their name, enriched company data, and meeting notes
5. Sends a tailored internal summary email to the sales rep
6. Sends a different, sentiment-matched follow-up email to the client
7. Books the next meeting automatically with a Google Meet link attached, and notifies the client
8. If the meeting went poorly, flags the contact as at risk in HubSpot, alerts the sales rep immediately, and books a recovery meeting within 24 hours instead of waiting

A companion web dashboard lets the sales rep log in and see the entire pipeline at a glance: every contact, their lead score, their status, and on a dedicated page per contact, their last meeting summary and any upcoming meeting details.

---

## How It Works, Step by Step

```
Sales meeting happens on Google Meet
            ↓
Tactiq transcribes the call in real time
            ↓
Zapier detects the finished transcript and sends it to n8n
            ↓
n8n webhook receives the transcript and triggers the workflow
            ↓
AI Agent (GPT-4o) analyzes the transcript
            ↓
Extracts summary, action items, buying signals, sentiment, lead score
            ↓
Contact enrichment via Hunter.io (company, title, location)
            ↓
HubSpot contact created or updated with all of the above
            ↓
Branch on sentiment:
   Positive → energetic follow-up email to client, 7-day follow-up booked
   Negative → empathetic recovery email, at-risk flag, 24-hour follow-up booked
            ↓
Sales rep receives an internal summary email either way
            ↓
Dashboard reflects the updated pipeline in real time
```

---

## Functional Requirements

### Completed

| ID | Feature | Description |
|----|---------|--------------|
| FR1 | Automatic meeting transcription | Tactiq transcribes every Google Meet call in real time with no manual intervention |
| FR2 | AI meeting analysis | GPT-4o extracts a summary, action items, buying signals, sentiment, and follow-up date from the transcript |
| FR3 | Sentiment-driven follow-ups | Positive meetings get an energetic closing email; negative meetings get an empathetic recovery email |
| FR4 | Sales rep summary email | The rep receives a complete internal summary the moment the meeting ends |
| FR5 | Automatic CRM updates | The HubSpot contact is created or updated automatically with notes and a name, cleaned of stray numbers |
| FR6 | Automatic calendar booking | A follow-up meeting is booked automatically with a Google Meet link, and the client is notified |
| FR7 | Lead scoring and categorization | Every lead is scored out of 100 and labeled Hot, Warm, or Cold based on budget, signals, sentiment, and engagement |
| FR8 | Auto-enrich contacts | Hunter.io fills in company, job title, phone, and location automatically |
| FR9 | Churn risk alerts | Negative sentiment triggers an at-risk flag, an urgent alert to the rep, and a 24-hour recovery meeting |
| FR10 | Client name extraction | The client's name is extracted from the transcript or derived cleanly from their email if not mentioned |
| FR11 | Pipeline dashboard | A web dashboard shows every contact, their score, and their status at a glance |
| FR12 | Contact detail view | A dedicated page per contact shows their full profile, last meeting notes, and upcoming meeting details |

### In Progress

| ID | Feature | Description |
|----|---------|--------------|
| FR13 | AI Negotiation Assistant | Real-time coaching for the sales rep during a live meeting, based on what's being said |
| FR14 | AI Voice Agent | Answers client calls automatically when the rep is unavailable and books a follow-up |
| FR15 | Digital Twin of the sales rep | Learns the rep's communication style and can eventually run discovery calls independently |

### Planned

| ID | Feature | Description |
|----|---------|--------------|
| FR16 | Autonomous client research | Researches a new client before the meeting and sends the rep a briefing |
| FR17 | Deal pipeline auto-update | Moves deals through HubSpot pipeline stages automatically based on signals |
| FR18 | Win rate prediction | Predicts the likelihood of closing a deal based on score, sentiment, and engagement |
| FR19 | Automatic proposal generation | Generates a personalized proposal document based on the meeting discussion |
| FR20 | Client personality profiling | Tailors future communication style to the client's decision-making pattern |
| FR21 | Buying intent monitoring | Watches for buying signals on LinkedIn and company news after the meeting |
| FR22 | Weekly performance reports | Sends a Monday morning summary of meetings, hot leads, and deals at risk |
| FR23 | Auto-close for hot deals | Sends a closing offer and follows up automatically when a lead score crosses 90 |
| FR24 | Competitive intelligence | Monitors competitor pricing and positioning changes and alerts the rep |

---

## Tech Stack

### Meeting and Transcription

- Google Meet — where the meeting happens
- Tactiq — real-time transcription

### Automation and Orchestration

- Zapier — bridges Tactiq to n8n
- n8n — the core workflow orchestrator, self-hosted via Docker
- ngrok — exposes the local n8n instance publicly so Zapier can reach it

### AI

- GPT-4o (OpenAI) — transcript analysis, sentiment detection, lead scoring, email generation
- Prompt engineering — structures how the AI extracts and formats information

### CRM and Enrichment

- HubSpot — contact and deal management
- Hunter.io — contact enrichment (company, title, location)

### Communication

- Gmail — sends all automated emails
- Google Calendar — books and manages follow-up meetings, with OAuth 2.0 for authentication

### Dashboard

- Frontend: HTML, CSS, vanilla JavaScript, hosted on Render as a static site
- Backend: Node.js with Express, hosted on Render as a web service
- Data sources: HubSpot CRM API and Google Calendar API, connected securely via environment variables on the backend, never exposed to the browser

### Supporting Concepts

- REST APIs
- Webhooks
- OAuth 2.0 and refresh tokens
- JSON
- Event-driven architecture
- Agentic AI design

### Version Control

- GitHub

---

