
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_TIME_ZONE = "America/Caracas";
const VENEZUELA_OFFSET = "-04:00";

const CANDIDATE_SLOTS = [
  "09:00",
  "09:45",
  "10:00",
  "10:30",
  "11:15",
  "11:30",
  "14:00",
  "14:45",
  "15:30",
  "16:15",
  "17:00",
];

const BUSINESS_HOURS: Record<
  number,
  {
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }
> = {
  0: {
    isOpen: false,
    openTime: null,
    closeTime: null,
  },
  1: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
  },
  2: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
  },
  3: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
  },
  4: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
  },
  5: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
  },
  6: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "18:00",
  },
};

// Solo Corte Esencial está habilitado.
// Premium aparecerá en la interfaz como "Próximamente".
const ENABLED_SERVICES = [
  {
    code: "essential",
    name: "Corte Esencial",
    durationMinutes: 45,
  },
] as const;

type BusyPeriod = {
  start: string;
  end: string;
};

function createGoogleOAuthClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI;

  const refreshToken =
    process.env.GOOGLE_REFRESH_TOKEN;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !refreshToken
  ) {
    throw new Error(
      "Faltan variables de entorno de Google Calendar."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

function isValidDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 2020 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const parsed = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function localDateTime(
  date: string,
  time: string
): Date {
  return new Date(
    `${date}T${time}:00${VENEZUELA_OFFSET}`
  );
}

function minutesFromTime(
  time: string
): number {
  const [hours, minutes] = time
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function timeFromMinutes(
  totalMinutes: number
): string {
  const hours = Math.floor(
    totalMinutes / 60
  );

  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}`;
}

function formatTime12Hour(
  time: string
): string {
  const [hoursText, minutes] =
    time.split(":");

  const hours = Number(hoursText);

  return `${hours % 12 || 12}:${minutes} ${
    hours >= 12 ? "PM" : "AM"
  }`;
}

function overlaps(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && endA > startB;
}

async function getBusyPeriods(
  date: string
): Promise<BusyPeriod[]> {
  const calendar = google.calendar({
    version: "v3",
    auth: createGoogleOAuthClient(),
  });

  const calendarId =
    process.env.GOOGLE_CALENDAR_ID ||
    "primary";

  const dayStart = new Date(
    `${date}T00:00:00${VENEZUELA_OFFSET}`
  );

  const dayEnd = new Date(
    `${date}T23:59:59.999${VENEZUELA_OFFSET}`
  );

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      timeZone: GOOGLE_TIME_ZONE,
      items: [
        {
          id: calendarId,
        },
      ],
    },
  });

  const calendars =
    response.data.calendars || {};

  const results =
    Object.values(calendars);

  if (results.length !== 1) {
    throw new Error(
      "Google Calendar no devolvió el calendario solicitado."
    );
  }

  const calendarData = results[0];

  if (
    (calendarData.errors || []).length > 0
  ) {
    console.error(
      "Google Calendar freebusy errors:",
      calendarData.errors
    );

    throw new Error(
      "Google Calendar devolvió un error al consultar disponibilidad."
    );
  }

  if (!Array.isArray(calendarData.busy)) {
    throw new Error(
      "Google Calendar devolvió información incompleta."
    );
  }

  const periods: BusyPeriod[] = [];

  for (const busy of calendarData.busy) {
    if (
      typeof busy.start !== "string" ||
      typeof busy.end !== "string" ||
      Number.isNaN(Date.parse(busy.start)) ||
      Number.isNaN(Date.parse(busy.end))
    ) {
      throw new Error(
        "Google Calendar devolvió un intervalo ocupado inválido."
      );
    }

    periods.push({
      start: busy.start,
      end: busy.end,
    });
  }

  return periods;
}

export async function GET(
  request: NextRequest
) {
  try {
    const date =
      request.nextUrl.searchParams
        .get("date")
        ?.trim() || "";

    if (!isValidDate(date)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Debes indicar una fecha válida en formato YYYY-MM-DD.",
        },
        {
          status: 400,
        }
      );
    }

    const dateForWeekday = new Date(
      `${date}T12:00:00${VENEZUELA_OFFSET}`
    );

    const weekday =
      dateForWeekday.getUTCDay();

    const workingHours =
      BUSINESS_HOURS[weekday];

    if (
      !workingHours ||
      !workingHours.isOpen ||
      !workingHours.openTime ||
      !workingHours.closeTime
    ) {
      return NextResponse.json(
        {
          ok: true,
          source: "google-calendar",
          date,
          weekday,
          isOpen: false,
          openTime: null,
          closeTime: null,
          slots: [],
          busyPeriodsCount: 0,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const openTime =
      workingHours.openTime;

    const closeTime =
      workingHours.closeTime;

    const openMinutes =
      minutesFromTime(openTime);

    const closeMinutes =
      minutesFromTime(closeTime);

    const busyPeriods =
      await getBusyPeriods(date);

    const now = new Date();

    const slots = CANDIDATE_SLOTS.map(
      (slotTime) => {
        const slotMinutes =
          minutesFromTime(slotTime);

        if (
          slotMinutes < openMinutes ||
          slotMinutes >= closeMinutes
        ) {
          return null;
        }

        const slotStart =
          localDateTime(date, slotTime);

        const label =
          formatTime12Hour(slotTime);

        if (slotStart <= now) {
          return {
            time: slotTime,
            label,
            available: false,
            availableServices: [] as string[],
            reason: "past",
          };
        }

        const availableServices =
          ENABLED_SERVICES.filter(
            (service) => {
              const serviceEndMinutes =
                slotMinutes +
                service.durationMinutes;

              if (
                serviceEndMinutes >
                closeMinutes
              ) {
                return false;
              }

              const serviceEnd =
                localDateTime(
                  date,
                  timeFromMinutes(
                    serviceEndMinutes
                  )
                );

              return !busyPeriods.some(
                (period) =>
                  overlaps(
                    slotStart,
                    serviceEnd,
                    new Date(period.start),
                    new Date(period.end)
                  )
              );
            }
          );

        const available =
          availableServices.length > 0;

        return {
          time: slotTime,
          label,
          available,
          availableServices:
            availableServices.map(
              (service) => service.code
            ),
          reason: available
            ? null
            : "occupied",
        };
      }
    ).filter(
      (
        slot
      ): slot is NonNullable<typeof slot> =>
        slot !== null
    );

    return NextResponse.json(
      {
        ok: true,
        source: "google-calendar",
        date,
        weekday,
        isOpen: true,
        openTime,
        closeTime,
        slots,
        busyPeriodsCount:
          busyPeriods.length,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error consultando disponibilidad en Google Calendar:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "No fue posible consultar la disponibilidad en Google Calendar.",
      },
      {
        status: 500,
      }
    );
  }
}
