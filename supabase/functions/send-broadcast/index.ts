import { SignJWT, importPKCS8 } from "npm:jose@6.0.10";

type FirebaseCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-broadcast-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parseServiceAccount(value: string): FirebaseCredentials | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.project_id !== "string" ||
      typeof parsed.client_email !== "string" ||
      typeof parsed.private_key !== "string"
    ) {
      return null;
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch (_) {
    return null;
  }
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function normalisePrivateKey(value: string): string {
  let privateKey = value.trim();
  try {
    const decoded = JSON.parse(privateKey);
    if (typeof decoded === "string") privateKey = decoded;
  } catch (_) {
    // The value is already a raw key.
  }

  privateKey = privateKey
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .trim();

  if (
    !privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.endsWith("-----END PRIVATE KEY-----")
  ) {
    throw new HttpError(
      500,
      "Firebase private key is invalid. Set FIREBASE_SERVICE_ACCOUNT_JSON to the complete service-account JSON, or set FIREBASE_PRIVATE_KEY to only the PEM private_key value.",
    );
  }

  return `${privateKey}\n`;
}

function getFirebaseCredentials(): FirebaseCredentials {
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  const serviceAccountBase64 = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_BASE64");
  const serviceAccount = serviceAccountJson
    ? parseServiceAccount(serviceAccountJson)
    : serviceAccountBase64
    ? parseServiceAccount(decodeBase64(serviceAccountBase64))
    : null;

  const legacyPrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
  const legacyServiceAccount = legacyPrivateKey
    ? parseServiceAccount(legacyPrivateKey)
    : null;
  const credentials = serviceAccount ?? legacyServiceAccount;

  const projectId = credentials?.projectId ?? Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail =
    credentials?.clientEmail ?? Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = credentials?.privateKey ?? legacyPrivateKey;

  if (!projectId || !clientEmail || !privateKey) {
    throw new HttpError(
      500,
      "Firebase credentials are not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON or the three FIREBASE credential secrets.",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalisePrivateKey(privateKey),
  };
}

async function requireBroadcastAdmin(req: Request): Promise<void> {
  const configuredSecret = Deno.env.get("BROADCAST_ADMIN_SECRET");
  const suppliedSecret = req.headers.get("x-broadcast-secret");
  if (configuredSecret && suppliedSecret === configuredSecret) return;

  const allowedUserIds = (Deno.env.get("BROADCAST_ADMIN_USER_IDS") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const authorization = req.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();

  if (!token || allowedUserIds.length === 0) {
    throw new HttpError(
      403,
      "Broadcast access is not configured. Set BROADCAST_ADMIN_SECRET or BROADCAST_ADMIN_USER_IDS.",
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new HttpError(500, "Supabase runtime credentials are unavailable.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const user = response.ok
    ? (await response.json()) as { id?: string }
    : null;
  if (!user?.id || !allowedUserIds.includes(user.id)) {
    throw new HttpError(403, "You are not allowed to send broadcasts.");
  }
}

async function getFirebaseAccessToken(
  credentials: FirebaseCredentials,
): Promise<string> {
  const cryptoKey = await importPKCS8(credentials.privateKey, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(credentials.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(cryptoKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await response.json();

  if (!response.ok || typeof data.access_token !== "string") {
    console.error("Google OAuth error:", data);
    throw new HttpError(502, "Unable to obtain a Firebase access token.");
  }
  return data.access_token;
}

Deno.serve(async (req) => {
  // Handle CORS preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Only POST requests are allowed.");
    }

    await requireBroadcastAdmin(req);
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!title || !message) {
      throw new HttpError(400, "title and message are required.");
    }

    const credentials = getFirebaseCredentials();
    const accessToken = await getFirebaseAccessToken(credentials);
    const fcmUrl =
      `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`;
    const response = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          topic: "all_users",
          notification: { title, body: message },
          data: { type: "broadcast" },
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("FCM error:", result);
      throw new HttpError(502, "Firebase rejected the broadcast request.");
    }

    console.log("FCM broadcast sent:", result.name);
    return Response.json(
      { success: true, message: "Notification sent successfully" },
      { headers: corsHeaders }
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error("Function error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: error instanceof Error ? error.message : String(error),
      },
      {
        status,
        headers: corsHeaders,
      },
    );
  }
});
