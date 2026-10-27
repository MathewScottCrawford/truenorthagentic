import { originOk, str, overLimit } from '../_lib/guard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!originOk(request)) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const raw = await request.text();
    if (raw.length > 5000) {
      return Response.json({ success: false, error: 'Request too large.' }, { status: 413 });
    }
    let body;
    try { body = JSON.parse(raw); } catch (e) {
      return Response.json({ success: false, error: 'Invalid request.' }, { status: 400 });
    }

    const email = str(body.email);
    const opt_in = body.opt_in ? 1 : 0;
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
      return Response.json({ success: false, error: 'Invalid email' }, { status: 400 });
    }

    // Circuit breaker: if flooded, skip storing but never block a visitor from the guide.
    if (await overLimit(env, 'downloads', 10, 100)) {
      return Response.json({ success: true });
    }

    await env.DB.prepare(
      'INSERT INTO downloads (email, opt_in, created_at) VALUES (?, ?, ?)'
    ).bind(email || null, opt_in, new Date().toISOString()).run();

    return Response.json({ success: true });
  } catch (err) {
    console.error('download error:', err);
    return Response.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}
