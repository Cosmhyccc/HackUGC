import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ user: null, isSubscribed: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscribed")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    isSubscribed: profile?.subscribed ?? false,
  });
}
