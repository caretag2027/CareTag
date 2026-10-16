/**
 * CareTag Authentication Service
 * 
 * Supports Cloudflare Edge Worker backend (/api/auth) with automatic
 * offline localStorage fallback for uninterrupted reliability.
 * 
 * Includes:
 * - Serverless registration & login with Cloudflare KV
 * - Role-based profiles (Guardian, Caregiver, Administrator)
 * - Wearable Device Key binding (e.g. CARE-TAG-01)
 * - Session token management
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

// ── Storage keys ──
const USERS_KEY = 'caretag.users';
const SESSION_KEY = 'caretag.session';

// ── Password hashing fallback (SHA-256) ──
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`caretag-salt-2026:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `usr_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadLocalUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

function saveLocalUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  catch {}
}

// ── Public API ──

/**
 * Register a new user account.
 * Attempts Cloudflare Worker backend first, falls back to local storage if offline.
 */
export async function register(name, email, password, role = 'guardian', deviceKey = 'CARE-TAG-01') {
  if (!name?.trim()) return { ok: false, error: 'Name is required' };
  if (!email?.trim() || !email.includes('@')) return { ok: false, error: 'Valid email is required' };
  if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };

  const normalizedEmail = email.trim().toLowerCase();
  const cleanDeviceKey = (deviceKey || 'CARE-TAG-01').trim().toUpperCase();

  // Try Cloudflare Worker backend
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role,
        deviceKey: cleanDeviceKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.user) {
        const session = {
          userId: data.user.userId || data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role || role,
          deviceKey: data.user.deviceKey || cleanDeviceKey,
          token: data.token,
          backend: 'cloudflare-worker',
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, user: session };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 409 || errData.error) {
        return { ok: false, error: errData.error || 'Account creation failed' };
      }
    }
  } catch (e) {
    // Backend unreachable — proceed to local storage fallback
  }

  // Fallback: LocalStorage registration
  const localUsers = loadLocalUsers();
  if (localUsers.some(u => u.email === normalizedEmail)) {
    return { ok: false, error: 'An account with this email already exists' };
  }

  const passwordHash = await hashPassword(password);
  const newUser = {
    id: generateId(),
    name: name.trim(),
    email: normalizedEmail,
    role,
    deviceKey: cleanDeviceKey,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  localUsers.push(newUser);
  saveLocalUsers(localUsers);

  const session = {
    userId: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    deviceKey: newUser.deviceKey,
    backend: 'local-fallback',
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { ok: true, user: session };
}

/**
 * Login with email and password.
 * Checks Cloudflare Worker backend first, falls back to local accounts.
 */
export async function login(email, password) {
  if (!email?.trim()) return { ok: false, error: 'Email is required' };
  if (!password) return { ok: false, error: 'Password is required' };

  const normalizedEmail = email.trim().toLowerCase();

  // Try Cloudflare Worker backend
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.user) {
        const session = {
          userId: data.user.userId || data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role || 'guardian',
          deviceKey: data.user.deviceKey || 'CARE-TAG-01',
          token: data.token,
          backend: 'cloudflare-worker',
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, user: session };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      // If server explicitly rejected password, return error
      if (res.status === 401) {
        return { ok: false, error: errData.error || 'Invalid email or password' };
      }
    }
  } catch (e) {
    // Network error — fall back to local accounts
  }

  // Fallback: Check local storage
  const localUsers = loadLocalUsers();
  const passwordHash = await hashPassword(password);
  const found = localUsers.find(u => u.email === normalizedEmail && u.passwordHash === passwordHash);

  if (!found) {
    // Built-in demo accounts in local mode
    if (normalizedEmail === 'demo@caretag.io' && password === 'caretag2026') {
      const session = {
        userId: 'usr_demo_guardian',
        name: 'Dr. Sarah Jenkins',
        email: 'demo@caretag.io',
        role: 'guardian',
        deviceKey: 'CARE-TAG-01',
        backend: 'local-demo',
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    }
    return { ok: false, error: 'Invalid email or password' };
  }

  const session = {
    userId: found.id,
    name: found.name,
    email: found.email,
    role: found.role || 'guardian',
    deviceKey: found.deviceKey || 'CARE-TAG-01',
    backend: 'local-fallback',
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { ok: true, user: session };
}

/**
 * Get current session.
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.userId) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * Logout and clear session.
 */
export function logout() {
  const session = getSession();
  if (session?.token) {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
    }).catch(() => {});
  }
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Get a user-scoped localStorage key.
 */
export function userKey(userId, suffix) {
  return `caretag.${userId}.${suffix}`;
}

const auth = { register, login, getSession, logout, userKey };
export default auth;
