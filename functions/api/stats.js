function jsonHeaders(extra) {
  return Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization',
    'Cache-Control': 'no-store',
  }, extra || {});
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    diff |= (x[i] || 0) ^ (y[i] || 0);
  }
  return diff === 0;
}

function maskEmail(email) {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return email[0] + '***' + email.slice(at);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders() });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const headers = jsonHeaders();

  // Fail closed if the secret is not configured
  if (!env.STATS_TOKEN) {
    return Response.json({ error: 'Not configured' }, { status: 503, headers });
  }

  const auth = request.headers.get('Authorization') || '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!supplied || !safeEqual(supplied, env.STATS_TOKEN)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  try {
    let where = '';
    const params = [];
    if (from && to) {
      where = 'WHERE created_at >= ? AND created_at <= ?';
      params.push(from, to);
    } else if (from) {
      where = 'WHERE created_at >= ?';
      params.push(from);
    } else if (to) {
      where = 'WHERE created_at <= ?';
      params.push(to);
    }

    const downloads = await env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(opt_in) as opted_in, SUM(CASE WHEN email IS NULL THEN 1 ELSE 0 END) as anonymous FROM downloads ${where}`
    ).bind(...params).first();

    const interest = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM interest ${where}`
    ).bind(...params).first();

    const contact = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM contact ${where}`
    ).bind(...params).first();

    const recent = await env.DB.prepare(
      `SELECT email, opt_in, created_at FROM downloads ${where} ORDER BY created_at DESC LIMIT 5`
    ).bind(...params).all();

    return Response.json({
      downloads: {
        total: downloads.total || 0,
        opted_in: downloads.opted_in || 0,
        anonymous: downloads.anonymous || 0
      },
      interest: { total: interest.total || 0 },
      contact: { total: contact.total || 0 },
      recent_downloads: (recent.results || []).map(r => ({
        email: maskEmail(r.email),
        opt_in: r.opt_in,
        created_at: r.created_at
      })),
      period: { from: from || null, to: to || null }
    }, { headers });
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500, headers });
  }
}
