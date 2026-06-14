export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    await env.DB.prepare(
      'INSERT INTO interest (name, email, interests, something_else, urgency, failure_mode, alpha_test, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      body.name || null,
      body.email || null,
      JSON.stringify(body.interests || []),
      body.something_else || null,
      body.urgency || null,
      body.failure_mode || null,
      body.alpha_test ? 1 : 0,
      new Date().toISOString()
    ).run();
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
