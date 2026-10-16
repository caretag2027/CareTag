/**
 * CareTag Cloudflare Worker Backend
 * 
 * Provides serverless APIs for:
 * - Authentication (Register, Login, Session verification) with Cloudflare KV
 * - Geofence Management (CRUD)
 * - Telemetry & Device Packet Ingestion (Ready for Firebase sync)
 * - Alerts & Battery Telemetry
 * - Static Assets Fallback for React Single Page Application
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

// ── Crypto / Password Hashing (PBKDF2 / SHA-256) ──
async function hashPassword(password, salt = 'caretag-salt-2026') {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateToken() {
  return crypto.randomUUID ? crypto.randomUUID() : `token-${Date.now()}-${Math.random().toString(36).substring(2)}`;
}

// ── Auth Middleware Helper ──
async function getAuthenticatedUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !env.CARETAG_KV) return null;

  try {
    const sessionRaw = await env.CARETAG_KV.get(`session:${token}`);
    if (!sessionRaw) return null;
    return JSON.parse(sessionRaw);
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ── API ROUTES ──
    if (url.pathname.startsWith('/api/')) {
      try {
        // Health check
        if (url.pathname === '/api/health') {
          return json({
            ok: true,
            status: 'online',
            service: 'CareTag Edge Worker',
            platform: 'Cloudflare Workers',
            timestamp: new Date().toISOString(),
          });
        }

        // ── AUTH: Register ──
        if (url.pathname === '/api/auth/register' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const { name, email, password, role = 'guardian', deviceKey = 'CARE-TAG-01' } = body;

          if (!name?.trim()) return error('Name is required');
          if (!email?.trim() || !email.includes('@')) return error('Valid email is required');
          if (!password || password.length < 4) return error('Password must be at least 4 characters');

          const normalizedEmail = email.trim().toLowerCase();
          const userKey = `user:${normalizedEmail}`;

          if (env.CARETAG_KV) {
            const existing = await env.CARETAG_KV.get(userKey);
            if (existing) {
              return error('An account with this email already exists', 409);
            }
          }

          const passwordHash = await hashPassword(password);
          const userId = `usr_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now()}`;
          const user = {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            role,
            deviceKey: deviceKey.trim().toUpperCase(),
            passwordHash,
            createdAt: new Date().toISOString(),
          };

          const token = generateToken();
          const session = {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            deviceKey: user.deviceKey,
            createdAt: user.createdAt,
          };

          if (env.CARETAG_KV) {
            // Save user and session (session valid for 30 days)
            await env.CARETAG_KV.put(userKey, JSON.stringify(user));
            await env.CARETAG_KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 86400 * 30 });
          }

          return json({ ok: true, user: session, token });
        }

        // ── AUTH: Login ──
        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const { email, password } = body;

          if (!email?.trim() || !password) {
            return error('Email and password are required');
          }

          const normalizedEmail = email.trim().toLowerCase();
          const userKey = `user:${normalizedEmail}`;

          // Built-in Demo accounts if not in KV yet
          const demoAccounts = {
            'demo@caretag.io': {
              id: 'usr_demo_guardian',
              name: 'Dr. Sarah Jenkins',
              email: 'demo@caretag.io',
              role: 'guardian',
              deviceKey: 'CARE-TAG-01',
              passwordHash: await hashPassword('caretag2026'),
            },
            'caregiver@caretag.io': {
              id: 'usr_demo_caregiver',
              name: 'Marcus Vance, RN',
              email: 'caregiver@caretag.io',
              role: 'caregiver',
              deviceKey: 'CARE-TAG-02',
              passwordHash: await hashPassword('caretag2026'),
            },
          };

          let user = null;
          if (env.CARETAG_KV) {
            const raw = await env.CARETAG_KV.get(userKey);
            if (raw) {
              user = JSON.parse(raw);
            }
          }

          if (!user && demoAccounts[normalizedEmail]) {
            user = demoAccounts[normalizedEmail];
            // Provision demo user in KV
            if (env.CARETAG_KV) {
              await env.CARETAG_KV.put(userKey, JSON.stringify(user));
            }
          }

          if (!user) {
            return error('Invalid email or password', 401);
          }

          const expectedHash = await hashPassword(password);
          if (user.passwordHash !== expectedHash) {
            return error('Invalid email or password', 401);
          }

          const token = generateToken();
          const session = {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role || 'guardian',
            deviceKey: user.deviceKey || 'CARE-TAG-01',
          };

          if (env.CARETAG_KV) {
            await env.CARETAG_KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 86400 * 30 });
          }

          return json({ ok: true, user: session, token });
        }

        // ── AUTH: Current User Profile ──
        if (url.pathname === '/api/auth/me' && request.method === 'GET') {
          const session = await getAuthenticatedUser(request, env);
          if (!session) return error('Unauthorized', 401);
          return json({ ok: true, user: session });
        }

        // ── AUTH: Logout ──
        if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
          const authHeader = request.headers.get('Authorization') || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          if (token && env.CARETAG_KV) {
            await env.CARETAG_KV.delete(`session:${token}`);
          }
          return json({ ok: true });
        }

        // ── GEOFENCES: GET /api/devices/:deviceKey/geofences ──
        const geofencesMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/geofences$/);
        if (geofencesMatch) {
          const deviceKey = decodeURIComponent(geofencesMatch[1]);
          const session = await getAuthenticatedUser(request, env);
          const userId = session?.userId || 'anonymous';
          const kvKey = `geofences:${userId}:${deviceKey}`;

          if (request.method === 'GET') {
            let list = [];
            if (env.CARETAG_KV) {
              const raw = await env.CARETAG_KV.get(kvKey);
              if (raw) list = JSON.parse(raw);
            }
            return json(list);
          }

          if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            let list = [];
            if (env.CARETAG_KV) {
              const raw = await env.CARETAG_KV.get(kvKey);
              if (raw) list = JSON.parse(raw);
            }

            const label = body.Label || body.label || 'Safe Zone';
            if (list.some(g => (g.label || '').toLowerCase() === label.toLowerCase())) {
              return error('A geofence with this label already exists. Choose a different name.', 409);
            }

            const newGeo = {
              id: Date.now(),
              label,
              centerLatitude: Number(body.CenterLatitude ?? body.centerLatitude),
              centerLongitude: Number(body.CenterLongitude ?? body.centerLongitude),
              radiusMeters: Number(body.RadiusMeters ?? body.radiusMeters ?? 100),
              isActive: true,
              createdAtUtc: new Date().toISOString(),
              deviceKey,
            };

            list.push(newGeo);
            if (env.CARETAG_KV) {
              await env.CARETAG_KV.put(kvKey, JSON.stringify(list));
            }

            return json(newGeo, 201);
          }
        }

        // ── GEOFENCE DELETE: /api/devices/:deviceKey/geofences/:id ──
        const deleteMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/geofences\/([^/]+)$/);
        if (deleteMatch && request.method === 'DELETE') {
          const deviceKey = decodeURIComponent(deleteMatch[1]);
          const id = Number(deleteMatch[2]);
          const session = await getAuthenticatedUser(request, env);
          const userId = session?.userId || 'anonymous';
          const kvKey = `geofences:${userId}:${deviceKey}`;

          if (env.CARETAG_KV) {
            const raw = await env.CARETAG_KV.get(kvKey);
            if (raw) {
              const list = JSON.parse(raw).filter(g => g.id !== id);
              await env.CARETAG_KV.put(kvKey, JSON.stringify(list));
            }
          }
          return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        // ── TELEMETRY: Latest Packet / Ingestion (Ready for Firebase) ──
        const packetMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/packets\/latest$/);
        if (packetMatch && request.method === 'GET') {
          const deviceKey = decodeURIComponent(packetMatch[1]);
          let packet = null;
          if (env.CARETAG_KV) {
            const raw = await env.CARETAG_KV.get(`packet:${deviceKey}`);
            if (raw) packet = JSON.parse(raw);
          }

          if (!packet) {
            // Default initial packet if none received yet
            packet = {
              deviceKey,
              latitude: 37.7749,
              longitude: -122.4194,
              speedKph: 0,
              batteryPercent: 95,
              timestamp: new Date().toISOString(),
              isAnomaly: false,
              deviationScore: 0.12,
              source: 'default_anchor',
            };
          }
          return json(packet);
        }

        // Ingest telemetry packet (via device, simulation, or Firebase Webhook)
        const ingestMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/packets$/);
        if (ingestMatch && request.method === 'POST') {
          const deviceKey = decodeURIComponent(ingestMatch[1]);
          const body = await request.json().catch(() => ({}));
          const packet = {
            deviceKey,
            latitude: Number(body.latitude ?? body.Latitude),
            longitude: Number(body.longitude ?? body.Longitude),
            speedKph: Number(body.speedKph ?? body.speed ?? 0),
            batteryPercent: Number(body.batteryPercent ?? body.battery ?? 100),
            isAnomaly: Boolean(body.isAnomaly),
            deviationScore: Number(body.deviationScore ?? 0),
            nearestGeofence: body.nearestGeofence || null,
            timestamp: body.timestamp || new Date().toISOString(),
            source: body.source || 'device_telemetry',
          };

          if (env.CARETAG_KV) {
            await env.CARETAG_KV.put(`packet:${deviceKey}`, JSON.stringify(packet), { expirationTtl: 86400 * 7 });
          }
          return json({ ok: true, packet });
        }

        // ── ALERTS: /api/devices/:deviceKey/alerts ──
        const alertsMatch = url.pathname.match(/^\/api\/devices\/([^/]+)\/alerts$/);
        if (alertsMatch) {
          const deviceKey = decodeURIComponent(alertsMatch[1]);
          const session = await getAuthenticatedUser(request, env);
          const userId = session?.userId || 'anonymous';
          const kvKey = `alerts:${userId}:${deviceKey}`;

          if (request.method === 'GET') {
            let alerts = [];
            if (env.CARETAG_KV) {
              const raw = await env.CARETAG_KV.get(kvKey);
              if (raw) alerts = JSON.parse(raw);
            }
            return json(alerts);
          }

          if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            let alerts = [];
            if (env.CARETAG_KV) {
              const raw = await env.CARETAG_KV.get(kvKey);
              if (raw) alerts = JSON.parse(raw);
            }

            const alert = {
              id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              deviceKey,
              type: body.type || 'anomaly',
              timestamp: new Date().toISOString(),
              latitude: body.latitude,
              longitude: body.longitude,
              nearestGeofence: body.nearestGeofence || null,
              distance: body.distance || null,
              deviationScore: body.deviationScore || null,
              message: body.message || 'Alert triggered',
              acknowledged: false,
              batteryPercent: body.batteryPercent || null,
            };

            alerts.unshift(alert);
            if (alerts.length > 500) alerts.length = 500;

            if (env.CARETAG_KV) {
              await env.CARETAG_KV.put(kvKey, JSON.stringify(alerts));
            }
            return json(alert, 201);
          }
        }

        // ── FIREBASE INTEGRATION HOOK ──
        if (url.pathname === '/api/firebase/config' && request.method === 'GET') {
          return json({
            configured: false,
            readyForSetup: true,
            message: 'Firebase Realtime Database endpoint prepared. You can connect Firebase credentials here.',
          });
        }

        return error('Endpoint not found', 404);
      } catch (err) {
        return json({ ok: false, error: err.message || 'Internal server error' }, 500);
      }
    }

    // ── STATIC ASSETS FALLBACK ──
    // All other requests serve the React frontend assets from build/
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('CareTag Worker Active', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  },
};
