import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const { data: allSessions } = await supabase
      .from("training_sessions")
      .select("id, session_date, overall_feel")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false });

    const sessions = allSessions || [];
    const sessionsThisWeek = sessions.filter((s) => s.session_date >= weekStartStr).length;
    const sessionsThisMonth = sessions.filter((s) => s.session_date >= monthStartStr).length;

    const datesSet = new Set(sessions.map((s) => s.session_date));
    let currentStreak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    for (;;) {
      const dStr = checkDate.toISOString().split("T")[0];
      if (datesSet.has(dStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const last7 = sessions.filter((s) => s.session_date >= weekStartStr);
    const last30 = sessions.filter((s) => s.session_date >= monthStartStr);
    const avgFeel7 =
      last7.length > 0
        ? Math.round((last7.reduce((a, s) => a + s.overall_feel, 0) / last7.length) * 10) / 10
        : null;
    const avgFeel30 =
      last30.length > 0
        ? Math.round((last30.reduce((a, s) => a + s.overall_feel, 0) / last30.length) * 10) / 10
        : null;

    const { data: recentSessions } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      currentStreak,
      sessionsThisWeek,
      sessionsThisMonth,
      avgFeel7,
      avgFeel30,
      recentSessions: recentSessions || [],
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
