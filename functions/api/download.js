export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const email = (body.email || '').trim();
    const opt_in = body.opt_in ? 1 : 0;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return Response.json({ success: false, error: 'Invalid email' }, { status: 400 });
      }
      await env.DB.prepare(
        'INSERT INTO downloads (email, opt_in, created_at) VALUES (?, ?, ?)'
      ).bind(email, opt_in, new Date().toISOString()).run();
    }
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
