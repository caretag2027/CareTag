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
  ArrowRight
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   GROQ API & CLOUDFLARE EDGE CONFIGURATION
   ────────────────────────────────────────────────────────────── */
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || '';
const GROQ_DIRECT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const CLOUDFLARE_EDGE_ENDPOINT = '/api/chat';
const GROQ_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

/* ──────────────────────────────────────────────────────────────
   CAREGIVER-FIRST DYNAMIC SYSTEM PROMPT BUILDER
   ────────────────────────────────────────────────────────────── */
function buildSystemPrompt(appState = {}) {
  const {
    currentView = 'landing',
    activeTab = 'overview',
    bandStatus = {},
    hardwareStatus = {},
    geofences = [],
    alerts = [],
    latest = null,
  } = appState;

  const effectiveBand = hardwareStatus?.connected !== undefined ? hardwareStatus : (bandStatus || {});
  const isConnected = effectiveBand.connected !== undefined ? Boolean(effectiveBand.connected) : true;
  const isStale = Boolean(effectiveBand.isStale);
  const batteryPercent = latest?.batteryPercent ?? effectiveBand.batteryPercent ?? 92;

  const zoneCount = geofences.length;
  const zoneNames = zoneCount > 0 ? geofences.map(g => g.label).join(', ') : 'None configured';
  const topAlert = alerts.find(a => !a.acknowledged) || alerts[0];

  const contextSnippet = `APPLICATION CONTEXT:
- Current View: ${currentView === 'dashboard' ? `Dashboard (${activeTab} tab)` : 'CareTag Home & Product Page'}
- Smart Band: ${isConnected ? 'Connected' : 'Offline / Reconnecting'} (Battery: ${batteryPercent}%, Telemetry freshness: ${isStale ? 'Stale / Delayed' : 'Fresh live updates'})
- Safe Places: ${zoneCount > 0 ? `${zoneCount} safe places configured (${zoneNames})` : 'No safe places configured yet'}
- Recent Alert: ${topAlert ? `${topAlert.type}: "${topAlert.message}" (${new Date(topAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'No active alerts'}`;

  return `You are Taggy, the caregiver-first AI companion for CareTag (a smart child safety & routine monitoring wearable dashboard).

CRITICAL CAREGIVER-FIRST RESPONSE POLICY:
- Your primary audience is caregivers (parents and guardians). They want to know where their child is, how to configure safe places, what an alert means, and what to do next.
- DO NOT automatically explain underlying engineering, LSTM models, sensor part numbers, math formulas, or datasets in ordinary answers.
- Keep answers SHORT, clear, and reassuring (strictly 30 to 70 words total for ordinary questions).
- Follow this structure:
  1. Direct answer: 1 to 2 clear, everyday sentences.
  2. Helpful next step: up to 3 concise, numbered steps or actions if relevant.
  3. Optional technical details: Only if deeper context is genuinely relevant, wrap it in:
     <details>
     <summary>How does this work technically?</summary>
     [Brief engineering explanation. Mention that full telemetry is in the Technical Inspector.]
     </details>
- Never guarantee safety (e.g. do not claim "your child is 100% safe" or that geofences prevent incidents).
- If telemetry is stale or device offline, be honest and remind the caregiver that the displayed location may not be live.
- Do not repeat the user's question. Do not append generic conversational fillers like "How else can I help?" at the end.

EXPLICIT TECHNICAL QUERIES:
If the user specifically asks technical questions (e.g., "How does the AI model work?", "What is the deviation formula?", "Which sensors are installed?"):
- Provide a brief 2-sentence summary first in plain language.
- Then provide the technical breakdown in <details><summary>How does this work technically?</summary>...</details>. Mention they can visit the Evaluator Console / Technical Inspector in the dashboard for live telemetry and data charts.

${contextSnippet}`;
}

/* ──────────────────────────────────────────────────────────────
   CURATED CAREGIVER STARTER QUESTIONS & EXACT PRESET ANSWERS
   ────────────────────────────────────────────────────────────── */
const CAREGIVER_PRESETS = [
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
   PARSER FOR COLLAPSIBLE TECHNICAL DETAILS
   ────────────────────────────────────────────────────────────── */
function parseMessageContent(text = '') {
  let mainText = text;
  let techDetails = null;
  let techSummary = 'How does this work technically?';

  // Support <details><summary>...</summary>...</details>
  const detailsRegex = /<details[^>]*>\s*<summary>(.*?)<\/summary>(.*?)<\/details>/s;
  const detailsMatch = text.match(detailsRegex);

  if (detailsMatch) {
    mainText = text.replace(detailsRegex, '').trim();
    techSummary = detailsMatch[1].trim() || 'How does this work technically?';
    techDetails = detailsMatch[2].trim();
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
        title={isExpanded ? 'Collapse technical details' : 'Expand technical details'}
      >
        <span className="taggy-tech-label">
          <Settings size={12} className="taggy-tech-icon" />
          <span>{summary}</span>
        </span>
        <span className="taggy-tech-action">
          <span className="taggy-tech-action-text">{isExpanded ? 'Hide' : 'Expand'}</span>
          <ChevronDown size={12} className={`taggy-chevron ${isExpanded ? 'rotated' : ''}`} />
        </span>
      </button>

      {isExpanded && (
        <div className="taggy-tech-content">
          <MarkdownRenderer content={content} isNested />
          {onOpenInspector && (
            <button
              type="button"
              className="taggy-inspector-btn"
              onClick={onOpenInspector}
            >
              <span>View live telemetry in Technical Inspector</span>
              <ExternalLink size={11} />
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
   MAIN TAGGY CHATBOT COMPONENT
   ────────────────────────────────────────────────────────────── */
export default function TaggyChatbot({
  currentView = 'landing',
  activeTab = 'overview',
  hardwareStatus = { connected: true, batteryPercent: 92 },
  geofences = [],
  alerts = [],
  latest = null,
  simRunning = false,
  onNavigateTab = null,
  onOpenInspector = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Caregiver-first welcome greeting
  const [messages, setMessages] = useState([
    {
      id: 'welcome-msg',
      sender: 'bot',
      time: 'Just now',
      text: `Hi, I'm **Taggy**!

I can help you set up safe places, understand alerts, and use your CareTag dashboard.

What would you like help with?`
    }
  ]);

  const messagesEndRef = useRef(null);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const isUserNearBottomRef = useRef(true);

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

  // Scroll to bottom when new response arrives if user is near bottom
  useEffect(() => {
    if (isOpen && isUserNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
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
        text: `Hi, I'm **Taggy**!

I can help you set up safe places, understand alerts, and use your CareTag dashboard.

What would you like help with?`
      }
    ]);
    setShowQuestions(true);
    isUserNearBottomRef.current = true;
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

  // Send message handler with Edge Worker + Groq API + Smart Presets
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

    // Exact preset check
    const cleanInput = textToSend.trim().toLowerCase().replace(/[?!.,]/g, '');
    const matchedPreset = CAREGIVER_PRESETS.find(q => {
      const p = q.prompt.trim().toLowerCase().replace(/[?!.,]/g, '');
      const l = q.label.trim().toLowerCase().replace(/[?!.,]/g, '');
      return cleanInput === p || cleanInput === l || textToSend.toLowerCase() === q.prompt.toLowerCase();
    });

    let replyText = null;
    let replyActionTab = matchedPreset?.actionTab || null;
    let replyActionLabel = matchedPreset?.actionLabel || null;

    if (!replyActionTab) {
      if (/safe(\s*|-)?(place|zone)|geofence/i.test(textToSend)) {
        replyActionTab = 'safezones';
        replyActionLabel = 'Open Safe Places';
      } else if (/alert|breach|notification/i.test(textToSend)) {
        replyActionTab = 'alerts';
        replyActionLabel = 'View Alerts';
      } else if (/telemetry|inspector|sensor|hardware|model|formula/i.test(textToSend)) {
        replyActionTab = 'inspector';
        replyActionLabel = 'Open Technical Inspector';
      }
    }

    const systemPrompt = buildSystemPrompt(appState);
    const groqPayloadMessages = [
      { role: 'system', content: systemPrompt },
      ...newMessages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: (m.text || '').replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '').trim().slice(0, 1000)
      }))
    ];

    // ── 1. Try Cloudflare Edge Worker Proxy (/api/chat) ──
    try {
      const edgeRes = await fetch(CLOUDFLARE_EDGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: groqPayloadMessages,
          model: 'qwen/qwen3.8-27b'
        })
      });

      if (edgeRes.ok) {
        const data = await edgeRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim().length > 0) {
          replyText = content.trim();
        }
      }
    } catch {
      // Local dev or non-worker mode, proceed to direct Groq API
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

    // ── 3. Curated Caregiver Fallback if Offline or API unavailable ──
    if (!replyText) {
      if (matchedPreset) {
        replyText = matchedPreset.getAnswer(appState);
      } else {
        // Safe, concise caregiver-first fallback
        replyText = `I'm here to help you monitor your child's safety with CareTag.

You can check their location on the map, set up safe places in **Safe Places**, or review notifications in **Alerts**. If you are looking for specific technical documentation, you can open the Technical Inspector anytime.`;
      }
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
        actionLabel: replyActionLabel
      }
    ]);

    setIsLoading(false);
  };

  // 4 Primary Caregiver Starter Questions for Quick Selection
  const starterQuestions = CAREGIVER_PRESETS.slice(0, 4);

  return (
    <div className="taggy-bot-root">
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

      {/* ── Expanded Caregiver-First Chat Window ── */}
      {isOpen && (
        <div
          className={`taggy-chat-window ${isExpanded ? 'taggy-window--expanded' : ''}`}
          role="dialog"
          aria-label="Taggy AI Companion Chat"
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
                  <span className="taggy-role-tag">AI Companion</span>
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
                          onOpenInspector={onOpenInspector}
                        />
                      )}

                      {/* Contextual Quick Action Pill if relevant */}
                      {isBot && msg.actionTab && onNavigateTab && (
                        <div className="taggy-msg-action-pill-wrap">
                          <button
                            type="button"
                            className="taggy-action-pill-btn"
                            onClick={() => onNavigateTab(msg.actionTab)}
                          >
                            {msg.actionTab === 'safezones' && <MapPin size={11} />}
                            {msg.actionTab === 'alerts' && <Bell size={11} />}
                            <span>{msg.actionLabel || 'Go to page'}</span>
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

            {/* Suggested Questions Grid (Caregiver-Focused) */}
            {(messages.length <= 1 || showQuestions) && (
              <div className="taggy-front-questions">
                <div className="front-questions-header">
                  <Sparkles size={12} className="sparkle-gold" />
                  <span>Suggested questions:</span>
                </div>
                <div className="front-questions-grid">
                  {starterQuestions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="front-question-card"
                      onClick={() => {
                        handleSend(q.prompt);
                        if (messages.length >= 1) setShowQuestions(false);
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
            {messages.length > 1 && (
              <div className="taggy-footer-q-toggle">
                <button
                  type="button"
                  className="taggy-toggle-q-btn"
                  onClick={() => setShowQuestions(prev => !prev)}
                >
                  <Sparkles size={11} />
                  <span>{showQuestions ? 'Hide questions' : 'Show suggested questions'}</span>
                </button>
              </div>
            )}

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
                placeholder="Ask Taggy anything..."
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
                <Send size={13} />
              </button>
            </form>

            <div className="taggy-footer-meta">
              <span>CareTag AI Companion</span>
              <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
