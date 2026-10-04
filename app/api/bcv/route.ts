import { NextResponse } from "next/server";

type BcvTodayResponse = {
  USD?: number;
  date?: string;
  effective_date?: string;
  updated_at?: string;
};

export async function GET() {
  try {
    const response = await fetch(
      "https://bcv.today/api/v1/rate.json",
      {
        next: {
          revalidate: 900,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `BCV provider responded with status ${response.status}`
      );
    }

    const data: BcvTodayResponse = await response.json();

    if (
      typeof data.USD !== "number" ||
      !Number.isFinite(data.USD) ||
      data.USD <= 0
    ) {
      throw new Error("Invalid USD rate received");
    }

    return NextResponse.json(
      {
        ok: true,
        rate: data.USD,
        date:
          data.effective_date ??
          data.date ??
          null,
        updatedAt:
          data.updated_at ??
          null,
        source: "BCV",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=900, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("BCV rate error:", error);

    return NextResponse.json(
      {
        ok: false,
        rate: null,
        date: null,
        updatedAt: null,
        source: "BCV",
        message:
          "No fue posible obtener la tasa BCV en este momento.",
      },
      {
        status: 503,
      }
    );
  }
}