interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/proof') return new Response('not found', { status: 404 });
    const key = 'listing-a/1.txt';
    await env.IMAGES.put(key, 'image-proof');
    const object = await env.IMAGES.get(key);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('session-proof'));
    const digestHex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const row = await env.DB.prepare('SELECT ?1 AS owner_id, ?2 AS object_key').bind('owner-a', key).first();
    await env.IMAGES.delete(key);
    return Response.json({
      r2: { key: object?.key, body: await object?.text(), deleted: !(await env.IMAGES.head(key)) },
      d1: row,
      webCryptoSha256: digestHex,
    });
  },
};
