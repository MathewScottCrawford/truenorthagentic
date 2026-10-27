import { originOk, str, overLimit } from '../_lib/guard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!originOk(request)) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const raw = await request.text();
    if (raw.length > 20000) {
      return Response.json({ success: false, error: 'Request too large.' }, { status: 413 });
    }
    let body;
    try { body = JSON.parse(raw); } catch (e) {
      return Response.json({ success: false, error: 'Invalid request.' }, { status: 400 });
    }

    const name = str(body.name);
    const email = str(body.email);
    const something_else = str(body.something_else);
    const urgency = str(body.urgency);
    const failure_mode = str(body.failure_mode);
    const interests = Array.isArray(body.interests)
      ? body.interests.slice(0, 20).map(i => str(i).slice(0, 100))
      : [];

    if (name.length > 100 || something_else.length > 2000 || urgency.length > 200 || failure_mode.length > 1000) {
      return Response.json({ success: false, error: 'One of the fields is too long.' }, { status: 400 });
    }
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
      return Response.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
    }

    if (await overLimit(env, 'interest', 10, 20)) {
      return Response.json({ success: false, error: 'Too many submissions right now. Please try again later.' }, { status: 429 });
    }

    await env.DB.prepare(
      'INSERT INTO interest (name, email, interests, something_else, urgency, failure_mode, alpha_test, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      name || null,
      email || null,
      JSON.stringify(interests),
      something_else || null,
      urgency || null,
      failure_mode || null,
      body.alpha_test ? 1 : 0,
      new Date().toISOString()
    ).run();

    return Response.json({ success: true });
  } catch (err) {
    console.error('interest error:', err);
    return Response.json({ success: false, error: 'Server error.' }, { status: 500 });
  }
}
