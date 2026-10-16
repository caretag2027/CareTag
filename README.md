# CareTag — GPS Behavioral Monitoring & Safety Dashboard

> **An ML-powered system that learns daily location routines from GPS data and detects anomalies in real time, with an interactive geofence management dashboard featuring multi-user authentication, voice alarms, battery monitoring, and 6–8 month progress tracking.**

---

## What Is This?

CareTag is a multi-component project designed for child/elderly safety monitoring:

| Component | What It Does | Tech |
|---|---|---|
| **CareTag** (ML Engine) | Learns "normal" daily movement patterns from GPS data and scores new locations for anomalies | Python, PyTorch, scikit-learn |
| **Geofence Dashboard** | Interactive map UI to create safe zones and visualize simulated device movement with anomaly alerts | React, Leaflet, SignalR |
| **GeoFence.Api** (Backend) | REST API + PostgreSQL for persisting devices, geofences, packets, users, and alerts | .NET 8, EF Core, PostgreSQL |
| **CareTag Scorer** | ML inference microservice that scores GPS coordinates for deviation | FastAPI, Python |

---

## Quick Start

### 1. Run the Dashboard (No Backend Needed)

```bash
cd geofence-dashboard
npm install
npm start
```

The dashboard runs at **http://localhost:3000** with full functionality using localStorage — no Docker or backend required.

### 2. Run the Full Stack (Optional — requires Docker)

```bash
cd geofence-dashboard/backend
docker-compose up -d
```

This starts PostgreSQL, the .NET API (port 5077), and the CareTag scorer service (port 8000).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Dashboard                         │
│  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Auth │ │ Geofence │ │ Alerts   │ │ Battery/Progress   │ │
│  │      │ │ Manager  │ │ Store    │ │ Store              │ │
│  └──────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────────────┐   │
│  │ Voice     │ │Simulation│ │ Leaflet Map + Telemetry  │   │
│  │ Alarm     │ │ Engine   │ │                          │   │
│  └───────────┘ └──────────┘ └──────────────────────────┘   │
└──────────────┬──────────────────────────────────────────────┘
               │ REST + SignalR (optional)
┌──────────────▼──────────────────────────────────────────────┐
│              .NET 8 Minimal API (GeoFence.Api)              │
│  Auth │ Devices │ Geofences │ Packets │ Alerts │ SignalR    │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────┐    ┌──────────────────────────────┐
│  PostgreSQL 15      │    │  CareTag Scorer (FastAPI)    │
│  Users, Devices,    │    │  KMeans + LSTM inference     │
│  Packets, Geofences,│    │  Deviation score calculation │
│  AlertEvents        │    │                              │
└─────────────────────┘    └──────────────────────────────┘
```

---

## Features

### Multi-User Authentication & Data Isolation
- User registration and login with SHA-256 password hashing
- Every user has their own isolated data (geofences, alerts, battery, progress)
- Session persistence across page reloads
- Logout functionality
- Backend auth endpoints (`POST /api/auth/register`, `POST /api/auth/login`)

### Geofence Management (Safety Zones)
- Click the map to set coordinates
- Name your geofence (Home, School, Office, etc.)
- Set custom radius in meters
- Save/delete geofences
- Visual preview with dashed circle overlay
- Saved geofences shown with purple circles

### Simulation Engine
- Simulates device movement between saved geofences
- Three phases: STAY (near a geofence), COMMUTE (traveling between), ANOMALY (outside zones)
- Geofence-radius-aware anomaly scoring
- Battery drain simulation

### Anomaly Detection & Safety-Zone Response
- **Geofence Breach Detection**: Alerts fire when device exits any geofence radius
- **Deviation Scoring**: ML-derived scores (0–1) classify normal vs abnormal movement
- **Alert Types**: Out-of-zone, anomaly, low-battery
- **Alert History**: Persistent log of all events with timestamps, locations, and details
- **Acknowledgment**: Mark alerts as read individually or all at once

### Voice Alarm System
- Uses Web Speech API (`speechSynthesis`) for audible warnings
- Contextual messages: "Warning, device has left the safety zone, 1.3 kilometers from Home"
- 30-second cooldown per alert type (no spam)
- Beep fallback when browser blocks speech synthesis
- User toggle (ON/OFF) in sidebar and top bar
- Manual dismiss capability

### Battery Monitoring & Statistics
- Tracks battery percentage from simulation packets
- SVG ring gauge showing current battery level
- Statistics: average, minimum, low-battery events, trend direction
- Sparkline chart of recent readings
- Low-battery alerts triggered at < 20%

### 6–8 Month Progress Tracking
- Month-by-month summary table
- Columns: Alerts, Breaches, Anomalies, Battery Average
- Current month highlighted
- Clearly shows "No data" for months without activity
- No fake data generated — only actual accumulated records

### Dashboard Layout
- **Tabbed sidebar**: Controls | Alerts | Battery | Progress
- **Top bar**: Safety status badge (SAFE/OUT OF ZONE), voice alarm indicator, alert badge with unread count, user menu
- **Map**: Full-screen Leaflet map with geofences and device marker
- **Device telemetry**: Real-time grid showing device, phase, speed, deviation, nearest zone, distance, battery, last seen

---

## Database Schema

### Tables (PostgreSQL)

| Table | Key Columns |
|---|---|
| `users` | id, email, password_hash, display_name, created_at_utc |
| `devices` | id, external_key, display_name, user_id (FK → users), created_at_utc |
| `gsm_packets` | id, device_id (FK), packet_type, latitude, longitude, speed, battery, deviation_score, motion_state |
| `geofence_rules` | id, device_id (FK), label, center_lat, center_lng, radius_meters, is_active |
| `activity_observations` | id, device_id (FK), activity_label, latitude, longitude, notes |
| `alert_events` | id, device_id (FK), alert_type, message, timestamp, latitude, longitude, nearest_geofence, distance_km, deviation_score, battery_percent, acknowledged |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (name, email, password) |
| POST | `/api/auth/login` | Login (email, password) |

### Devices & Packets
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/devices/{key}/packets` | Submit GPS packet |
| GET | `/api/devices/{key}/packets/latest` | Get latest packet |

