import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRICES = {
  monthly: {
    unit_amount: 5900, // $59
    recurring: { interval: "month" as const },
  },
  yearly: {
    unit_amount: 9900, // $99
    recurring: { interval: "year" as const },
  },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { plan } = await req.json(); // 'monthly' | 'yearly'
    const price = PRICES[plan as keyof typeof PRICES] ?? PRICES.monthly;

    const origin = req.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: { name: "HackUGC Pro", description: "Full access to TikTok UGC intelligence" },
            ...price,
          },
        },
      ],
      success_url: `${origin}/explore?subscribed=true`,
      cancel_url: `${origin}/explore`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
