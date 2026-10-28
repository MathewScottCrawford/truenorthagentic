const FILES = {
  skill: {
    url: 'https://pub-6de04b5453da4f95b43d5dc40a2e8047.r2.dev/AI_Portage_Skill.md',
    type: 'text/markdown; charset=utf-8',
    filename: 'AI_Portage_Skill.md',
  },
  guide: {
    url: 'https://pub-6de04b5453da4f95b43d5dc40a2e8047.r2.dev/AI_Portage_Field_Guide.pdf',
    type: 'application/pdf',
    filename: 'AI_Portage_Field_Guide.pdf',
  },
};

export async function onRequestGet(context) {
  const entry = FILES[context.params.name];
  if (!entry) {
    return new Response('Not found', { status: 404 });
  }
  const upstream = await fetch(entry.url);
  if (!upstream.ok) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': entry.type,
      'Content-Disposition': 'attachment; filename="' + entry.filename + '"',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
