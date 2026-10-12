
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RateResult = {
  rate: number;
  date: string;
  updatedAt: string | null;
  provider: string;
};

type DolarVzlaResponse = {
  current?: {
    usd?: number;
    date?: string;
  };
};

type BcvTodayResponse = {
  USD?: number;
  date?: string;
  effective_date?: string;
  updated_at?: string;
};

const RESPONSE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, max-age=0",
};

function validRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

async function fetchFreshJson(
  url: string
): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(
      `Proveedor respondió con HTTP ${response.status}`
    );
  }

  return response.json();
}

async function getDolarVzla(): Promise<RateResult> {
  const data = (await fetchFreshJson(
    "https://rates.dolarvzla.com/bcv/current.json"
  )) as DolarVzlaResponse;

  const rate = data.current?.usd;
  const date = data.current?.date;

  if (!validRate(rate) || !validDate(date)) {
    throw new Error(
      "DolarVZLA devolvió una tasa o fecha inválida."
    );
  }

  return {
    rate,
    date,
    updatedAt: null,
    provider: "DolarVZLA",
  };
}

async function getBcvToday(): Promise<RateResult> {
  const data = (await fetchFreshJson(
    "https://bcv.today/api/v1/rate.json"
  )) as BcvTodayResponse;

  const rate = data.USD;

  const date =
    data.effective_date ?? data.date;

  if (!validRate(rate) || !validDate(date)) {
    throw new Error(
      "BCV Today devolvió una tasa o fecha inválida."
    );
  }

  return {
    rate,
    date,
    updatedAt:
      typeof data.updated_at === "string"
        ? data.updated_at
        : null,
    provider: "BCV Today",
  };
}

export async function GET() {
  try {
    // Consultamos dos proveedores independientes.
    // Si uno falla, el otro puede responder.
    const results = await Promise.allSettled([
      getDolarVzla(),
      getBcvToday(),
    ]);

    const availableRates: RateResult[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        availableRates.push(result.value);
      } else {
        console.error(
          "Error consultando proveedor BCV:",
          result.reason
        );
      }
    }

    if (availableRates.length === 0) {
      throw new Error(
        "Ningún proveedor devolvió una tasa válida."
      );
    }

    // Elegimos la fecha de tasa más reciente,
    // aunque su vigencia sea futura.
    // NO seleccionamos la tasa por su valor.
    availableRates.sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const selected = availableRates[0];

    return NextResponse.json(
      {
        ok: true,
        rate: selected.rate,
        date: selected.date,
        effectiveDate: selected.date,
        updatedAt: selected.updatedAt,
        source: "BCV",
        provider: selected.provider,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "Error obteniendo tasa BCV:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        rate: null,
        date: null,
        effectiveDate: null,
        updatedAt: null,
        source: "BCV",
        message:
          "No fue posible consultar la tasa BCV actualizada. Inténtalo nuevamente.",
      },
      {
        status: 503,
        headers: RESPONSE_HEADERS,
      }
    );
  }
}
