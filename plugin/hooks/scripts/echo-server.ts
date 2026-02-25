const port = Number(Bun.argv[2]) || 3333;

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(`\n--- ${req.method} ${url.pathname}${url.search} ---`);
    console.log("Headers:", Object.fromEntries(req.headers.entries()));

    if (req.method === "POST") {
      const body = await req.json();
      console.log("Body:", JSON.stringify(body, null, 2));
      return Response.json(body);
    }

    return new Response("ok");
  },
});

console.log(`Echo server listening on http://localhost:${server.port}`);
