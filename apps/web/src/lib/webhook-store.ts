import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WebhookEvent, WebhookSubscription } from "@/lib/types";

interface CreateWebhookInput {
  walletAddress: string;
  webhookUrl: string;
  events: WebhookEvent[];
}

interface PersistedStore {
  subscriptions: WebhookSubscription[];
  seenSignatures: Record<string, string[]>;
}

const subscriptions: WebhookSubscription[] = [];
const seenSignatures = new Map<string, Set<string>>();
const PERSISTENCE_ENABLED = process.env.NODE_ENV !== "test";
const STORE_FILE =
  process.env.WEBHOOK_STORE_FILE ||
  path.join(process.cwd(), ".data", "webhooks.json");

function saveToDisk(): void {
  if (!PERSISTENCE_ENABLED) {
    return;
  }

  const serialized: PersistedStore = {
    subscriptions,
    seenSignatures: Object.fromEntries(
      Array.from(seenSignatures.entries()).map(([id, signatures]) => [
        id,
        Array.from(signatures),
      ])
    ),
  };

  const dir = path.dirname(STORE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(STORE_FILE, JSON.stringify(serialized, null, 2), "utf8");
}

function loadFromDisk(): void {
  if (!PERSISTENCE_ENABLED || !existsSync(STORE_FILE)) {
    return;
  }

  try {
    const raw = readFileSync(STORE_FILE, "utf8");
    if (!raw.trim()) {
      return;
    }

    const parsed = JSON.parse(raw) as PersistedStore;
    subscriptions.length = 0;
    subscriptions.push(...(parsed.subscriptions ?? []));

    seenSignatures.clear();
    for (const [id, signatures] of Object.entries(parsed.seenSignatures ?? {})) {
      seenSignatures.set(id, new Set(signatures));
    }
  } catch (error) {
    console.error("Failed to load webhook store from disk:", error);
  }
}

function normalizeEvents(events: WebhookEvent[]): WebhookEvent[] {
  return Array.from(new Set(events)).sort();
}

function getSubscriptionKey(input: CreateWebhookInput): string {
  return `${input.walletAddress}|${input.webhookUrl}|${normalizeEvents(input.events).join(",")}`;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function listWebhookSubscriptions(): WebhookSubscription[] {
  return [...subscriptions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getWebhookSubscriptionById(id: string): WebhookSubscription | undefined {
  return subscriptions.find((subscription) => subscription.id === id);
}

export function listWebhookSubscriptionsByWallet(walletAddress: string): WebhookSubscription[] {
  return listWebhookSubscriptions().filter(
    (subscription) => subscription.walletAddress === walletAddress
  );
}

export function createWebhookSubscription(input: CreateWebhookInput): WebhookSubscription {
  const normalizedInput: CreateWebhookInput = {
    walletAddress: input.walletAddress,
    webhookUrl: input.webhookUrl,
    events: normalizeEvents(input.events),
  };

  const existing = subscriptions.find(
    (subscription) =>
      getSubscriptionKey(subscription) === getSubscriptionKey(normalizedInput)
  );

  if (existing) {
    return existing;
  }

  const subscription: WebhookSubscription = {
    id: generateId(),
    walletAddress: normalizedInput.walletAddress,
    webhookUrl: normalizedInput.webhookUrl,
    events: normalizedInput.events,
    createdAt: new Date().toISOString(),
  };

  subscriptions.push(subscription);
  saveToDisk();
  return subscription;
}

export function deleteWebhookSubscription(id: string): boolean {
  const index = subscriptions.findIndex((subscription) => subscription.id === id);
  if (index === -1) {
    return false;
  }

  subscriptions.splice(index, 1);
  seenSignatures.delete(id);
  saveToDisk();
  return true;
}

export function updateWebhookLastChecked(id: string, timestamp: string): void {
  const subscription = getWebhookSubscriptionById(id);
  if (!subscription) {
    return;
  }

  subscription.lastChecked = timestamp;
  saveToDisk();
}

export function hasSeenSignature(subscriptionId: string, signature: string): boolean {
  const signatures = seenSignatures.get(subscriptionId);
  return signatures?.has(signature) ?? false;
}

export function markSignatureAsSeen(subscriptionId: string, signature: string): void {
  const signatures = seenSignatures.get(subscriptionId) ?? new Set<string>();
  signatures.add(signature);
  seenSignatures.set(subscriptionId, signatures);
  saveToDisk();
}

export function __resetWebhookStore(): void {
  subscriptions.length = 0;
  seenSignatures.clear();
  saveToDisk();
}

loadFromDisk();
