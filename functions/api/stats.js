export async function onRequestGet(context) {
  const { env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
  };
  try {
    const downloads = await env.DB.prepare(
      'SELECT COUNT(*) as total, SUM(opt_in) as opted_in FROM downloads'
    ).first();

    const interest = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM interest'
    ).first();

    const recent = await env.DB.prepare(
      'SELECT email, opt_in, created_at FROM downloads ORDER BY created_at DESC LIMIT 5'
    ).all();

    return Response.json({
      downloads: {
        total: downloads.total || 0,
        opted_in: downloads.opted_in || 0
      },
      interest: {
        total: interest.total || 0
      },
      recent_downloads: recent.results || []
    }, { headers });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}
