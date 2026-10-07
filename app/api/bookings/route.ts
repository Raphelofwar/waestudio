import { createHash, randomBytes } from "crypto";
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
   * Google Calendar admite IDs personalizados.
   * Usamos SHA-256 y solo caracteres hexadecimales
   * para mantener un identificador compatible.
   */
  return createHash("sha256")
    .update(
      `waestudio-${bookingCode}`
    )
    .digest("hex")
    .slice(0, 40);
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

  if (errors.length > 0) {
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
        id: eventId,

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
      customerName.length < 2
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
      whatsappDigits.length < 10
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
      startsAt <= new Date()
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
     * VALIDACIÓN FINAL EN GOOGLE CALENDAR
     * =================================
     *
     * La disponibilidad se vuelve a consultar
     * justo antes de crear la cita.
     */

    const isBusy =
      await isGoogleCalendarBusy(
        startsAt,
        endsAt
      );

    if (isBusy) {
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
     * CREAR CITA EN GOOGLE CALENDAR
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

    /*
     * =================================
     * RESPUESTA COMPATIBLE CON page.tsx
     * =================================
     *
     * Ya no existe booking en Supabase.
     * El eventId de Google Calendar pasa a ser
     * el identificador interno de esta cita.
     */

    const isCash =
      paymentMethod === "cash";

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
          paymentMethod || null,

        cashCurrency:
          isCash
            ? cashCurrency || null
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
  }
}
