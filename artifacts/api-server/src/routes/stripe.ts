import { Router } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient, getStripeWebhookSecret } from "../stripeClient";
import { requireAuth } from "../middlewares/auth";
import type Stripe from "stripe";

const router = Router();

/**
 * Public origin of the web app, used for Stripe redirect URLs. APP_URL is set
 * on the VPS deploy; REPLIT_DOMAINS is the legacy Replit fallback.
 */
function getAppBaseUrl(): string {
  const appUrl = process.env["APP_URL"];
  if (appUrl) return appUrl.replace(/\/+$/, "");
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:5173";
}

type User = typeof users.$inferSelect;
type PaidPlan = "pro" | "lifetime";

const ACTIVE_SUB_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(["active", "trialing"]);
const LAPSED_SUB_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "canceled",
  "unpaid",
  "past_due",
  "incomplete_expired",
]);

async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

async function findUserByCustomer(customerId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return user;
}

function customerIdOf(customer: string | { id: string } | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

router.post("/stripe/create-checkout", requireAuth, async (req, res) => {
  const { plan } = req.body as { plan: "pro" | "lifetime" };
  if (!plan || !["pro", "lifetime"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (user.lifetimeAccess) {
      res.status(400).json({ error: "You already have lifetime access" });
      return;
    }

    if (plan === "pro" && (user.plan === "pro" || user.stripeSubscriptionId)) {
      // A lapsed (past_due/unpaid) subscription is still live in Stripe; a new
      // checkout would bill twice. Payment is fixed from the billing portal.
      res.status(400).json({
        error: user.plan === "pro"
          ? "You already have a Pro subscription"
          : "Your subscription has a payment issue. Update your payment method from the billing portal.",
      });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const priceId =
      plan === "pro"
        ? process.env["STRIPE_PRO_PRICE_ID"]
        : process.env["STRIPE_LIFETIME_PRICE_ID"];

    if (!priceId) {
      res.status(500).json({ error: "Price not configured. Run the seed-products script first." });
      return;
    }

    const baseUrl = getAppBaseUrl();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: plan === "pro" ? "subscription" : "payment",
      // Server-set and covered by the webhook signature, so the webhook can
      // map the payment to the account even if the customer record changed.
      client_reference_id: user.id,
      metadata: { userId: user.id, plan },
      ...(plan === "pro" ? { subscription_data: { metadata: { userId: user.id } } } : {}),
      success_url: `${baseUrl}/?checkout=success&plan=${plan}`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe/webhook", async (req, res) => {
  let webhookSecret: string;
  try {
    webhookSecret = await getStripeWebhookSecret();
  } catch {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    const stripe = await getUncachableStripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    req.log.error({ err }, "Webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session, req.log);
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await handleSubscriptionChange(stripe, event.data.object as Stripe.Subscription, req.log);
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Webhook handler error");
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

router.get("/stripe/portal", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No billing account found" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: getAppBaseUrl(),
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    req.log.error({ err }, "Portal error");
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

router.get("/stripe/subscription", requireAuth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json({
      plan: user.plan,
      lifetimeAccess: user.lifetimeAccess,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });
  } catch (err) {
    req.log.error({ err }, "Subscription status error");
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

type Log = { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };

/**
 * Grant the purchased plan. Event delivery can be retried, replayed or out of
 * order, so every write here is idempotent and subscription grants are checked
 * against the subscription's live status rather than the (possibly stale) event.
 */
async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session, log: Log) {
  if (session.payment_status === "unpaid") {
    log.info({ sessionId: session.id }, "Checkout completed without payment; nothing granted");
    return;
  }

  const customerId = customerIdOf(session.customer);
  const metaUserId = session.metadata?.["userId"] ?? session.client_reference_id ?? null;
  let user = metaUserId ? await findUserById(metaUserId) : undefined;
  if (!user && customerId) user = await findUserByCustomer(customerId);
  if (!user) {
    log.warn({ sessionId: session.id, customerId }, "Paid checkout could not be matched to a user");
    return;
  }

  // Sessions created before metadata was added fall back to the session mode.
  const plan: PaidPlan | null =
    session.metadata?.["plan"] === "pro" || session.metadata?.["plan"] === "lifetime"
      ? (session.metadata["plan"] as PaidPlan)
      : session.mode === "payment"
        ? "lifetime"
        : session.mode === "subscription"
          ? "pro"
          : null;
  if (!plan) return;

  const customerUpdate = customerId && customerId !== user.stripeCustomerId ? { stripeCustomerId: customerId } : {};

  if (plan === "lifetime") {
    // A Pro subscriber who buys lifetime must stop being billed monthly.
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (err: any) {
        // Already canceled is fine; anything else should be retried by Stripe.
        if (err?.code !== "resource_missing") throw err;
      }
    }
    await db
      .update(users)
      .set({ plan: "lifetime", lifetimeAccess: true, stripeSubscriptionId: null, ...customerUpdate })
      .where(eq(users.id, user.id));
    return;
  }

  const subscriptionId = customerIdOf(session.subscription);
  if (!subscriptionId || user.lifetimeAccess) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (!ACTIVE_SUB_STATUSES.has(sub.status)) {
    log.info({ subscriptionId, status: sub.status }, "Subscription not active; Pro not granted");
    return;
  }
  await db
    .update(users)
    .set({ plan: "pro", stripeSubscriptionId: sub.id, ...customerUpdate })
    .where(eq(users.id, user.id));
}

async function handleSubscriptionChange(stripe: Stripe, eventSub: Stripe.Subscription, log: Log) {
  const customerId = customerIdOf(eventSub.customer);
  const metaUserId = eventSub.metadata?.["userId"];
  let user = metaUserId ? await findUserById(metaUserId) : undefined;
  if (!user && customerId) user = await findUserByCustomer(customerId);
  if (!user || user.lifetimeAccess) return;

  // Ignore events for a subscription other than the one on the account (e.g.
  // an older, replaced subscription being cleaned up).
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== eventSub.id) {
    log.info({ subscriptionId: eventSub.id }, "Event for a non-current subscription ignored");
    return;
  }

  // Events can arrive out of order; act on the subscription's current state.
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(eventSub.id);
  } catch (err: any) {
    if (err?.code !== "resource_missing") throw err;
    sub = { ...eventSub, status: "canceled" };
  }

  if (ACTIVE_SUB_STATUSES.has(sub.status)) {
    await db
      .update(users)
      .set({ plan: "pro", stripeSubscriptionId: sub.id })
      .where(eq(users.id, user.id));
  } else if (LAPSED_SUB_STATUSES.has(sub.status)) {
    // Keep the ID while Stripe may still collect (past_due/unpaid), so a later
    // recovery or a lifetime upgrade can still find and settle this subscription.
    const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
    await db
      .update(users)
      .set({ plan: "starter", ...(ended ? { stripeSubscriptionId: null } : { stripeSubscriptionId: sub.id }) })
      .where(eq(users.id, user.id));
  }
}

export default router;
