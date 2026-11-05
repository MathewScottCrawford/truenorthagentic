import { originOk, str, overLimit } from '../_lib/guard.js';

const EVENTS = [
  'page_view',
  'download_click',
  'interest_form_submit',
  'get_in_touch_click',
  'contact_modal_open',
  'contact_form_submit',
];
const PAGES = ['home', 'consulting', 'portage-practice'];
const BOT_RE = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python|node-fetch|go-http/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!originOk(request)) {
      return new Response(null, { status: 403 });
    }
    const ua = request.headers.get('User-Agent') || '';
    if (!ua || BOT_RE.test(ua)) {
      return new Response(null, { status: 204 });
    }
    const raw = await request.text();
    if (raw.length > 1000) {
      return new Response(null, { status: 413 });
    }
    let body;
    try { body = JSON.parse(raw); } catch (e) {
      return new Response(null, { status: 400 });
    }
    const name = str(body.name);
    if (!EVENTS.includes(name)) {
      return new Response(null, { status: 400 });
    }
    let page = str(body.page).toLowerCase();
    if (page && !PAGES.includes(page)) page = '';
    const label = str(body.label).slice(0, 50) || null;

    if (await overLimit(env, 'events', 10, 500)) {
      return new Response(null, { status: 204 });
    }

    await env.DB.prepare(
      'INSERT INTO events (name, page, label, created_at) VALUES (?, ?, ?, ?)'
    ).bind(name, page || null, label, new Date().toISOString()).run();

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('hit error:', err);
    return new Response(null, { status: 204 });
  }
}
