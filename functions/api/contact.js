import { originOk, str, overLimit, verifyTurnstile } from '../_lib/guard.js';

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

    // Honeypot: real users never fill this hidden field. Pretend success, store nothing.
    if (str(body.website)) return Response.json({ success: true });

    const name = str(body.name);
    const email = str(body.email);
    const message = str(body.message);

    if (!name || !email || !message) {
      return Response.json({ success: false, error: 'All fields are required.' }, { status: 400 });
    }
    if (name.length > 100 || email.length > 254 || message.length > 5000) {
      return Response.json({ success: false, error: 'One of the fields is too long.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ success: false, error: 'Invalid email address.' }, { status: 400 });
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ts = await verifyTurnstile(env, str(body.turnstile_token), ip);
    if (!ts.ok) {
      if (ts.reason === 'not_configured') {
        return Response.json({ success: false, error: 'Contact form is temporarily unavailable.' }, { status: 503 });
      }
      return Response.json({ success: false, error: 'Verification failed. Please try again.' }, { status: 400 });
    }

    if (await overLimit(env, 'contact', 10, 10)) {
      return Response.json({ success: false, error: 'Too many messages right now. Please try again later.' }, { status: 429 });
    }

    await env.DB.prepare(
      'INSERT INTO contact (name, email, message, created_at) VALUES (?, ?, ?, ?)'
    ).bind(name, email, message, new Date().toISOString()).run();

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'True North Automation <hello@truenorthagentic.com>',
        to: ['mathew.s.crawford@gmail.com'],
        reply_to: email,
        subject: 'New contact inquiry from ' + name.replace(/[\r\n]+/g, ' '),
        text: 'Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message,
      }),
    });
    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text());
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('contact error:', err);
    return Response.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 });
  }
}
