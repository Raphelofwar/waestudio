import {
  createHash,
  randomBytes,
} from "crypto";
import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_TIME_ZONE =
  "America/Caracas";

const VENEZUELA_OFFSET =
  "-04:00";

const BUSINESS_OPEN_MINUTES =
  9 * 60;

const BUSINESS_CLOSE_MINUTES =
  18 * 60;

/*
 * Cada reserva adquiere candados temporales
 * de 15 minutos mientras se crea la cita.
 *
 * Esto evita que dos clientes que confirman
 * casi al mismo tiempo puedan crear citas
 * que se solapen.
 */
const LOCK_BUCKET_MINUTES = 15;

/*
 * Si un proceso se interrumpe inesperadamente,
 * un candado puede quedar en Calendar.
 *
 * Después de 2 minutos se considera vencido
 * y otra solicitud puede recuperarlo.
 */
const LOCK_TTL_MS =
  2 * 60 * 1000;

const ALLOWED_SLOTS = new Set([
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
]);

const SERVICES = {
  essential: {
    code: "essential",
    name: "Corte Esencial",
    priceUsd: 7,
    durationMinutes: 45,
  },

  premium: {
    code: "premium",
    name: "Experiencia Premium",
    priceUsd: 10,
    durationMinutes: 75,
  },
} as const;

type ServiceCode =
  keyof typeof SERVICES;

type CalendarLock = {
  eventId: string;
  startsAt: Date;
  endsAt: Date;
};

function getText(
  formData: FormData,
  key: string
) {
  const value =
    formData.get(key);

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function minutesFromTime(
  time: string
) {
  const [hours, minutes] =
    time
      .split(":")
      .map(Number);

  return (
    hours * 60 +
    minutes
  );
}

function createGoogleOAuthClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env
      .GOOGLE_CLIENT_SECRET;

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI;

  const refreshToken =
    process.env
      .GOOGLE_REFRESH_TOKEN;

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
    refresh_token:
      refreshToken,
  });

  return oauth2Client;
}

function createCalendarClient() {
  return google.calendar({
    version: "v3",

    auth:
      createGoogleOAuthClient(),
  });
}

function getCalendarId() {
  return (
    process.env
      .GOOGLE_CALENDAR_ID ||
    "primary"
  );
}

