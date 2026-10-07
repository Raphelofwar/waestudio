import { google } from "googleapis";
import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Zona horaria de WAESTUDIO.
 *
 * Venezuela utiliza UTC-4 durante todo el año.
 */
const GOOGLE_TIME_ZONE = "America/Caracas";
const VENEZUELA_OFFSET = "-04:00";

/*
 * Horarios que actualmente utiliza la interfaz.
 *
 * Incluimos también los horarios rápidos de la pantalla
 * principal para poder consultar ambos desde el mismo API.
 */
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

/*
 * Horario fijo de WAESTUDIO.
 *
 * 0 = domingo
 * 1 = lunes
 * ...
 * 6 = sábado
 *
 * Ya no se consulta Supabase para obtener el horario.
 */
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

/*
 * Servicios de WAESTUDIO.
 *
 * Ya no se consulta Supabase para conocer la duración
 * de cada servicio.
 */
const SERVICES = [
  {
    code: "essential",
    name: "Corte Esencial",
    durationMinutes: 45,
  },
  {
    code: "premium",
    name: "Experiencia Premium",
    durationMinutes: 75,
  },
];

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

  const oauth2Client =
    new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function localDateTime(
  date: string,
  time: string
) {
  return new Date(
    `${date}T${time}:00${VENEZUELA_OFFSET}`
  );
}

function minutesFromTime(
  time: string
) {
  const [hours, minutes] = time
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function timeFromMinutes(
  totalMinutes: number
) {
  const hours = Math.floor(
    totalMinutes / 60
  );

  const minutes =
    totalMinutes % 60;

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
) {
  const [hoursText, minutes] =
    time.split(":");

  const hours =
    Number(hoursText);

  const suffix =
    hours >= 12 ? "PM" : "AM";

  const displayHour =
    hours % 12 || 12;

  return `${displayHour}:${minutes} ${suffix}`;
}

function overlaps(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
) {
  return (
    startA < endB &&
    endA > startB
  );
}

async function getBusyPeriods(
  date: string
): Promise<BusyPeriod[]> {
  const auth =
    createGoogleOAuthClient();

  const calendar =
    google.calendar({
      version: "v3",
      auth,
    });

  const calendarId =
    process.env.GOOGLE_CALENDAR_ID ||
    "primary";

  const dayStart =
    new Date(
      `${date}T00:00:00${VENEZUELA_OFFSET}`
    );

  const dayEnd =
    new Date(
      `${date}T23:59:59.999${VENEZUELA_OFFSET}`
    );

  const response =
    await calendar.freebusy.query({
      requestBody: {
        timeMin:
          dayStart.toISOString(),

        timeMax:
          dayEnd.toISOString(),

        timeZone:
          GOOGLE_TIME_ZONE,

        items: [
          {
            id: calendarId,
          },
        ],
      },
    });

  const calendars =
    response.data.calendars || {};

  const calendarResults =
    Object.values(calendars);

  const calendarErrors =
    calendarResults.flatMap(
      (calendarData) =>
        calendarData.errors || []
    );

  if (calendarErrors.length > 0) {
    console.error(
      "Google Calendar freebusy errors:",
      calendarErrors
    );

    throw new Error(
      "Google Calendar devolvió un error al consultar disponibilidad."
    );
  }

  return calendarResults.flatMap(
    (calendarData) =>
      (calendarData.busy || [])
        .filter(
          (
            busy
          ): busy is {
            start: string;
            end: string;
          } =>
            typeof busy.start ===
              "string" &&
            typeof busy.end ===
              "string"
        )
        .map((busy) => ({
          start: busy.start,
          end: busy.end,
        }))
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const date =
      searchParams.get("date")?.trim() ||
      "";

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

    /*
     * Utilizamos mediodía para determinar correctamente
     * el día de la semana sin problemas por zona horaria.
     */
    const dateForWeekday =
      new Date(
        `${date}T12:00:00${VENEZUELA_OFFSET}`
      );

    if (
      Number.isNaN(
        dateForWeekday.getTime()
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La fecha indicada no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    const weekday =
      dateForWeekday.getDay();

    /*
     * HORARIO DEL NEGOCIO
     *
     * Ahora se obtiene de configuración local,
     * no de Supabase.
     */
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

          source:
            "google-calendar",

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

    /*
     * GOOGLE CALENDAR
     *
     * Cualquier intervalo que Google Calendar devuelva
     * como BUSY se considera ocupado.
     *
     * Esto incluye:
     * - citas creadas automáticamente por WAESTUDIO
     * - bloqueos manuales creados por el barbero
     * - otros eventos configurados como "ocupado"
     */
    const busyPeriods =
      await getBusyPeriods(date);

    /*
     * GENERAR DISPONIBILIDAD
     */
    const openMinutes =
      minutesFromTime(openTime);

    const closeMinutes =
      minutesFromTime(closeTime);

    const now = new Date();

    const slots =
      CANDIDATE_SLOTS.map(
        (slotTime) => {
          const slotMinutes =
            minutesFromTime(
              slotTime
            );

          /*
           * El horario debe encontrarse dentro
           * de la jornada laboral.
           */
          if (
            slotMinutes <
              openMinutes ||
            slotMinutes >=
              closeMinutes
          ) {
            return null;
          }

          const slotStart =
            localDateTime(
              date,
              slotTime
            );

          /*
           * Una hora pasada ya no puede reservarse.
           */
          if (slotStart <= now) {
            return {
              time: slotTime,

              label:
                formatTime12Hour(
                  slotTime
                ),

              available: false,

              availableServices: [],

              reason: "past",
            };
          }

          const availableServices =
            SERVICES.filter(
              (service) => {
                const serviceEndMinutes =
                  slotMinutes +
                  service.durationMinutes;

                /*
                 * El servicio debe terminar
                 * antes del cierre.
                 */
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

                /*
                 * Comprobar conflictos con Google Calendar.
                 *
                 * Si cualquier parte del servicio se superpone
                 * con un intervalo BUSY, ese servicio no puede
                 * reservarse en esa hora.
                 */
                const calendarConflict =
                  busyPeriods.some(
                    (period) => {
                      const busyStart =
                        new Date(
                          period.start
                        );

                      const busyEnd =
                        new Date(
                          period.end
                        );

                      return overlaps(
                        slotStart,
                        serviceEnd,
                        busyStart,
                        busyEnd
                      );
                    }
                  );

                return !calendarConflict;
              }
            );

          return {
            time: slotTime,

            label:
              formatTime12Hour(
                slotTime
              ),

            available:
              availableServices.length >
              0,

            availableServices:
              availableServices.map(
                (service) =>
                  service.code
              ),

            reason:
              availableServices.length >
              0
                ? null
                : "occupied",
          };
        }
      ).filter(
        (
          slot
        ): slot is NonNullable<
          typeof slot
        > => slot !== null
      );

    return NextResponse.json(
      {
        ok: true,

        source:
          "google-calendar",

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
