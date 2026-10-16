/**
 * CareTag Authentication Service
 * 
 * Manages user registration, login, and session persistence
 * using localStorage. Each user gets a unique UUID that isolates
 * all their data (geofences, alerts, battery, progress).
 * 
 * Passwords are hashed with SHA-256 in the browser.
 * Sessions persist across page reloads until explicit logout.
 */

// ── Crypto helper ──
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ── Storage keys ──
const USERS_KEY = 'caretag.users';
const SESSION_KEY = 'caretag.session';

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ── Public API ──

/**
 * Register a new user.
 * @returns {{ ok: boolean, error?: string, user?: object }}
 */
export async function register(name, email, password) {
  if (!name?.trim()) return { ok: false, error: 'Name is required' };
  if (!email?.trim()) return { ok: false, error: 'Email is required' };
  if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };

  const users = loadUsers();
  const normalizedEmail = email.trim().toLowerCase();

  if (users.some(u => u.email === normalizedEmail)) {
    return { ok: false, error: 'An account with this email already exists' };
  }

  const passwordHash = await hashPassword(password);
  const user = {
    id: generateId(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  // Auto-login after registration
  const session = { userId: user.id, name: user.name, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { ok: true, user: session };
}

/**
 * Login with email and password.
 * @returns {{ ok: boolean, error?: string, user?: object }}
 */
export async function login(email, password) {
  if (!email?.trim()) return { ok: false, error: 'Email is required' };
  if (!password) return { ok: false, error: 'Password is required' };

  const users = loadUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const user = users.find(u => u.email === normalizedEmail && u.passwordHash === passwordHash);
  if (!user) {
    return { ok: false, error: 'Invalid email or password' };
  }

  const session = { userId: user.id, name: user.name, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return { ok: true, user: session };
}

/**
 * Get current session (or null if not logged in).
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
 * Logout — clear session (but keep user accounts).
 */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Get a user-scoped localStorage key.
 * All data operations should use this to isolate data per user.
 */
export function userKey(userId, suffix) {
  return `caretag.${userId}.${suffix}`;
}

const auth = { register, login, getSession, logout, userKey };
export default auth;