function createBookingCode() {
  return `WAE-${randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function createCalendarEventId(
  bookingCode: string
) {
  /*
   * Los caracteres hexadecimales utilizados
   * por SHA-256 son compatibles con IDs
   * personalizados de Calendar.
   */
  return createHash("sha256")
    .update(
      `waestudio-${bookingCode}`
    )
    .digest("hex")
    .slice(0, 40);
}

function createLockEventId(
  bucketStart: Date
) {
  /*
   * El ID depende únicamente del intervalo.
   *
   * Dos solicitudes que intenten ocupar
   * el mismo bloque de 15 minutos tratarán
   * de crear exactamente el mismo eventId.
   * Google Calendar permitirá solo uno.
   */
  return createHash("sha256")
    .update(
      `waestudio-lock-${bucketStart.toISOString()}`
    )
    .digest("hex")
    .slice(0, 40);
}

function getGoogleHttpStatus(
  error: unknown
) {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return null;
  }

  const candidate =
    error as {
      code?: number | string;

      response?: {
        status?: number;
      };
    };

  if (
    typeof candidate.response
      ?.status === "number"
  ) {
    return candidate.response.status;
  }

  const numericCode =
    Number(candidate.code);

  return Number.isFinite(
    numericCode
  )
    ? numericCode
    : null;
}

function buildLockBuckets(
  startsAt: Date,
  endsAt: Date
): CalendarLock[] {
  const bucketMs =
    LOCK_BUCKET_MINUTES *
    60 *
    1000;

  const locks:
    CalendarLock[] = [];

  for (
    let cursor =
      startsAt.getTime();

    cursor <
    endsAt.getTime();

    cursor += bucketMs
  ) {
    const bucketStart =
      new Date(cursor);

    const bucketEnd =
      new Date(
        Math.min(
          cursor + bucketMs,
          endsAt.getTime()
        )
      );

    locks.push({
      eventId:
        createLockEventId(
          bucketStart
        ),

      startsAt:
        bucketStart,

      endsAt:
        bucketEnd,
    });
  }

  return locks;
}

async function isGoogleCalendarBusy(
  startsAt: Date,
  endsAt: Date
) {
  const calendar =
    createCalendarClient();

  const response =
    await calendar.freebusy.query({
      requestBody: {
        timeMin:
          startsAt.toISOString(),

        timeMax:
          endsAt.toISOString(),

        timeZone:
          GOOGLE_TIME_ZONE,

        items: [
          {
            id:
              getCalendarId(),
          },
        ],
      },
    });

  const calendars =
    response.data.calendars ||
    {};

  const results =
    Object.values(calendars);

  const errors =
    results.flatMap(
      (calendarData) =>
        calendarData.errors || []
    );

  if (
    errors.length > 0
  ) {
    console.error(
      "Google Calendar freebusy errors:",
      errors
    );

    throw new Error(
      "Google Calendar devolvió un error consultando disponibilidad."
    );
  }

  return results.some(
    (calendarData) =>
      (calendarData.busy || [])
        .length > 0
  );
}

async function insertLockEvent(
  lock: CalendarLock
) {
  const calendar =
    createCalendarClient();

  const calendarId =
    getCalendarId();

  const expiresAt =
    Date.now() +
    LOCK_TTL_MS;

  const insert = async () => {
    await calendar.events.insert({
      calendarId,

      requestBody: {
        id:
          lock.eventId,

        summary:
          "WAESTUDIO · Reserva en proceso",

        /*
         * Transparent significa que este
         * evento temporal NO bloquea FreeBusy.
         *
         * El bloqueo real entre solicitudes
         * se obtiene mediante su eventId único.
         */
        transparency:
          "transparent",

        visibility:
          "private",

        start: {
          dateTime:
            lock.startsAt.toISOString(),

          timeZone:
            GOOGLE_TIME_ZONE,
        },

        end: {
          dateTime:
            lock.endsAt.toISOString(),

          timeZone:
            GOOGLE_TIME_ZONE,
        },

        reminders: {
          useDefault: false,
        },

        extendedProperties: {
          private: {
            waestudioLock:
              "true",

            waestudioLockExpiresAt:
              String(
                expiresAt
              ),
          },
        },
      },
    });
  };

  try {
    await insert();

    return true;
  } catch (error) {
    /*
     * 409 significa que ya existe un evento
     * con ese mismo ID: otro proceso posee
     * el candado o quedó uno antiguo.
     */
    if (
      getGoogleHttpStatus(
        error
      ) !== 409
    ) {
      throw error;
    }
  }

  /*
   * Si existe un candado viejo por un proceso
   * que se interrumpió, lo recuperamos.
   */
  try {
    const existing =
      await calendar.events.get({
        calendarId,

        eventId:
          lock.eventId,
      });

    const privateData =
      existing.data
        .extendedProperties
        ?.private;

    const isWaestudioLock =
      privateData
        ?.waestudioLock ===
      "true";

    const existingExpiresAt =
      Number(
        privateData
          ?.waestudioLockExpiresAt
      );

    const isExpired =
      isWaestudioLock &&
      Number.isFinite(
        existingExpiresAt
      ) &&
      existingExpiresAt <
        Date.now();

    if (!isExpired) {
      return false;
    }

    await calendar.events.delete({
      calendarId,

      eventId:
        lock.eventId,
    });

    /*
     * Tras borrar un lock vencido intentamos
     * adquirirlo una sola vez más.
     */
    try {
      await insert();

      return true;
    } catch (retryError) {
      if (
        getGoogleHttpStatus(
          retryError
        ) === 409
      ) {
        return false;
      }

      throw retryError;
    }
  } catch (error) {
    /*
     * Si otro proceso modificó/eliminó el evento
     * durante esta comprobación, tratamos el
     * candado como no adquirido.
     */
    if (
      getGoogleHttpStatus(
        error
      ) === 404
    ) {
      return false;
    }

    throw error;
  }
}

async function releaseCalendarLocks(
  locks: CalendarLock[]
) {
  if (
    locks.length === 0
  ) {
    return;
  }

  const calendar =
    createCalendarClient();

  const calendarId =
    getCalendarId();

  await Promise.allSettled(
    locks.map(
      async (lock) => {
        try {
          await calendar.events.delete({
            calendarId,

            eventId:
              lock.eventId,
          });
        } catch (error) {
          /*
           * 404 es inofensivo:
           * el lock ya no existe.
           */
          if (
            getGoogleHttpStatus(
              error
            ) !== 404
          ) {
            console.error(
              "No se pudo eliminar un lock temporal de Calendar:",
              error
            );
          }
        }
      }
    )
  );
}

async function acquireCalendarLocks(
  startsAt: Date,
  endsAt: Date
) {
  const requiredLocks =
    buildLockBuckets(
      startsAt,
      endsAt
    );

  const acquiredLocks:
    CalendarLock[] = [];

  for (
    const lock of
      requiredLocks
  ) {
    const acquired =
      await insertLockEvent(
        lock
      );

    if (!acquired) {
      await releaseCalendarLocks(
        acquiredLocks
      );

      return {
        ok: false as const,

        locks: [] as
          CalendarLock[],
      };
    }

    acquiredLocks.push(
      lock
    );
  }

  return {
    ok: true as const,

    locks:
      acquiredLocks,
  };
}

async function createGoogleCalendarEvent({
  bookingCode,
  customerName,
  customerWhatsapp,
  service,
  startsAt,
  endsAt,
}: {
  bookingCode: string;
  customerName: string;
  customerWhatsapp: string;
  service:
    (typeof SERVICES)[ServiceCode];
  startsAt: Date;
  endsAt: Date;
}) {
  const calendar =
    createCalendarClient();

  const eventId =
    createCalendarEventId(
      bookingCode
    );

  const response =
    await calendar.events.insert({
      calendarId:
        getCalendarId(),

      requestBody: {
        id:
          eventId,

        summary:
          `WAESTUDIO · ${customerName} · ${service.name}`,

        description: [
          `Cliente: ${customerName}`,
          `WhatsApp: ${customerWhatsapp}`,
          `Servicio: ${service.name}`,
          `Código de cita: ${bookingCode}`,
          "",
          "Reserva creada automáticamente por WAESTUDIO.",
        ].join("\n"),

        start: {
          dateTime:
            startsAt.toISOString(),

          timeZone:
            GOOGLE_TIME_ZONE,
        },

        end: {
          dateTime:
            endsAt.toISOString(),

          timeZone:
            GOOGLE_TIME_ZONE,
        },

        transparency:
          "opaque",

        extendedProperties: {
          private: {
            waestudioBooking:
              "true",

            waestudioBookingCode:
              bookingCode,

            waestudioServiceCode:
              service.code,

            waestudioCustomerWhatsapp:
              customerWhatsapp,
          },
        },
      },
    });

  return {
    eventId:
      response.data.id ||
      eventId,

    htmlLink:
      response.data.htmlLink ||
      null,
  };
}

export async function POST(
  request: Request
) {
  let acquiredLocks:
    CalendarLock[] = [];

  try {
    const formData =
      await request.formData();

    const customerName =
      getText(
        formData,
        "customerName"
      );

    const customerWhatsapp =
      getText(
        formData,
        "customerWhatsapp"
      );

    const serviceCode =
      getText(
        formData,
        "serviceCode"
      );

    const date =
      getText(
        formData,
        "date"
      );

    const time =
      getText(
        formData,
        "time"
      );

    const paymentMethod =
      getText(
        formData,
        "paymentMethod"
      );

    const cashCurrency =
      getText(
        formData,
        "cashCurrency"
      ).toUpperCase();

    /*
     * =================================
     * VALIDACIONES DEL CLIENTE
     * =================================
     */

    if (
      customerName.length <
      2
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "El nombre del cliente no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const whatsappDigits =
      customerWhatsapp.replace(
        /\D/g,
        ""
      );

    if (
      whatsappDigits.length <
      10
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "El número de WhatsApp no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =================================
     * SERVICIO
     * =================================
     */

    if (
      !(
        serviceCode in
        SERVICES
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "El servicio seleccionado no está disponible.",
        },
        {
          status: 400,
        }
      );
    }

    const service =
      SERVICES[
        serviceCode as
          ServiceCode
      ];

    /*
     * =================================
     * FECHA Y HORA
     * =================================
     */

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "La fecha no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^\d{2}:\d{2}$/.test(
        time
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "La hora no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !ALLOWED_SLOTS.has(
        time
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "La hora seleccionada no pertenece a los horarios disponibles de WAESTUDIO.",
        },
        {
          status: 400,
        }
      );
    }

    const startsAt =
      new Date(
        `${date}T${time}:00${VENEZUELA_OFFSET}`
      );

    if (
      Number.isNaN(
        startsAt.getTime()
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          message:
            "La fecha de la reserva no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      startsAt <=
      new Date()
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "TIME_NOT_AVAILABLE",

          message:
            "Ese horario ya pasó. Selecciona otro horario.",
        },
        {
          status: 409,
        }
      );
    }

    const dateForWeekday =
      new Date(
        `${date}T12:00:00${VENEZUELA_OFFSET}`
      );

    const weekday =
      dateForWeekday.getDay();

    if (weekday === 0) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "TIME_NOT_AVAILABLE",

          message:
            "WAESTUDIO no abre los domingos.",
        },
        {
          status: 409,
        }
      );
    }

    const startMinutes =
      minutesFromTime(
        time
      );

    const endMinutes =
      startMinutes +
      service.durationMinutes;

    if (
      startMinutes <
        BUSINESS_OPEN_MINUTES ||
      endMinutes >
        BUSINESS_CLOSE_MINUTES
    ) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "TIME_NOT_AVAILABLE",

          message:
            "El servicio no cabe dentro del horario de atención.",
        },
        {
          status: 409,
        }
      );
    }

    const endsAt =
      new Date(
        startsAt.getTime() +
          service.durationMinutes *
            60 *
            1000
      );

    /*
     * =================================
     * PRIMERA COMPROBACIÓN FREE/BUSY
     * =================================
     */

    const initiallyBusy =
      await isGoogleCalendarBusy(
        startsAt,
        endsAt
      );

    if (initiallyBusy) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "TIME_NOT_AVAILABLE",

          message:
            "Ese horario acaba de ser ocupado. Selecciona otro horario.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =================================
     * CANDADOS TEMPORALES
     * =================================
     *
     * Los candados dividen la duración real
     * del servicio en bloques de 15 minutos.
     *
     * Ejemplo:
     * 09:00 + Premium (75 min)
     * bloquea temporalmente:
     * 09:00
     * 09:15
     * 09:30
     * 09:45
     * 10:00
     *
     * Otra solicitud que se solape deberá
     * adquirir alguno de esos mismos IDs
     * y Google Calendar la rechazará.
     */

    const lockResult =
      await acquireCalendarLocks(
        startsAt,
        endsAt
      );

    if (!lockResult.ok) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "TIME_NOT_AVAILABLE",

          message:
            "Otro cliente está confirmando un horario que se cruza con esta cita. Selecciona otro horario o inténtalo nuevamente.",
        },
        {
          status: 409,
        }
      );
    }

    acquiredLocks =
      lockResult.locks;

    /*
     * =================================
     * SEGUNDA COMPROBACIÓN FREE/BUSY
     * =================================
     *
     * Los locks son transparentes y no salen
     * como BUSY. Por eso podemos volver a
     * consultar Calendar después de obtenerlos.
     *
     * Esto cubre, por ejemplo, que el barbero
     * haya creado un bloqueo manual justo
     * durante el proceso de reserva.
     */

    const busyAfterLock =
      await isGoogleCalendarBusy(
        startsAt,
        endsAt
      );

    if (busyAfterLock) {
      return NextResponse.json(
        {
          ok: false,

          code:
            "TIME_NOT_AVAILABLE",

          message:
            "Ese horario acaba de ser ocupado. Selecciona otro horario.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =================================
     * CREAR CITA DEFINITIVA
     * =================================
     */

    const bookingCode =
      createBookingCode();

    const calendarEvent =
      await createGoogleCalendarEvent({
        bookingCode,

        customerName,

        customerWhatsapp,

        service,

        startsAt,

        endsAt,
      });

    const isCash =
      paymentMethod ===
      "cash";

    return NextResponse.json(
      {
        ok: true,

        source:
          "google-calendar",

        bookingId:
          calendarEvent.eventId,

        bookingCode,

        calendarEventId:
          calendarEvent.eventId,

        calendarCreated:
          true,

        paymentMethod:
          paymentMethod ||
          null,

        cashCurrency:
          isCash
            ? cashCurrency ||
              null
            : null,

        status:
          isCash
            ? "cash_pending"
            : "payment_reported",

        message:
          "Reserva realizada. La cita fue agregada al calendario.",
      },
      {
        status: 201,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error creando cita en Google Calendar:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        message:
          "No fue posible crear la cita en Google Calendar.",
      },
      {
        status: 500,
      }
    );
  } finally {
    /*
     * Los candados son siempre temporales.
     *
     * La cita definitiva ya es un evento
     * opaque y será la que bloquee FreeBusy.
     */
    await releaseCalendarLocks(
      acquiredLocks
    );
  }
}
