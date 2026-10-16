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
  try {
    const scope = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
    const Encoder = typeof TextEncoder !== 'undefined' ? TextEncoder : scope.TextEncoder;
    if (!Encoder) return `hash_${password}`;
    const encoder = new Encoder();
    const data = encoder.encode(`caretag-salt-2026:${password}`);
    const subtle = (typeof crypto !== 'undefined' && crypto?.subtle)
      ? crypto.subtle
      : scope.crypto?.subtle;
    if (!subtle) return `hash_${password}`;
    const hash = await subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `hash_${password}`;
  }
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

// ── Dedicated Preconfigured Institutional Accounts ──
export const DEDICATED_ACCOUNTS = [
  {
    id: 'usr_singla_be23',
    name: 'Bhavishya Singla',
    email: 'singla_be23@thapar.edu',
    displayEmail: 'Singla_BE23@thapar.edu',
    role: 'admin',
    deviceKey: 'CARE-TAG-01',
    password: '12345',
    department: 'Computer Engineering (BE23)',
    institution: 'Thapar Institute of Engineering & Technology',
    isPrimary: true,
  },
  {
    id: 'usr_dr_sharma',
    name: 'Dr. Rajesh Sharma',
    email: 'dr.sharma@thapar.edu',
    displayEmail: 'dr.sharma@thapar.edu',
    role: 'caregiver',
    deviceKey: 'CARE-TAG-02',
    password: '12345',
    department: 'Health & Clinical Center',
    institution: 'Thapar Institute of Engineering & Technology',
  },
  {
    id: 'usr_nurse_ananya',
    name: 'Ananya Verma, RN',
    email: 'nurse.ananya@thapar.edu',
    displayEmail: 'nurse.ananya@thapar.edu',
    role: 'caregiver',
    deviceKey: 'CARE-TAG-03',
    password: '12345',
    department: 'Elderly & Pediatric Care Unit',
    institution: 'Thapar Institute of Engineering & Technology',
  },
  {
    id: 'usr_warden_safety',
    name: 'Campus Safety Control',
    email: 'warden.safety@thapar.edu',
    displayEmail: 'warden.safety@thapar.edu',
    role: 'admin',
    deviceKey: 'CARE-TAG-04',
    password: '12345',
    department: 'Campus Security & Geofence Dispatch',
    institution: 'Thapar Institute of Engineering & Technology',
  },
  {
    id: 'usr_parent_guardian',
    name: 'Priya Singla',
    email: 'parent.guardian@thapar.edu',
    displayEmail: 'parent.guardian@thapar.edu',
    role: 'guardian',
    deviceKey: 'CARE-TAG-05',
    password: '12345',
    department: 'Family Guardian Network',
    institution: 'Thapar Institute of Engineering & Technology',
  },
];

/**
 * Normalizes email or login ID input to be forgiving of whitespace,
 * casing, and common speech-to-text / copy-paste patterns like 'at the rate'.
 */
export function normalizeEmail(email) {
  if (!email) return '';
  return email
    .trim()
    .toLowerCase()
    .replace(/\s*at\s+the\s+rate\s*/gi, '@')
    .replace(/\s+/g, '');
}

/**
 * Login with email and password.
 * Checks Cloudflare Worker backend first, falls back to dedicated institutional accounts.
 */
export async function login(email, password) {
  if (!email?.trim()) return { ok: false, error: 'Login ID / Email is required' };
  if (!password) return { ok: false, error: 'Password is required' };

  const normalizedEmail = normalizeEmail(email);

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
          role: data.user.role || 'admin',
          deviceKey: data.user.deviceKey || 'CARE-TAG-01',
          token: data.token,
          backend: 'cloudflare-worker',
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, user: session };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 401) {
        return { ok: false, error: errData.error || 'Invalid email or password' };
      }
    }
  } catch (e) {
    // Network error — fall back to dedicated local accounts
  }

  // Fallback: Check Dedicated Preconfigured Accounts
  const dedicated = DEDICATED_ACCOUNTS.find(
    acc => acc.email === normalizedEmail || normalizeEmail(acc.displayEmail) === normalizedEmail
  );

  if (dedicated) {
    if (password === dedicated.password) {
      const session = {
        userId: dedicated.id,
        name: dedicated.name,
        email: dedicated.email,
        role: dedicated.role,
        deviceKey: dedicated.deviceKey,
        department: dedicated.department,
        institution: dedicated.institution,
        backend: 'dedicated-account',
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    } else {
      return { ok: false, error: 'Incorrect password for this institutional account' };
    }
  }

  // Fallback: Check local storage
  const localUsers = loadLocalUsers();
  const passwordHash = await hashPassword(password);
  const found = localUsers.find(u => normalizeEmail(u.email) === normalizedEmail && u.passwordHash === passwordHash);

  if (found) {
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

  return { ok: false, error: 'Unrecognized Login ID. Please check your assigned institutional credentials.' };
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
