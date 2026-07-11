export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
  };
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const message = (body.message || '').trim();

    if (!name || !email || !message) {
      return Response.json({ success: false, error: 'All fields are required.' }, { status: 400, headers });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ success: false, error: 'Invalid email address.' }, { status: 400, headers });
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
        subject: 'New contact inquiry from ' + name,
        text: 'Name: ' + name + '\nEmail: ' + email + '\n\nMessage:\n' + message,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
    }

    return Response.json({ success: true }, { headers });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500, headers });
  }
}
