import { NextResponse } from "next/server";

const ADMIN_HEADER = "x-soltrac-admin-key";

export function requireWebhookAdmin(
  request: Request
): NextResponse | null {
  const configuredKey = process.env.WEBHOOK_ADMIN_KEY;
  if (!configuredKey) {
    return null;
  }

  const providedKey = request.headers.get(ADMIN_HEADER);
  if (providedKey === configuredKey) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized",
    },
    { status: 401 }
  );
}

export function webhookAdminHeader(adminKey: string): HeadersInit {
  if (!adminKey.trim()) {
    return {};
  }

  return {
    [ADMIN_HEADER]: adminKey,
  };
}
