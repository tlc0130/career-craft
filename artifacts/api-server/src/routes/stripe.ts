import { Router } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient, getStripeWebhookSecret } from "../stripeClient";
import { requireAuth } from "../middlewares/auth";
import type Stripe from "stripe";

const router = Router();

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

    if (plan === "pro" && user.plan === "pro") {
      res.status(400).json({ error: "You already have a Pro subscription" });
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

    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
    const baseUrl = domain ? `https://${domain}` : "http://localhost:80";

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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);

      if (user) {
        if (session.mode === "payment") {
          await db
            .update(users)
            .set({ plan: "lifetime", lifetimeAccess: true })
            .where(eq(users.id, user.id));
        } else if (session.mode === "subscription") {
          await db
            .update(users)
            .set({
              plan: "pro",
              stripeSubscriptionId: session.subscription as string,
            })
            .where(eq(users.id, user.id));
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);

      if (user && !user.lifetimeAccess) {
        if (sub.status === "active") {
          await db
            .update(users)
            .set({ plan: "pro", stripeSubscriptionId: sub.id })
            .where(eq(users.id, user.id));
        } else if (["canceled", "unpaid", "past_due"].includes(sub.status)) {
          await db
            .update(users)
            .set({ plan: "starter", stripeSubscriptionId: null })
            .where(eq(users.id, user.id));
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);

      if (user && !user.lifetimeAccess) {
        await db
          .update(users)
          .set({ plan: "starter", stripeSubscriptionId: null })
          .where(eq(users.id, user.id));
      }
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
    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
    const baseUrl = domain ? `https://${domain}` : "http://localhost:80";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: baseUrl,
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

export default router;
