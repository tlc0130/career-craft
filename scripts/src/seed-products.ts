import { getUncachableStripeClient } from "./stripeClient";

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log("Checking for existing Career Craft products in Stripe...\n");

  // --- Pro Plan ($20/month subscription) ---
  const existingPro = await stripe.products.search({
    query: "name:'Career Craft Pro' AND active:'true'",
  });

  let proMonthlyPriceId: string;

  if (existingPro.data.length > 0) {
    const proProduct = existingPro.data[0];
    console.log(`Pro product already exists: ${proProduct.id}`);
    const prices = await stripe.prices.list({ product: proProduct.id, active: true });
    const monthly = prices.data.find((p) => p.recurring?.interval === "month");
    if (!monthly) throw new Error("Pro product exists but no monthly price found");
    proMonthlyPriceId = monthly.id;
    console.log(`Pro monthly price: ${proMonthlyPriceId}`);
  } else {
    const proProduct = await stripe.products.create({
      name: "Career Craft Pro",
      description: "Unlimited resume tailoring, cover letters, deep ATS keyword matching, and job tracker dashboard.",
      metadata: { plan: "pro" },
    });
    console.log(`Created Pro product: ${proProduct.id}`);

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 2000,
      currency: "usd",
      recurring: { interval: "month" },
    });
    proMonthlyPriceId = proPrice.id;
    console.log(`Created Pro monthly price ($20/month): ${proMonthlyPriceId}`);
  }

  // --- Lifetime Plan ($149.99 one-time payment) ---
  const existingLifetime = await stripe.products.search({
    query: "name:'Career Craft Lifetime' AND active:'true'",
  });

  let lifetimePriceId: string;

  if (existingLifetime.data.length > 0) {
    const lifetimeProduct = existingLifetime.data[0];
    console.log(`\nLifetime product already exists: ${lifetimeProduct.id}`);
    const prices = await stripe.prices.list({ product: lifetimeProduct.id, active: true });
    const oneTime = prices.data.find((p) => !p.recurring);
    if (!oneTime) throw new Error("Lifetime product exists but no one-time price found");
    lifetimePriceId = oneTime.id;
    console.log(`Lifetime price: ${lifetimePriceId}`);
  } else {
    const lifetimeProduct = await stripe.products.create({
      name: "Career Craft Lifetime",
      description: "All Pro features, no monthly fees, access to future updates. Pay once, use forever.",
      metadata: { plan: "lifetime" },
    });
    console.log(`\nCreated Lifetime product: ${lifetimeProduct.id}`);

    const lifetimePrice = await stripe.prices.create({
      product: lifetimeProduct.id,
      unit_amount: 14999,
      currency: "usd",
    });
    lifetimePriceId = lifetimePrice.id;
    console.log(`Created Lifetime price ($149.99): ${lifetimePriceId}`);
  }

  console.log("\n✅ Done! Add these to your environment variables:\n");
  console.log(`STRIPE_PRO_PRICE_ID=${proMonthlyPriceId}`);
  console.log(`STRIPE_LIFETIME_PRICE_ID=${lifetimePriceId}`);
  console.log("\nSet them via the Replit Secrets panel or your .env file.");
}

seedProducts().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
