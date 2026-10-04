import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("services")
      .select(
        "id, code, name, price_usd, duration_minutes, active"
      )
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error("Supabase test error:", error);

      return NextResponse.json(
        {
          ok: false,
          message: "No fue posible consultar Supabase.",
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      project: "WAESTUDIO",
      database: "connected",
      services: data,
    });
  } catch (error) {
    console.error("Supabase connection error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Error de conexión con Supabase.",
      },
      {
        status: 500,
      }
    );
  }
}