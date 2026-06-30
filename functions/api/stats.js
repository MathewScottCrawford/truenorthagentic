export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
  };

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

    const recent = await env.DB.prepare(
      `SELECT email, opt_in, created_at FROM downloads ${where} ORDER BY created_at DESC LIMIT 5`
    ).bind(...params).all();

    return Response.json({
      downloads: {
        total: downloads.total || 0,
        opted_in: downloads.opted_in || 0,
        anonymous: downloads.anonymous || 0
      },
      interest: {
        total: interest.total || 0
      },
      recent_downloads: recent.results || [],
      period: { from: from || null, to: to || null }
    }, { headers });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}
