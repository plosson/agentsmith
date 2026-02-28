import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { createApiKey, deleteApiKey, listByUser } from "../db/api-keys";
import { config } from "../lib/config";
import { NotFoundError, ValidationError } from "../lib/errors";
import { signSessionToken, verifyGoogleToken } from "../lib/jwt";

/**
 * Public auth routes (no middleware required).
 * Mounted at the root level, outside /api/* auth middleware.
 */
export function authRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/auth/google", async (c) => {
    const body = await c.req.json();
    const credential = body.credential;
    if (!credential || typeof credential !== "string") {
      throw new ValidationError("Missing credential");
    }

    const google = await verifyGoogleToken(credential);
    const userId = `google|${google.sub}`;

    // Upsert user with Google info
    db.query(
      `INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name`,
    ).run(userId, google.email, google.name ?? null, Date.now());

    const token = await signSessionToken(userId, google.email);

    return c.json({
      token,
      user: {
        id: userId,
        email: google.email,
        name: google.name ?? null,
        picture: google.picture ?? null,
      },
    });
  });

  router.get("/setup", (c) => {
    const clientId = config.google.clientId;
    const html = setupPageHtml(clientId);
    return c.html(html);
  });

  return router;
}

/**
 * Protected API key management routes.
 * Mounted under /api/v1 (behind auth middleware).
 */
export function apiKeyRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/api-keys", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const name = body.name || "default";

    const result = await createApiKey(db, userId, name);
    return c.json(
      {
        id: result.id,
        key: result.rawKey,
        key_prefix: result.keyPrefix,
        name,
        created_at: result.createdAt,
      },
      201,
    );
  });

  router.get("/api-keys", (c) => {
    const userId = c.get("userId");
    const keys = listByUser(db, userId);
    return c.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        key_prefix: k.key_prefix,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
      })),
    });
  });

  router.delete("/api-keys/:keyId", (c) => {
    const userId = c.get("userId");
    const keyId = c.req.param("keyId");
    const deleted = deleteApiKey(db, keyId, userId);
    if (!deleted) {
      throw new NotFoundError("API key");
    }
    return c.json({ deleted: true });
  });

  return router;
}

function setupPageHtml(googleClientId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentSmith Setup</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full p-8">
    <!-- Step 1: Sign in -->
    <div id="step-login" class="text-center">
      <h1 class="text-2xl font-bold mb-2">AgentSmith Setup</h1>
      <p class="text-gray-400 mb-8">Sign in to generate your plugin API key.</p>
      <div id="g_id_onload"
           data-client_id="${googleClientId}"
           data-callback="handleGoogleCredential"
           data-auto_prompt="false">
      </div>
      <div class="g_id_signin"
           data-type="standard"
           data-size="large"
           data-theme="filled_black"
           data-text="sign_in_with"
           data-shape="rectangular"
           data-logo_alignment="left">
      </div>
    </div>

    <!-- Step 2: Show API key -->
    <div id="step-key" class="hidden text-center">
      <h1 class="text-2xl font-bold mb-2">Your API Key</h1>
      <p class="text-gray-400 mb-6">Add this line to <code class="bg-gray-800 px-1.5 py-0.5 rounded text-sm">~/.config/agentsmith/config</code></p>
      <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
        <code id="key-display" class="text-green-400 text-sm break-all select-all"></code>
      </div>
      <button id="copy-btn" onclick="copyKey()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
        Copy to clipboard
      </button>
      <p id="copy-feedback" class="text-green-400 text-sm mt-2 hidden">Copied!</p>
    </div>

    <!-- Error state -->
    <div id="step-error" class="hidden text-center">
      <h1 class="text-2xl font-bold mb-2 text-red-400">Something went wrong</h1>
      <p id="error-message" class="text-gray-400 mb-6"></p>
      <button onclick="location.reload()" class="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
        Try again
      </button>
    </div>
  </div>

  <script>
    let apiKey = '';

    async function handleGoogleCredential(response) {
      try {
        // Exchange Google credential for session token
        const authRes = await fetch('/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        if (!authRes.ok) throw new Error('Authentication failed');
        const { token } = await authRes.json();

        // Generate API key
        const keyRes = await fetch('/api/v1/api-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ name: 'plugin' }),
        });
        if (!keyRes.ok) throw new Error('Failed to generate API key');
        const { key } = await keyRes.json();

        apiKey = key;
        document.getElementById('key-display').textContent = 'AGENTSMITH_KEY=' + key;
        document.getElementById('step-login').classList.add('hidden');
        document.getElementById('step-key').classList.remove('hidden');
      } catch (err) {
        document.getElementById('error-message').textContent = err.message;
        document.getElementById('step-login').classList.add('hidden');
        document.getElementById('step-error').classList.remove('hidden');
      }
    }

    function copyKey() {
      navigator.clipboard.writeText('AGENTSMITH_KEY=' + apiKey).then(() => {
        document.getElementById('copy-feedback').classList.remove('hidden');
        setTimeout(() => document.getElementById('copy-feedback').classList.add('hidden'), 2000);
      });
    }
  </script>
</body>
</html>`;
}
