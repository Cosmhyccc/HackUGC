import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Use service role for webhook — bypasses RLS
const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.CheckoutSession;
    const userId = session.client_reference_id;
    if (userId) {
      await supabaseAdmin
        .from("profiles")
        .upsert({
          id: userId,
          subscribed: true,
          plan: session.amount_total === 9900 ? "yearly" : "monthly",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          subscribed_at: new Date().toISOString(),
        });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", sub.id)
      .single();
    if (data) {
      await supabaseAdmin
        .from("profiles")
        .update({ subscribed: false, plan: null })
        .eq("id", data.id);
    }
  }

  return NextResponse.json({ ok: true });
}