### Geofences
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/devices/{key}/geofences` | List geofences |
| POST | `/api/devices/{key}/geofences` | Create geofence |
| DELETE | `/api/devices/{key}/geofences/{id}` | Delete geofence |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/devices/{key}/alerts` | List device alerts |
| POST | `/api/devices/{key}/alerts` | Create alert |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/devices/{key}/activity-observations` | Submit activity observation |

---

## ML Pipeline (CareTag)

The CareTag ML engine processes GPS trajectories through three stages:

1. **Stay-Point Extraction** (`step1_stay_point_extraction/`)
   - Identifies locations where the user stays for extended periods
   - Uses distance and time thresholds

2. **Routine Modeling** (`step2_routine_modeling/`)
   - KMeans clustering of stay-points to learn "normal" locations
   - LSTM neural network to learn temporal movement patterns

3. **Anomaly Scoring** (`step3_anomaly_scoring/`)
   - Scores new GPS coordinates against learned routines
   - Outputs deviation_score (0–1) and motion_state

---

## Frontend Source Files

| File | Purpose |
|---|---|
| `src/App.js` | Main React component — auth gating, dashboard, map, sidebar tabs |
| `src/auth.js` | User registration, login, session management (localStorage) |
| `src/api.js` | API client with user-scoped localStorage fallback |
| `src/alertStore.js` | Alert persistence, retrieval, acknowledgment |
| `src/voiceAlarm.js` | Voice alarm with speech synthesis, cooldown, beep fallback |
| `src/batteryStore.js` | Battery history tracking and statistics |
| `src/progressStore.js` | Monthly progress aggregation from alert/battery data |
| `src/simulation.js` | GPS movement simulation engine |
| `src/signalr.js` | Real-time SignalR connection to backend |
| `src/index.css` | Complete design system and component styles |

---

## Backend Source Files

| File | Purpose |
|---|---|
| `Program.cs` | .NET 8 Minimal API — all endpoints, auth, CORS, SignalR |
| `Data/GeoFenceDbContext.cs` | EF Core DbContext with all entity configurations |
| `Models/User.cs` | User entity |
| `Models/Device.cs` | Device entity with UserId FK |
| `Models/GsmPacket.cs` | GPS telemetry packet |
| `Models/GeofenceRule.cs` | Geofence/safety zone definition |
| `Models/AlertEvent.cs` | Alert event persistence |
| `Models/ActivityObservation.cs` | Activity observation |
| `Dtos/*.cs` | Request DTOs for all endpoints |

---

## Known Limitations

1. **Frontend auth**: Uses localStorage SHA-256 hashing — suitable for academic projects, not production. For production, use JWT tokens with server-side session validation.
2. **Voice alarm**: Browser autoplay policies may require user interaction before speech synthesis works. A beep fallback is provided.
3. **Battery data**: Only available during simulation. Real hardware would provide actual battery readings via GPS packets.
4. **Progress history**: Starts empty — accumulates over time as user runs simulations. No fake data is generated.
5. **Backend optional**: The dashboard works fully standalone. The .NET backend adds persistence across sessions and multi-device support.

---

## Technical Report / PPT Key Points

### For your CareTag presentation, cover these points:

1. **Problem Statement**: Child/elderly safety monitoring — tracking location patterns and detecting anomalies
2. **Architecture**: 3-tier (React frontend → .NET API → PostgreSQL) + ML scorer microservice
3. **ML Pipeline**: GPS → Stay-point extraction → KMeans clustering → LSTM routine modeling → Anomaly scoring
4. **Multi-User Privacy**: SHA-256 auth, user-scoped data isolation, server-side ownership validation
5. **Geofencing**: User-defined safety zones with configurable radius, map-click interface
6. **Anomaly Detection**: Deviation scoring (0–1), geofence breach detection, movement pattern analysis
7. **Voice Alarm**: Web Speech API with 30s cooldown, beep fallback, user-controllable
8. **Battery Monitoring**: Real-time tracking, SVG gauge, trend analysis, low-battery alerts
9. **Progress Tracking**: 8-month history, monthly aggregation from actual data
10. **Technologies**: React 19, Leaflet, .NET 8, EF Core, PostgreSQL, FastAPI, PyTorch, SignalR
