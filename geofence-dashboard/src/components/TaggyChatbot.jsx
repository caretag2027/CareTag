import React, { useState, useEffect, useRef } from 'react';
import './TaggyChatbot.css';
import taggyImg from '../assets/taggy.png';
import {
  Send,
  X,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  User,
  ChevronDown,
  Settings,
  ExternalLink,
  MapPin,
  Bell,
  ArrowRight,
  Crosshair
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   AI BACKEND & CLOUDFLARE EDGE CONFIGURATION
   ────────────────────────────────────────────────────────────── */
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || '';
const GROQ_DIRECT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];

function getChatEndpoints() {
  const endpoints = [];
  if (process.env.REACT_APP_API_URL) {
    endpoints.push(`${process.env.REACT_APP_API_URL}/api/chat`);
  }
  // Same-origin relative path (for production on workers.dev)
  endpoints.push('/api/chat');
  // Explicit worker origins (handles local dev on localhost:3000 where react-scripts doesn't have an API proxy)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    endpoints.unshift('https://caretag.bhavishyasingla2005.workers.dev/api/chat');
  } else {
    endpoints.push('https://caretag.bhavishyasingla2005.workers.dev/api/chat');
  }
  return Array.from(new Set(endpoints));
}

/* ──────────────────────────────────────────────────────────────
   DYNAMIC SYSTEM PROMPT BUILDER (LANDING VS DASHBOARD)
   ────────────────────────────────────────────────────────────── */
