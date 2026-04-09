import { NextResponse } from "next/server";
import { requireWebhookAdmin } from "@/lib/webhook-auth";
import { deleteWebhookSubscription } from "@/lib/webhook-store";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireWebhookAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const deleted = deleteWebhookSubscription(id);

  if (!deleted) {
    return NextResponse.json(
      {
        success: false,
        error: "Webhook subscription not found.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
