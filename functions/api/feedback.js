export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  // POST — submit feedback (no auth required)
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const text = (body.text || "").trim();
      if (!text || text.length > 2000) {
        return new Response(JSON.stringify({ error: "反馈内容不能为空且不超过2000字" }), { status: 400, headers });
      }
      await env.DB.prepare("INSERT INTO feedback (text) VALUES (?)").bind(text).run();
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: "提交失败" }), { status: 500, headers });
    }
  }

  // Check admin password (from D1 settings table)
  const password = url.searchParams.get("password");
  const { results: pwdResult } = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'admin_password'"
  ).all();
  const adminPassword = pwdResult[0]?.value;
  if (!adminPassword || password !== adminPassword) {
    return new Response(JSON.stringify({ error: "密码错误" }), { status: 401, headers });
  }

  // GET — list feedback
  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, text, created_at, is_read FROM feedback ORDER BY created_at DESC"
    ).all();
    return new Response(JSON.stringify(results), { status: 200, headers });
  }

  // DELETE — remove feedback
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "缺少 id" }), { status: 400, headers });
    }
    await env.DB.prepare("DELETE FROM feedback WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
