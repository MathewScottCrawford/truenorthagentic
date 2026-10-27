const ALLOWED_ORIGINS = [
  'https://truenorthagentic.com',
  'https://www.truenorthagentic.com',
  'https://truenorthagentic.pages.dev',
];

export function originOk(request) {
  const origin = request.headers.get('Origin');
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

export function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Global circuit breaker: true if the table already has >= max rows in the last N minutes.
export async function overLimit(env, table, minutes, max) {
  if (!['downloads', 'interest', 'contact'].includes(table)) return false;
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ${table} WHERE created_at >= ?`
  ).bind(since).first();
  return ((row && row.n) || 0) >= max;
}

export async function verifyTurnstile(env, token, ip) {
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (!token) return { ok: false, reason: 'missing' };
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.success) {
    console.error('turnstile siteverify failed:', JSON.stringify(data['error-codes'] || []),
      'secret length:', secret.length, 'raw length:', String(env.TURNSTILE_SECRET_KEY || '').length);
  }
  return { ok: !!data.success, reason: data.success ? null : 'failed' };
}