function buildSystemPrompt(appState = {}) {
  const {
    currentView = 'dashboard',
    activeTab = 'overview',
    bandStatus = {},
    hardwareStatus = {},
    geofences = [],
    alerts = [],
    latest = null,
  } = appState;

  // 1. Landing Page Marketing Persona
  if (currentView === 'landing') {
    return `You are Taggy, the intelligent product guide and AI companion for CareTag (a smart child safety wearable and routine monitoring system developed as a capstone project at Thapar Institute of Engineering & Technology, Batch of 2027).

PRODUCT OVERVIEW FOR PROSPECTIVE CAREGIVERS & JUDGES:
- What CareTag is: A context-aware child safety wearable band (ESP32 MCU, u-blox Neo-6M GPS, SIM800L cellular, MPU-6050 6-axis motion/fall sensor) paired with routine-learning AI.
- Key Advantage: Dual-check routine intelligence. Unlike standard GPS trackers that only alert on static circles, CareTag learns habitual daily transit corridors and stay-points across 48 daily 30-minute intervals. It suppresses false alarms from GPS drift (45m spatial hysteresis, temporal smoothing) and catches abnormal deviations early.
- Battery Life: 18–24 hours with dynamic sleep scheduling (sleeps during static dwell times, wakes on movement).
- Privacy: TLS encrypted end-to-end telemetry, private isolated accounts, zero third-party tracking.
- Team: Kinjal, Guneev Taneja, Bhavishya Singla, Manya Sharma, Anureet (Mentored by Dr. Kapil Tomar & Dr. Ravindra Kumar).

RESPONSE GUIDELINES:
- Keep answers concise, clear, and welcoming (strictly 40 to 80 words).
- When appropriate, encourage the visitor to click "Launch Live Demo" to experience the interactive dashboard.
- For technical depth queries, summarize simply first, then provide deep engineering details inside <details><summary>How does this work technically?</summary>...</details>.
- Never guarantee 100% safety. Maintain honest, reliable communication.`;
  }

  // 2. Dashboard Operational Guardian Persona
  const effectiveBand = hardwareStatus?.connected !== undefined ? hardwareStatus : (bandStatus || {});
  const isConnected = effectiveBand.connected !== undefined ? Boolean(effectiveBand.connected) : true;
  const isStale = Boolean(effectiveBand.isStale);
  const batteryPercent = latest?.batteryPercent ?? effectiveBand.batteryPercent ?? 92;

  const zoneCount = geofences.length;
  const zoneNames = zoneCount > 0 ? geofences.map(g => g.label).join(', ') : 'None configured';
  const topAlert = alerts.find(a => !a.acknowledged) || alerts[0];

  const contextSnippet = `APPLICATION CONTEXT:
- Current View: Dashboard (${activeTab} tab)
- Smart Band: ${isConnected ? 'Connected' : 'Offline / Reconnecting'} (Battery: ${batteryPercent}%, Telemetry freshness: ${isStale ? 'Stale / Delayed' : 'Fresh live updates'})
- Safe Places: ${zoneCount > 0 ? `${zoneCount} safe places configured (${zoneNames})` : 'No safe places configured yet'}
- Recent Alert: ${topAlert ? `${topAlert.type}: "${topAlert.message}" (${new Date(topAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'No active alerts'}`;

  return `You are Taggy, the caregiver-first AI companion for CareTag (a smart child safety & routine monitoring wearable dashboard).

CRITICAL CAREGIVER-FIRST RESPONSE POLICY:
- Your primary audience is caregivers (parents and guardians). They want clear, reassuring answers on child location, safe places, alerts, and wearable operation.
- Write naturally in concise, high-quality, conversational English (strictly 35 to 75 words).
- DO NOT force artificial numbered lists. Only provide numbered steps if the caregiver specifically asks for instructions or how-to procedures.
- Optional technical depth: If engineering details (sensors, LSTM, formulas, encryption) are relevant, wrap them neatly in:
  <details>
  <summary>How does this work technically?</summary>
  [Clear, high-signal engineering explanation. Mention that live telemetry is accessible in the Technical Inspector.]
  </details>
- Never guarantee 100% safety. Maintain honest, reliable communication.
- If telemetry is stale or device offline, honestly remind the caregiver that the displayed position may not be current.
- Do not repeat the user's question verbatim. Do not append generic conversational fillers like "How else can I help?" at the end.

EXPLICIT TECHNICAL QUERIES:
If the user specifically asks technical questions (e.g., "How does the AI model work?", "What is the deviation formula?", "Which sensors are installed?"):
- Provide a brief 2-sentence summary first in plain language.
- Then provide the technical breakdown in <details><summary>How does this work technically?</summary>...</details>. Mention they can visit the Evaluator Console / Technical Inspector in the dashboard for live telemetry and data charts.

${contextSnippet}`;
}

/* ──────────────────────────────────────────────────────────────
   CURATED CAREGIVER STARTER QUESTIONS & EXACT PRESET ANSWERS (DASHBOARD)
   ────────────────────────────────────────────────────────────── */
export const CAREGIVER_PRESETS = [
  {
    id: 'safe-place',
    label: 'How do I set up a safe place?',
    prompt: 'How do I set up a safe place?',
    actionTab: 'safezones',
    actionLabel: 'Open Safe Places',
    getAnswer: (appState) => {
      const count = appState?.geofences?.length || 0;
      const countSuffix = count > 0
        ? ` You currently have ${count} safe place${count > 1 ? 's' : ''} set up.`
        : '';
      return `Open **Safe Places** and choose **Add a Place**. Give it a name, select the location on the map, and adjust the circle to cover the area you want to monitor. Set the days and times when monitoring should be active, then save.${countSuffix}

1. Choose **Add a Place** in the Safe Zones menu.
2. Click your desired center point on the map and set the radius.
3. Save the zone to activate automatic boundary monitoring.`;
    }
  },
  {
    id: 'leaves-safe-place',
    label: 'What happens if my child leaves a safe place?',
    prompt: 'What happens if my child leaves a safe place?',
    actionTab: 'alerts',
    actionLabel: 'View Alerts',
    getAnswer: () => {
      return `If monitoring is enabled and the latest reliable location falls outside the configured boundary, CareTag can flag a boundary breach. Check the alert and its timestamp to understand what happened. A delayed location update may mean the displayed position is not current.

1. Review the active alert banner on your dashboard.
2. Confirm the timestamp to see how fresh the location report is.
3. Check the map view to verify the direction of travel.`;
    }
  },
  {
    id: 'no-alert',
    label: "Why haven't I received an alert?",
    prompt: "Why haven't I received an alert?",
    actionTab: 'alerts',
    actionLabel: 'Check Alerts',
    getAnswer: (appState) => {
      const band = appState?.hardwareStatus;
      let bandNote = '';
      if (band) {
        if (!band.connected) {
          bandNote = ` Right now, the band shows disconnected, which will pause live alerts.`;
        } else if (band.isStale) {
          bandNote = ` The band telemetry is currently delayed (${band.ageSeconds || 'few'}s old), which can postpone alert triggers.`;
        }
      }
      return `First, check whether the band is connected and whether its location has updated recently. Then check that the safe place is enabled and its monitoring schedule is active. If everything looks correct, open the Alerts section for more information.${bandNote}`;
    }
  },
  {
    id: 'band-offline',
    label: 'What should I do if the band goes offline?',
    prompt: 'What should I do if the band goes offline?',
    getAnswer: (appState) => {
      const isCurrentlyOffline = appState?.hardwareStatus && (!appState.hardwareStatus.connected || appState.hardwareStatus.isStale);
      const statusNote = isCurrentlyOffline
        ? ` Note: Your band currently appears offline or delayed.`
        : ` Note: Your band is currently transmitting active telemetry.`;
      return `Check the band’s connection status and last update time. If the location is stale, don't assume it reflects where your child is now. Check the device and its network connection, then confirm that fresh location updates have resumed.${statusNote}

1. Verify that the wearable is powered on and sufficiently charged.
2. Confirm that the wearer is in an area with GPS and cellular coverage.
3. Refresh the dashboard once fresh updates resume.`;
    }
  },
  {
    id: 'how-it-works',
    label: 'How does CareTag work?',
    prompt: 'How does CareTag work?',
    getAnswer: () => {
      return `CareTag helps you check your child's latest reported location, configure safe places such as home or school, and review relevant alerts. Start by connecting the band and setting up the places you want to monitor.

<details>
<summary>How does this work technically?</summary>
CareTag combines an ESP32 wearable (with GPS, motion sensors, and cellular connectivity) with routine-learning AI. The system models habitual stay-points across 48 daily 30-minute intervals to distinguish expected daily commutes from abnormal detours. For live telemetry, sensor diagnostics, and model metrics, visit the Technical Inspector.
</details>`;
    }
  },
  {
    id: 'ml-model',
    label: 'Explain the ML routine model',
    prompt: 'Explain the ML routine model.',
    getAnswer: () => {
      return `CareTag uses machine learning to learn your child's regular schedule and expected commute corridors over time, notifying you when an unusual detour or unexpected departure occurs.

<details>
<summary>How does this work technically?</summary>
The model architecture uses a Dual-Input LSTM neural network trained on stay-point clusters (dwell time ≥ 20m) across 48 daily 30-minute slots from the Microsoft GeoLife trajectory dataset. Inference runs at the edge in under 50ms. Live scoring can be evaluated in the Technical Inspector.
</details>`;
    }
  },
  {
    id: 'deviation-formula',
    label: 'What is the deviation formula?',
    prompt: 'What is the deviation formula and threshold?',
    getAnswer: () => {
      return `CareTag calculates a routine score that balances location distance with expected time-of-day habits, sending an alert when unexpected movement occurs.

<details>
<summary>How does this work technically?</summary>
Deviation Score = 0.5 × Spatial Score + 0.5 × Temporal Score.
- **Spatial Score:** Distance from habitual cluster centroid.
- **Temporal Score:** Likelihood of visit during the current 30-minute time slot.
- **Alert Threshold:** Scores greater than 0.60 trigger a safety alert.
</details>`;
    }
  },
  {
    id: 'band-sensors',
    label: 'Which sensors are installed?',
    prompt: 'Which sensors are installed in the band?',
    getAnswer: () => {
      return `The CareTag band uses GPS for positioning, cellular connectivity for sending updates, and motion sensing to detect movement and falls.

<details>
<summary>How does this work technically?</summary>
Hardware specifications:
- **Microcontroller:** ESP32 32-bit dual-core Wi-Fi/BLE MCU
- **GPS Receiver:** u-blox Neo-6M high-sensitivity positioning
- **Cellular:** SIM800L GSM/GPRS module
- **Motion & Fall:** MPU-6050 6-axis accelerometer & gyroscope
</details>`;
    }
  }
];

/* ──────────────────────────────────────────────────────────────
   CURATED MARKETING & PRODUCT QUESTIONS (LANDING PAGE)
   ────────────────────────────────────────────────────────────── */
export const MARKETING_PRESETS = [
  {
    id: 'diff-gps',
    label: 'What makes CareTag different from regular GPS trackers?',
    prompt: 'What makes CareTag different from regular GPS trackers?',
    actionType: 'launch_demo',
    actionLabel: 'Launch Live Demo',
    getAnswer: () => {
      return `Standard GPS trackers only show a dot on a map or alert on static circles. CareTag combines safe-place boundaries with **routine-aware AI** that learns habitual commute corridors across 48 daily time slots. It prevents false alarms caused by GPS drift and detects unexpected wanderings early.

1. **Dual Independent Checks:** Evaluates geofence boundaries and routine deviations separately.
2. **Reduced False Alarms:** 45-meter spatial hysteresis and temporal smoothing filter out GPS jitter.
3. **Contextual Alerts:** Delivers clear deviation confidence scores so parents can make informed decisions.`;
    }
  },
  {
    id: 'how-ai-works',
    label: 'How does the AI routine learning work?',
    prompt: 'How does the AI routine learning work?',
    actionType: 'launch_demo',
    actionLabel: 'Explore 4-Day Demo',
    getAnswer: () => {
      return `CareTag automatically learns your child's habitual stay-points (home, school, playground) and transit routes over 3 to 5 days. It evaluates incoming coordinates in under 80ms against time-of-day expectations, alerting only when abnormal detours occur.

<details>
<summary>How does this work technically?</summary>
The system extracts stay-points (dwell time ≥ 20m) and uses a Dual-Input LSTM neural network trained on trajectory patterns. It balances spatial centroid distance with temporal time-slot likelihood: Deviation Score = 0.5 × Spatial + 0.5 × Temporal.
</details>`;
    }
  },
  {
    id: 'band-hardware',
    label: 'What hardware and sensors are used in the smart band?',
    prompt: 'What hardware and sensors are used in the smart band?',
    getAnswer: () => {
      return `The CareTag wearable is a lightweight band featuring high-sensitivity GPS, cellular telemetry for sending updates, and 6-axis motion sensing to detect activity states and fall events.

<details>
<summary>How does this work technically?</summary>
Hardware specifications:
- **MCU:** ESP32 32-bit dual-core Wi-Fi/BLE microcontroller
- **GPS Receiver:** u-blox Neo-6M high-sensitivity positioning
- **Cellular:** SIM800L GSM/GPRS module
- **Motion & Fall:** MPU-6050 6-axis accelerometer & gyroscope
- **Battery Life:** ~18–24 hours with dynamic sleep scheduling
</details>`;
    }
  },
  {
    id: 'try-demo',
    label: 'Can I try the live demonstration dashboard?',
    prompt: 'Can I try the live demonstration dashboard?',
    actionType: 'launch_demo',
    actionLabel: 'Open Dashboard',
    getAnswer: () => {
      return `Yes! You can explore our live interactive dashboard right now. Configure custom safe places, test capstone simulation scenarios (such as an unexpected school detour), and inspect live telemetry diagnostics.

1. Click **Open Dashboard** below or in the top navigation.
2. No installation or registration is required for the demonstration.
3. Experience real-time geofence monitoring and anomaly simulation.`;
    }
  },
  {
    id: 'battery-pricing',
    label: 'How long does the wearable battery last?',
    prompt: 'How long does the wearable battery last?',
    getAnswer: () => {
      return `The CareTag smart band operates for **18 to 24 hours** on a single charge. It employs dynamic sleep scheduling: entering low-power mode during stationary dwell times and waking instantly upon motion detection. Recharging takes approximately 45 minutes via magnetic USB.`;
    }
  },
  {
    id: 'privacy-family',
    label: 'How does CareTag protect family privacy?',
    prompt: 'How does CareTag protect family privacy?',
    getAnswer: () => {
      return `Privacy and child safety are our highest priorities. Location data is securely encrypted in transit via TLS and isolated to private caregiver accounts. Routine observations are processed directly on the device and secure edge workers without advertising trackers or third-party profiling.`;
    }
  }
];

/* ──────────────────────────────────────────────────────────────
   PARSER FOR COLLAPSIBLE TECHNICAL DETAILS
   ────────────────────────────────────────────────────────────── */
function parseMessageContent(text = '') {
  let mainText = text;
  let techDetails = null;
  let techSummary = 'How does this work technically?';

  // Support <details><summary>...</summary>...</details> or unclosed trailing tags
  const detailsRegex = /<details[^>]*>\s*<summary>(.*?)<\/summary>(.*?)(?:<\/details>|$)/s;
  const detailsMatch = text.match(detailsRegex);

  if (detailsMatch) {
    mainText = text.replace(detailsRegex, '').trim();
    techSummary = detailsMatch[1].trim() || 'How does this work technically?';
    techDetails = detailsMatch[2].replace(/<\/details>/gi, '').trim();
  } else {
    // Also support :::tech [Summary] ... ::: syntax
    const techBlockRegex = /:::tech(?:\s*\[(.*?)\])?\s*(.*?):::/s;
    const techMatch = text.match(techBlockRegex);
    if (techMatch) {
      mainText = text.replace(techBlockRegex, '').trim();
      techSummary = techMatch[1]?.trim() || 'How does this work technically?';
      techDetails = techMatch[2].trim();
    }
  }

  // Strip any stray raw details tags from mainText
  mainText = mainText.replace(/<\/?details[^>]*>/gi, '').replace(/<\/?summary[^>]*>/gi, '').trim();

  return { mainText, techDetails, techSummary };
}

/* ──────────────────────────────────────────────────────────────
   INLINE MARKDOWN HELPER
   ────────────────────────────────────────────────────────────── */
function formatInlineMarkdown(text) {
  let res = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');
  return res;
}

/* ──────────────────────────────────────────────────────────────
   COLLAPSIBLE TECHNICAL DISCLOSURE COMPONENT
   ────────────────────────────────────────────────────────────── */
function TechDisclosure({ summary, content, onOpenInspector }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`taggy-tech-disclosure ${isExpanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="taggy-tech-toggle-btn"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Hide technical details' : 'Show technical details'}
      >
        <span className="taggy-tech-label">
          <Settings size={13} className="taggy-tech-icon" />
          <span>{summary}</span>
        </span>
        <span className="taggy-tech-action">
          <span className="taggy-tech-action-text">{isExpanded ? 'Hide' : 'Expand'}</span>
          <ChevronDown size={13} className={`taggy-chevron ${isExpanded ? 'rotated' : ''}`} />
        </span>
      </button>

      {isExpanded && (
        <div className="taggy-tech-content">
          <MarkdownRenderer content={content} isNested />
          {onOpenInspector && (
            <button
              type="button"
              className="taggy-inspector-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInspector();
              }}
            >
              <span>View live telemetry in Technical Inspector</span>
              <ExternalLink size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   MARKDOWN RENDERER
   ────────────────────────────────────────────────────────────── */
function MarkdownRenderer({ content, isNested = false }) {
  const lines = (content || '').split('\n');

  return (
    <div className={`taggy-md ${isNested ? 'taggy-md--nested' : ''}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} className="taggy-md-h">{trimmed.replace('### ', '')}</h4>;
        }
        if (trimmed.startsWith('#### ')) {
          return <h5 key={idx} className="taggy-md-h">{trimmed.replace('#### ', '')}</h5>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[-•*]\s+/, '');
          return (
            <div key={idx} className="taggy-bullet-item">
              <span className="taggy-bullet-dot">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
            </div>
          );
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          const num = numMatch ? numMatch[1] : '';
          const itemText = numMatch ? numMatch[2] : trimmed;
          return (
            <div key={idx} className="taggy-numbered-item">
              <span className="taggy-number-badge">{num}</span>
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
            </div>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="taggy-line-gap" />;
        }

        return (
          <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   DOMAIN-AWARE OFFLINE ANSWER RESOLVER (NO DEFLECTIONS)
   ────────────────────────────────────────────────────────────── */
function getDomainOfflineAnswer(query = '', appState = {}) {
  const q = query.toLowerCase();

  // Team & Authors & University
  if (/(team|who\s+(made|built|created|designed|developed)|authors|mentor|teacher|faculty|guide|kapil|tomar|ravindra|ravinder|kumar|thapar|bhavishya|guneev|kinjal|manya|anureet)/i.test(q)) {
    return `CareTag was developed as a university capstone project at **Thapar Institute of Engineering & Technology** (Batch of 2027) by:
- **Core Team:** Kinjal, Guneev Taneja, Bhavishya Singla, Manya Sharma, and Anureet.
- **Faculty Mentors:** Dr. Kapil Tomar and Dr. Ravindra Kumar (Associate Professors, CSED).

The team combined low-power IoT hardware engineering with machine learning routine monitoring to create an accessible, caregiver-focused safety wearable.`;
  }

  // Waterproofing & Durability
  if (/(waterproof|water\s*resistant|swim|rain|splash|shower|bath|durab)/i.test(q)) {
    return `The CareTag band prototype is housed in a **splash-resistant enclosure** (targeting IP54 protection). It is completely safe against rain, spills, and handwashing. However, it is not currently rated for swimming or full underwater submersion.`;
  }

  // SIM card & Cellular Connectivity
  if (/(sim\s*card|cellular|gsm|gprs|2g|mobile\s*data|network|coverage|signal|offline\s*mode|no\s*internet)/i.test(q)) {
    return `The band uses a **SIM800L cellular module** with standard GPRS/2G data to transmit coordinates and sensor telemetry to our Cloudflare edge backend. If the wearer enters an area with no cellular coverage, coordinates are automatically buffered in local flash memory and transmitted as soon as a signal is restored.`;
  }

  // GPS Accuracy & False Alarms
  if (/(gps\s*accuracy|how\s*accurate|accuracy|drift|precision|false\s*alarm|jitter|hysteresis)/i.test(q)) {
    return `CareTag uses a **u-blox Neo-6M GPS receiver** providing ~2.5-meter horizontal positioning accuracy under open sky. To prevent false alarms from GPS jitter, CareTag applies **45-meter spatial hysteresis** and temporal smoothing so parents only get alerted for genuine movements.`;
  }

  // Emergency / SOS Button
  if (/(sos|emergency|panic\s*button|alarm\s*button|call\s*for\s*help)/i.test(q)) {
    return `Yes! The smart band features a physical **SOS emergency trigger**. When pressed, it immediately dispatches an urgent priority alert with live satellite coordinates to the caregiver dashboard and connected contacts.`;
  }

  // Multiple children / bands
  if (/(multiple\s*(child|children|kids|bands|devices)|more\s*than\s*one\s*child|add\s*another\s*band)/i.test(q)) {
    return `Yes! CareTag supports monitoring multiple family bands under one caregiver account. Each child has a unique device ID (like CARE-TAG-01, CARE-TAG-02), and caregivers can toggle between children seamlessly on the dashboard map.`;
  }

  // Safe places / Geofencing limit
  if (/(safe\s*place|geofence|how\s*many\s*(places|zones)|zone\s*limit|radius)/i.test(q)) {
    return `You can configure multiple safe places (Home, School, Grandma's, Sports Field) on the map with custom radius boundaries (typically 50m to 500m) and optional active time schedules (e.g., School active Mon–Fri 8am–3pm).`;
  }

  // Pricing & Availability
  if (/(price|cost|how\s*much|buy|purchase|order|shop|sale)/i.test(q)) {
    return `CareTag is an academic capstone prototype developed at Thapar Institute of Engineering & Technology. The complete hardware bill of materials is under **$25**, and our interactive dashboard is free to test live right now.`;
  }

  // Greetings & Friendly chitchat
  if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))/i.test(q)) {
    return `Hello! I'm Taggy, your CareTag companion. Ask me anything about our smart safety band, setting up safe places, battery life, or how our routine AI protects kids!`;
  }

  if (/(thank|thanks|great|awesome|cool|helpful)/i.test(q)) {
    return `You're very welcome! Let me know if there's anything else about CareTag or your smart band you'd like to check.`;
  }

  // Direct, polite response for general queries when offline
  return `I'm tuned specifically as CareTag's companion to help with our smart wearable band, safe places, battery status, routine AI, and alerts.

If you'd like to test CareTag's features, you can explore the live dashboard or ask me about our hardware, routine-learning model, or safe zones!`;
}

/* ──────────────────────────────────────────────────────────────
   MAIN TAGGY CHATBOT COMPONENT
   ────────────────────────────────────────────────────────────── */
export default function TaggyChatbot({
  currentView = 'dashboard',
  activeTab = 'overview',
  hardwareStatus = { connected: true, batteryPercent: 92 },
  geofences = [],
  alerts = [],
  latest = null,
  simRunning = false,
  onNavigateTab = null,
  onOpenInspector = null,
  onLaunchDashboard = null,
  onOpenAuth = null,
  onRecenterMap = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false); // Collapsed by default per specification
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Dynamic welcome greeting based on view (landing marketing vs dashboard caregiver)
  const getWelcomeText = (viewMode) => {
    if (viewMode === 'landing') {
      return `Hi, I'm **Taggy**! Welcome to CareTag.

I can answer questions about our smart wearable, routine-learning AI, battery life, and how CareTag keeps kids safe without false alarms.

What would you like to know?`;
    }
    return `Hi, I'm **Taggy**!

I can help you set up safe places, understand alerts, and use your CareTag dashboard.

What would you like help with?`;
  };

  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome-msg',
      sender: 'bot',
      time: 'Just now',
      text: getWelcomeText(currentView)
    }
  ]);

  const messagesEndRef = useRef(null);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const isUserNearBottomRef = useRef(false);

  // Synchronize initial welcome greeting when currentView prop changes
  useEffect(() => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        time: 'Just now',
        text: getWelcomeText(currentView)
      }
    ]);
    setShowQuestions(false);
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [currentView]);

  // Listen for global custom event to open Taggy from any page element (e.g. landing page banner)
  useEffect(() => {
    const handleExternalOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('caretag:open-taggy', handleExternalOpen);
    return () => window.removeEventListener('caretag:open-taggy', handleExternalOpen);
  }, []);

  // Network status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Track if user is scrolling manually
  const handleFeedScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    isUserNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  };

  // Scroll to bottom ONLY for ongoing user/bot messages, NEVER on initial open with just the welcome
  useEffect(() => {
    if (isOpen && messages.length > 1 && isUserNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // When chatbot is opened, explicitly ensure scroll starts at top with welcome message fully visible
  useEffect(() => {
    if (isOpen) {
      setShowQuestions(false);
      isUserNearBottomRef.current = false;
      if (feedRef.current) {
        feedRef.current.scrollTop = 0;
      }
      const timer = setTimeout(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = 0;
        }
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          inputRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Mobile detection & virtual keyboard handling via window.visualViewport
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [viewportHeight, setViewportHeight] = useState(null);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleViewportChange = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
        setViewportOffsetTop(window.visualViewport.offsetTop);
      }
    };

    if (window.visualViewport) {
      handleViewportChange();
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
      return () => {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      };
    }
  }, [isOpen]);

  // Lock background page scrolling when Taggy is open on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOpen && isMobile) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow || '';
        document.documentElement.style.overflow = '';
      };
    }
  }, [isOpen, isMobile]);

  // Escape key closes chatbot
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCopy = (id, text) => {
    // Strip HTML details tags if present for a clean copy
    const cleanText = text.replace(/<details[^>]*>.*?<\/details>/gs, '').trim();
    navigator.clipboard?.writeText(cleanText || text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        time: 'Just now',
        text: getWelcomeText(currentView)
      }
    ]);
    setShowQuestions(false);
    isUserNearBottomRef.current = false;
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  };

  // Application state passed to context builder
  const appState = {
    currentView,
    activeTab,
    hardwareStatus,
    geofences,
    alerts,
    latest,
    simRunning
  };

  // Send message handler with Edge Worker + Groq API + Curated Presets
  const handleSend = async (userText = null) => {
    const textToSend = (userText || input).trim();
    if (!textToSend || isLoading) return;

    isUserNearBottomRef.current = true;
    const userMessageId = `user-${Date.now()}`;
    const newMessages = [
      ...messages,
      {
        id: userMessageId,
        sender: 'user',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: textToSend
      }
    ];

    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const cleanInput = textToSend.trim().toLowerCase().replace(/[?!.,]/g, '');

    // Check presets for active persona
    const activePresets = currentView === 'landing' ? MARKETING_PRESETS : CAREGIVER_PRESETS;
    let matchedPreset = activePresets.find(q => {
      const p = q.prompt.trim().toLowerCase().replace(/[?!.,]/g, '');
      const l = q.label.trim().toLowerCase().replace(/[?!.,]/g, '');
      return cleanInput === p || cleanInput === l || textToSend.toLowerCase() === q.prompt.toLowerCase();
    });

    // Fallback search across alternate presets if not found
    if (!matchedPreset) {
      const otherPresets = currentView === 'landing' ? CAREGIVER_PRESETS : MARKETING_PRESETS;
      matchedPreset = otherPresets.find(q => {
        const p = q.prompt.trim().toLowerCase().replace(/[?!.,]/g, '');
        const l = q.label.trim().toLowerCase().replace(/[?!.,]/g, '');
        return cleanInput === p || cleanInput === l || textToSend.toLowerCase() === q.prompt.toLowerCase();
      });
    }

    // ── Dedicated Operational Handling (Dashboard Mode) ──
    let operationalReply = null;

    if (currentView === 'dashboard') {
      // 1. Where is the child / live location query
      if (/(where\s+is|where's|current\s+location|where\s+are\s+they|find\s+(child|him|her|bhavishya)|locate)/i.test(textToSend)) {
        const lat = appState?.latest?.latitude ?? appState?.latest?.lat;
        const lng = appState?.latest?.longitude ?? appState?.latest?.lng;
        const zone = appState?.latest?.nearestGeofence || (appState?.geofences?.[0]?.label);
        const isStale = Boolean(appState?.hardwareStatus?.isStale);
        const isAnomaly = Boolean(appState?.latest?.isAnomaly);
        const motion = appState?.latest?.motionState || 'Normal movement';
        const speed = appState?.latest?.speedKph ?? 0;

        if (lat && lng) {
          operationalReply = {
            text: `Your child was last reported near **${zone || 'their designated area'}** (${Number(lat).toFixed(4)}° N, ${Number(lng).toFixed(4)}° E).

- **Safety Status:** ${isAnomaly ? '⚠️ Flagged outside designated boundary' : '✅ Safe within designated boundary'}
- **Activity:** ${motion} (${speed} km/h)
- **Freshness:** ${isStale ? 'Delayed telemetry' : 'Fresh live satellite GPS'}

Click **Show on Map** below to center the live tracking view.`,
            actionType: 'recenter_map',
            actionLabel: 'Show on Map'
          };
        } else {
          operationalReply = {
            text: `The smart band is currently establishing satellite positioning. Safe places like Home and School are active on your map. Fresh coordinates will appear as soon as the next heartbeat packet is received.`,
            actionType: 'recenter_map',
            actionLabel: 'Check Map'
          };
        }
      }
      // 2. Battery status query
      else if (/(battery|charge|power\s+level|battery\s+percent)/i.test(textToSend)) {
        const battery = appState?.latest?.batteryPercent ?? appState?.hardwareStatus?.batteryPercent ?? 92;
        const isCharging = Boolean(appState?.latest?.batteryCharging);
        operationalReply = {
          text: `The smart band battery is currently at **${battery}%** (${isCharging ? 'Charging' : 'On battery power'}).

With dynamic sleep scheduling, the band operates for **18 to 24 hours** between charges. ${battery < 20 ? '⚠️ Battery is low — please connect the magnetic USB charger soon.' : '✅ Sufficient charge for all-day routine monitoring.'}

1. Charges to 100% in approximately 45 minutes.
2. Low-battery warnings trigger automatically below 20%.`
        };
      }
      // 3. Alerts status query
      else if (/(are\s+there\s+any\s+alerts|check\s+alerts|active\s+alerts|is\s+(he|she|child)\s+safe|any\s+issues)/i.test(textToSend)) {
        const unack = (appState?.alerts || []).filter(a => !a.acknowledged && a.type !== 'nominal_safety');
        if (unack.length > 0) {
          const top = unack[0];
          operationalReply = {
            text: `⚠️ You have **${unack.length} active alert${unack.length > 1 ? 's' : ''}** needing review.

Latest incident: **${top.type === 'boundary_breach' ? 'Boundary Breach' : 'Route Deviation'}**
*"${top.message}"*

Review the details and acknowledge the alert in your Alerts tab.`,
            actionTab: 'alerts',
            actionLabel: 'View Alerts'
          };
        } else {
          operationalReply = {
            text: `✅ All clear! There are no active unacknowledged safety alerts.

All recorded journeys have stayed within designated safe places and followed expected daily routine corridors.`,
            actionTab: 'alerts',
            actionLabel: 'Open Alerts Log'
          };
        }
      }
    }

    // ── Dedicated Operational Handling (Landing Page Mode) ──
    if (currentView === 'landing' && !matchedPreset) {
      if (/(try|demo|test|dashboard|experience)/i.test(textToSend)) {
        operationalReply = {
          text: `You can try our live interactive dashboard immediately! Configure custom safe places, test capstone simulation scenarios (like school detours), and inspect telemetry diagnostics in real time.

Click **Launch Live Demo** below to get started with no account setup required.`,
          actionType: 'launch_demo',
          actionLabel: 'Launch Live Demo'
        };
      } else if (/(price|cost|buy|order|how\s+much)/i.test(textToSend)) {
        operationalReply = {
          text: `CareTag was developed as a university capstone project at Thapar Institute of Engineering & Technology (Batch of 2027). The hardware prototype uses accessible components with a bill of materials under $25, and our software dashboard is open for live demonstration.`,
          actionType: 'launch_demo',
          actionLabel: 'Explore Live Demo'
        };
      } else if (/(sign\s*in|login|account|register)/i.test(textToSend)) {
        operationalReply = {
          text: `Caregivers can sign in to access their private smart band telemetry, personalized safe zones, and family alerts.

Click **Sign In** below to proceed to the caregiver login page.`,
          actionType: 'open_auth',
          actionLabel: 'Sign In'
        };
      }
    }

    let replyText = operationalReply?.text || null;
    let replyActionTab = operationalReply?.actionTab || matchedPreset?.actionTab || null;
    let replyActionLabel = operationalReply?.actionLabel || matchedPreset?.actionLabel || null;
    let replyActionType = operationalReply?.actionType || matchedPreset?.actionType || null;

    if (!replyActionTab && !replyActionType) {
      if (/safe(\s*|-)?(place|zone)|geofence/i.test(textToSend)) {
        replyActionTab = 'safezones';
        replyActionLabel = 'Open Safe Places';
      } else if (/alert|breach|notification/i.test(textToSend)) {
        replyActionTab = 'alerts';
        replyActionLabel = 'View Alerts';
      } else if (/telemetry|inspector|sensor|hardware|model|formula/i.test(textToSend)) {
        replyActionTab = 'inspector';
        replyActionLabel = 'Open Technical Inspector';
      } else if (currentView === 'landing' && /demo|dashboard/i.test(textToSend)) {
        replyActionType = 'launch_demo';
        replyActionLabel = 'Launch Live Demo';
      }
    }

    // ── If already resolved via operationalReply or matchedPreset, we can use it immediately when offline ──
    if (!replyText && matchedPreset) {
      replyText = matchedPreset.getAnswer(appState);
    }

    const systemPrompt = buildSystemPrompt(appState);
    const groqPayloadMessages = [
      { role: 'system', content: systemPrompt },
      ...newMessages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: (m.text || '').replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '').trim().slice(0, 1000)
      }))
    ];

    // ── 1. Try Cloudflare Edge Worker Proxy across candidate endpoints ──
    const candidateEndpoints = getChatEndpoints();
    for (const endpoint of candidateEndpoints) {
      if (replyText) break;
      try {
        const edgeRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: groqPayloadMessages,
            model: 'llama-3.3-70b-versatile'
          })
        });

        if (edgeRes.ok) {
          const data = await edgeRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) {
            replyText = content.trim();
            break;
          }
        }
      } catch {
        // try next endpoint
      }
    }

    // ── 2. Direct Groq API Fallback (Only if client key explicitly provided) ──
    if (!replyText && isOnline && GROQ_API_KEY) {
      for (const model of GROQ_MODELS) {
        try {
          const directRes = await fetch(GROQ_DIRECT_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
              model,
              messages: groqPayloadMessages,
              max_tokens: 500,
              temperature: 0.35
            })
          });

          if (directRes.ok) {
            const data = await directRes.json();
            const choice = data.choices?.[0]?.message?.content;
            if (choice && choice.trim().length > 0) {
              replyText = choice.trim();
              break;
            }
          }
        } catch {
          // Try next model
        }
      }
    }

    // ── 3. Domain-Aware Offline Knowledge Base (When Edge AI & Groq are unreachable) ──
    if (!replyText) {
      replyText = getDomainOfflineAnswer(textToSend, appState);
    }

    const botMessageId = `bot-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: botMessageId,
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: replyText,
        actionTab: replyActionTab,
        actionLabel: replyActionLabel,
        actionType: replyActionType
      }
    ]);

    setIsLoading(false);
  };

  // Resilient handler to navigate to Technical Inspector & manage chatbot layout
  const handleOpenInspectorClick = () => {
    if (onOpenInspector) {
      onOpenInspector();
    } else if (onNavigateTab) {
      onNavigateTab('inspector');
    } else if (onLaunchDashboard) {
      onLaunchDashboard('inspector');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('caretag:navigate-tab', { detail: 'inspector' }));
      
      setIsExpanded(false);
      // Close overlay on smaller screens so the inspector view is immediately visible
      if (window.innerWidth < 1024) {
        setIsOpen(false);
      }

      // Smooth scroll inside content pane
      setTimeout(() => {
        const pane = document.querySelector('.caretag-content-pane');
        if (pane) {
          pane.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 120);
    }
  };

  // 4 Primary Starter Questions for Quick Selection based on currentView
  const starterQuestions = (currentView === 'landing' ? MARKETING_PRESETS : CAREGIVER_PRESETS).slice(0, 4);

  return (
    <div className={`taggy-bot-root ${isOpen ? 'taggy-bot-root--open' : 'taggy-bot-root--closed'} taggy-bot-root--${currentView}`}>
      {/* ── Collapsed Launcher Trigger Button ── */}
      {!isOpen && (
        <div className="taggy-launcher-wrap">
          {!calloutDismissed && (
            <div
              className="taggy-launcher-callout"
              onClick={() => setIsOpen(true)}
              title="Click to chat with Taggy"
            >
              <Sparkles size={13} className="sparkle-icon" />
              <span>Ask <strong>Taggy</strong></span>
              <X
                size={11}
                className="callout-close-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setCalloutDismissed(true);
                }}
              />
            </div>
          )}

          <button
            type="button"
            className="taggy-launcher-btn"
            onClick={() => setIsOpen(true)}
            aria-label="Open Taggy AI Chatbot"
            title="Open Taggy AI Companion"
          >
            <img src={taggyImg} alt="Taggy Mascot" className="taggy-launcher-img" />
            <div
              className={`taggy-live-badge ${!isOnline ? 'offline' : ''}`}
              title={isOnline ? 'Taggy Online' : 'Offline'}
            />
          </button>
        </div>
      )}

      {/* ── Expanded Caregiver/Marketing Chat Window ── */}
      {isOpen && (
        <div
          className={`taggy-chat-window ${isExpanded ? 'taggy-window--expanded' : ''}`}
          role="dialog"
          aria-label="Taggy AI Companion Chat"
          style={
            isMobile && viewportHeight
              ? {
                  height: `${viewportHeight}px`,
                  top: `${viewportOffsetTop}px`,
                  bottom: 'auto'
                }
              : undefined
          }
        >
          {/* Header (Clean, Compact, Brand Navy) */}
          <div className="taggy-chat-header">
            <div className="taggy-header-info">
              <div className="taggy-avatar-frame">
                <img src={taggyImg} alt="Taggy Avatar" />
              </div>
              <div className="taggy-header-text">
                <h3>
                  Taggy
                  <span className="taggy-role-tag">
                    {currentView === 'landing' ? 'Product Guide' : 'AI Companion'}
                  </span>
                </h3>
                <p className="status-line">
                  <span className={`dot-online ${!isOnline ? 'dot-offline' : ''}`} />
                  <span>{isOnline ? 'Online · Here to help' : 'Offline · Ready to help'}</span>
                </p>
              </div>
            </div>

            <div className="taggy-header-actions">
              <button
                type="button"
                className="taggy-icon-btn"
                onClick={handleResetChat}
                title="Start new conversation"
                aria-label="Start new conversation"
              >
                <RefreshCw size={13} />
              </button>

              <button
                type="button"
                className="taggy-icon-btn"
                onClick={() => setIsExpanded(prev => !prev)}
                title={isExpanded ? 'Standard view' : 'Expand view'}
                aria-label={isExpanded ? 'Standard view' : 'Expand view'}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>

              <button
                type="button"
                className="taggy-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                aria-label="Close chat"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages Feed (Independently Scrollable Container) */}
          <div
            ref={feedRef}
            className="taggy-messages-feed"
            onScroll={handleFeedScroll}
          >
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              const { mainText, techDetails, techSummary } = isBot
                ? parseMessageContent(msg.text)
                : { mainText: msg.text, techDetails: null };

              return (
                <div key={msg.id} className={`taggy-msg-row ${msg.sender}`}>
                  <div className={`taggy-msg-avatar ${msg.sender}`}>
                    {isBot ? (
                      <img src={taggyImg} alt="Taggy" />
                    ) : (
                      <User size={13} />
                    )}
                  </div>

                  <div className="taggy-msg-content-wrap">
                    <div className="taggy-msg-bubble">
                      <MarkdownRenderer content={mainText} />

                      {/* Optional Collapsible Technical Details (Default Collapsed) */}
                      {isBot && techDetails && (
                        <TechDisclosure
                          summary={techSummary}
                          content={techDetails}
                          onOpenInspector={handleOpenInspectorClick}
                        />
                      )}

                      {/* Contextual Quick Action Pill if relevant */}
                      {isBot && (msg.actionTab || msg.actionType) && (
                        <div className="taggy-msg-action-pill-wrap">
                          <button
                            type="button"
                            className="taggy-action-pill-btn"
                            onClick={() => {
                              if (msg.actionTab === 'inspector' || msg.actionType === 'open_inspector') {
                                handleOpenInspectorClick();
                              } else if (msg.actionTab && onNavigateTab) {
                                onNavigateTab(msg.actionTab);
                              } else if (msg.actionType === 'recenter_map' && onRecenterMap) {
                                onRecenterMap();
                              } else if (msg.actionType === 'launch_demo' && onLaunchDashboard) {
                                onLaunchDashboard();
                              } else if (msg.actionType === 'open_auth' && onOpenAuth) {
                                onOpenAuth();
                              }
                            }}
                          >
                            {msg.actionTab === 'safezones' && <MapPin size={11} />}
                            {msg.actionTab === 'alerts' && <Bell size={11} />}
                            {msg.actionType === 'recenter_map' && <Crosshair size={11} />}
                            {msg.actionType === 'launch_demo' && <Sparkles size={11} />}
                            {msg.actionType === 'open_auth' && <User size={11} />}
                            {(msg.actionTab === 'inspector' || msg.actionType === 'open_inspector') && <Settings size={11} />}
                            <span>{msg.actionLabel || 'View'}</span>
                            <ArrowRight size={10} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="taggy-msg-actions">
                      <span className="taggy-msg-time">{msg.time}</span>
                      {isBot && (
                        <button
                          type="button"
                          className="taggy-copy-btn"
                          onClick={() => handleCopy(msg.id, msg.text)}
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={10} style={{ color: '#10B981' }} />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Suggested Questions Toggle Control (Collapsed by default per specification) */}
            <div className="taggy-suggestions-control-wrap">
              <button
                type="button"
                className="taggy-suggestions-toggle-btn"
                onClick={() => setShowQuestions(prev => !prev)}
                aria-expanded={showQuestions}
                aria-controls="taggy-suggestions-region"
                title={showQuestions ? 'Hide suggested questions' : 'Show suggested questions'}
              >
                <Sparkles size={12} className="sparkle-gold" />
                <span>{showQuestions ? 'Hide suggested questions' : 'Show suggested questions'}</span>
                <ChevronDown size={13} className={`taggy-chevron ${showQuestions ? 'rotated' : ''}`} />
              </button>
            </div>

            {/* Suggested Questions Grid (Only rendered when user explicitly expands) */}
            {showQuestions && (
              <div id="taggy-suggestions-region" className="taggy-front-questions" role="region" aria-label="Suggested questions">
                <div className="front-questions-header">
                  <Sparkles size={12} className="sparkle-gold" />
                  <span>
                    {currentView === 'landing' ? 'Popular product questions:' : 'Suggested questions:'}
                  </span>
                </div>
                <div className="front-questions-grid">
                  {starterQuestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="front-question-card"
                      onClick={() => {
                        handleSend(q.prompt);
                        setShowQuestions(false);
                      }}
                      disabled={isLoading}
                    >
                      <span className="q-text">{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="taggy-msg-row bot">
                <div className="taggy-msg-avatar bot">
                  <img src={taggyImg} alt="Taggy" />
                </div>
                <div className="taggy-msg-bubble taggy-msg-bubble--typing">
                  <div className="taggy-typing-dots">
                    <div className="taggy-dot" />
                    <div className="taggy-dot" />
                    <div className="taggy-dot" />
                  </div>
                  <span className="taggy-typing-text">Taggy is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer & Anchored Composer (Never Covers Messages) */}
          <div className="taggy-chat-footer">
            <form
              className="taggy-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                ref={inputRef}
                type="text"
                className="taggy-chat-input"
                placeholder={currentView === 'landing' ? 'Ask about CareTag features, battery, AI...' : 'Ask Taggy anything...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="taggy-send-btn"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                title="Send"
              >
                <Send size={15} />
              </button>
            </form>

            <div className="taggy-footer-meta">
              <span>{currentView === 'landing' ? 'CareTag Product Guide' : 'CareTag AI Companion'}</span>
              <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
