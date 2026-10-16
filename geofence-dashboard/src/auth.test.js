import auth, { normalizeEmail, DEDICATED_ACCOUNTS } from './auth';

describe('CareTag Dedicated Authentication Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('normalizes various input formats for Singla_BE23@thapar.edu', () => {
    expect(normalizeEmail('Singla_BE23@thapar.edu')).toBe('singla_be23@thapar.edu');
    expect(normalizeEmail('Singla_BE 23 at the rate Thapar.EDU')).toBe('singla_be23@thapar.edu');
    expect(normalizeEmail('  singla_be 23@thapar.edu  ')).toBe('singla_be23@thapar.edu');
    expect(normalizeEmail('SINGLA_BE23@THAPAR.EDU')).toBe('singla_be23@thapar.edu');
  });

  test('successfully logs in primary user Singla_BE23@thapar.edu with password 12345', async () => {
    const result = await auth.login('Singla_BE23@thapar.edu', '12345');
    expect(result.ok).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('singla_be23@thapar.edu');
    expect(result.user.name).toBe('Bhavishya Singla');
    expect(result.user.role).toBe('admin');
    expect(result.user.deviceKey).toBe('CARE-TAG-01');

    const session = auth.getSession();
    expect(session).not.toBeNull();
    expect(session.email).toBe('singla_be23@thapar.edu');
  });

  test('logs in using speech-to-text format: Singla_BE 23 at the rate Thapar.EDU', async () => {
    const result = await auth.login('Singla_BE 23 at the rate Thapar.EDU', '12345');
    expect(result.ok).toBe(true);
    expect(result.user.email).toBe('singla_be23@thapar.edu');
  });

  test('rejects incorrect password for dedicated user', async () => {
    const result = await auth.login('Singla_BE23@thapar.edu', 'wrong_password');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/incorrect password/i);
  });

  test('authenticates all five dedicated institutional accounts with password 12345', async () => {
    expect(DEDICATED_ACCOUNTS.length).toBe(5);

    for (const acc of DEDICATED_ACCOUNTS) {
      const res = await auth.login(acc.displayEmail, '12345');
      expect(res.ok).toBe(true);
      expect(res.user.email).toBe(acc.email);
    }
  });

  test('rejects unrecognized user', async () => {
    const result = await auth.login('nonexistent.user@random.com', '12345');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unrecognized/i);
  });

  test('logout clears session correctly', async () => {
    await auth.login('Singla_BE23@thapar.edu', '12345');
    expect(auth.getSession()).not.toBeNull();
    auth.logout();
    expect(auth.getSession()).toBeNull();
  });
});
