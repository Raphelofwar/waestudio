
import { createHash, randomBytes } from "crypto";
import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// CONFIGURACIÓN GENERAL DE WAESTUDIO
// ============================================================

const GOOGLE_TIME_ZONE = "America/Caracas";
const VENEZUELA_OFFSET = "-04:00";

const BUSINESS_OPEN_MINUTES = 9 * 60;
const BUSINESS_CLOSE_MINUTES = 18 * 60;

// Los candados temporales protegen intervalos de 15 minutos.
const LOCK_BUCKET_MINUTES = 15;

// Un candado abandonado se considera vencido después de 2 min.
const LOCK_TTL_MS = 2 * 60 * 1000;

// Límites de formularios.
// La imagen no se almacena en esta API.
const MAX_REQUEST_BYTES = 4_000_000;
const MAX_FORM_FIELDS = 16;
const MAX_TEXT_BYTES = 2_000;
const MAX_RECEIPT_BYTES = 3_800_000;

const PAYMENT_METHODS = new Set([
  "cash",
  "mobile",
  "transfer",
]);

const CASH_CURRENCIES = new Set([
  "USD",
  "VES",
]);

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

type ServiceCode = keyof typeof SERVICES;

type CalendarLock = {
  eventId: string;
  startsAt: Date;
  endsAt: Date;
};

// ============================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================

function getText(
  formData: FormData,
  key: string
): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
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

function minutesFromTime(time: string): number {
  const [hours, minutes] = time
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

// ============================================================
// CONEXIÓN CON GOOGLE CALENDAR
// ============================================================

function createGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;

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

function createCalendarClient() {
  return google.calendar({
    version: "v3",
    auth: createGoogleOAuthClient(),
  });
}

function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

// ============================================================
// CÓDIGOS E IDENTIFICADORES
// ============================================================

function createBookingCode(): string {
  return `WAE-${randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

function createCalendarEventId(
  bookingCode: string
): string {
  return createHash("sha256")
    .update(`waestudio-${bookingCode}`)
    .digest("hex")
    .slice(0, 40);
}

function createLockEventId(
  bucketStart: Date
): string {
  return createHash("sha256")
    .update(
      `waestudio-lock-${bucketStart.toISOString()}`
    )
    .digest("hex")
    .slice(0, 40);
}

function getGoogleHttpStatus(
  error: unknown
): number | null {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return null;
  }

  const candidate = error as {
    code?: number | string;
    response?: {
      status?: number;
    };
  };

  if (
    typeof candidate.response?.status === "number"
  ) {
    return candidate.response.status;
  }

  const numericCode = Number(candidate.code);

  return Number.isFinite(numericCode)
    ? numericCode
    : null;
}

// ============================================================
// CONSTRUCCIÓN DE CANDADOS TEMPORALES
// ============================================================

function buildLockBuckets(
  startsAt: Date,
  endsAt: Date
): CalendarLock[] {
  const bucketMs =
    LOCK_BUCKET_MINUTES * 60 * 1000;

  const locks: CalendarLock[] = [];

  for (
    let cursor = startsAt.getTime();
    cursor < endsAt.getTime();
    cursor += bucketMs
  ) {
    const bucketStart = new Date(cursor);

    const bucketEnd = new Date(
      Math.min(
        cursor + bucketMs,
        endsAt.getTime()
      )
    );

    locks.push({
      eventId: createLockEventId(bucketStart),
      startsAt: bucketStart,
      endsAt: bucketEnd,
    });
  }

  return locks;
}

// ============================================================
// CONSULTA DE DISPONIBILIDAD EN GOOGLE CALENDAR
// ============================================================

async function isGoogleCalendarBusy(
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const calendar = createCalendarClient();

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startsAt.toISOString(),
      timeMax: endsAt.toISOString(),
      timeZone: GOOGLE_TIME_ZONE,
      items: [
        {
          id: getCalendarId(),
        },
      ],
    },
  });

  const calendars = response.data.calendars || {};

  const results = Object.values(calendars);

  // Nunca interpretar una respuesta sin calendario
  // como si todos los horarios estuvieran libres.
  if (results.length !== 1) {
    throw new Error(
      "Google Calendar no devolvió el calendario solicitado."
    );
  }

  const errors = results.flatMap(
    (calendarData) => calendarData.errors || []
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

  const calendarData = results[0];

  if (!Array.isArray(calendarData.busy)) {
    throw new Error(
      "Google Calendar devolvió una disponibilidad incompleta."
    );
  }

  return calendarData.busy.length > 0;
}

// ============================================================
// CREAR UN CANDADO EN GOOGLE CALENDAR
// ============================================================

async function insertLockEvent(
  lock: CalendarLock
): Promise<boolean> {
  const calendar = createCalendarClient();
  const calendarId = getCalendarId();

  const expiresAt = Date.now() + LOCK_TTL_MS;

  const insert = async () => {
    await calendar.events.insert({
      calendarId,
      requestBody: {
        id: lock.eventId,

        summary:
          "WAESTUDIO · Reserva en proceso",

        // Los candados no aparecen como ocupado en
        // FreeBusy. Se coordinan por su ID único.
        transparency: "transparent",
        visibility: "private",

        start: {
          dateTime: lock.startsAt.toISOString(),
          timeZone: GOOGLE_TIME_ZONE,
        },

        end: {
          dateTime: lock.endsAt.toISOString(),
          timeZone: GOOGLE_TIME_ZONE,
        },

        reminders: {
          useDefault: false,
        },

        extendedProperties: {
          private: {
            waestudioLock: "true",
            waestudioLockExpiresAt:
              String(expiresAt),
          },
        },
      },
    });
  };

  try {
    await insert();
    return true;
  } catch (error) {
    // 409: el identificador ya existe.
    if (getGoogleHttpStatus(error) !== 409) {
      throw error;
    }
  }

  // Si el candado existente está vencido,
  // intentamos recuperarlo.
  try {
    const existing = await calendar.events.get({
      calendarId,
      eventId: lock.eventId,
    });

    const privateData =
      existing.data.extendedProperties?.private;

    const isWaestudioLock =
      privateData?.waestudioLock === "true";

    const existingExpiresAt = Number(
      privateData?.waestudioLockExpiresAt
    );

    const isExpired =
      isWaestudioLock &&
      Number.isFinite(existingExpiresAt) &&
      existingExpiresAt < Date.now();

    if (!isExpired) {
      return false;
    }

    await calendar.events.delete({
      calendarId,
      eventId: lock.eventId,
    });

    try {
      await insert();
      return true;
    } catch (retryError) {
      if (
        getGoogleHttpStatus(retryError) === 409
      ) {
        return false;
      }

      throw retryError;
    }
  } catch (error) {
    if (getGoogleHttpStatus(error) === 404) {
      return false;
    }

    throw error;
  }
}

// ============================================================
// LIBERACIÓN DE CANDADOS
// ============================================================

async function releaseCalendarLocks(
  locks: CalendarLock[]
): Promise<void> {
  if (locks.length === 0) {
    return;
  }

  const calendar = createCalendarClient();
  const calendarId = getCalendarId();

  await Promise.allSettled(
    locks.map(async (lock) => {
      try {
        await calendar.events.delete({
          calendarId,
          eventId: lock.eventId,
        });
      } catch (error) {
        if (getGoogleHttpStatus(error) !== 404) {
          console.error(
            "No se pudo eliminar un lock temporal de Calendar:",
            error
          );
        }
      }
    })
  );
}

// ============================================================
// ADQUISICIÓN DE CANDADOS
// ============================================================

async function acquireCalendarLocks(
  startsAt: Date,
  endsAt: Date
): Promise<
  | {
      ok: true;
      locks: CalendarLock[];
    }
  | {
      ok: false;
      locks: CalendarLock[];
    }
> {
  const requiredLocks = buildLockBuckets(
    startsAt,
    endsAt
  );

  const acquiredLocks: CalendarLock[] = [];

  try {
    for (const lock of requiredLocks) {
      const acquired =
        await insertLockEvent(lock);

      if (!acquired) {
        await releaseCalendarLocks(
          acquiredLocks
        );

        return {
          ok: false,
          locks: [],
        };
      }

      acquiredLocks.push(lock);
    }

    return {
      ok: true,
      locks: acquiredLocks,
    };
  } catch (error) {
    // Si Google falla durante el proceso,
    // liberamos los candados adquiridos.
    await releaseCalendarLocks(acquiredLocks);
    throw error;
  }
}

// ============================================================
// CREAR LA CITA DEFINITIVA
// ============================================================

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
  service: (typeof SERVICES)[ServiceCode];
  startsAt: Date;
  endsAt: Date;
}) {
  const calendar = createCalendarClient();

  const eventId =
    createCalendarEventId(bookingCode);

  const response = await calendar.events.insert({
    calendarId: getCalendarId(),

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
        dateTime: startsAt.toISOString(),
        timeZone: GOOGLE_TIME_ZONE,
      },

      end: {
        dateTime: endsAt.toISOString(),
        timeZone: GOOGLE_TIME_ZONE,
      },

      transparency: "opaque",

      extendedProperties: {
        private: {
          waestudioBooking: "true",
          waestudioBookingCode: bookingCode,
          waestudioServiceCode: service.code,
          waestudioCustomerWhatsapp:
            customerWhatsapp,
        },
      },
    },
  });

  return {
    eventId: response.data.id || eventId,
    htmlLink: response.data.htmlLink || null,
  };
}

// ============================================================
// API POST /api/bookings
// ============================================================

export async function POST(request: Request) {
  let acquiredLocks: CalendarLock[] = [];

  try {
    // --------------------------------------------------------
    // 1. COMPROBAR EL TAMAÑO DE LA SOLICITUD
    // --------------------------------------------------------

    const declaredLength = Number(
      request.headers.get("content-length")
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_REQUEST_BYTES
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El comprobante o los datos enviados son demasiado grandes. Utiliza una imagen más pequeña.",
        },
        {
          status: 413,
        }
      );
    }

    const formData = await request.formData();

    let fieldCount = 0;
    let totalTextBytes = 0;
    let fileCount = 0;

    for (const [key, value] of formData.entries()) {
      fieldCount += 1;

      totalTextBytes += Buffer.byteLength(
        key,
        "utf8"
      );

      if (typeof value === "string") {
        totalTextBytes += Buffer.byteLength(
          value,
          "utf8"
        );
      } else {
        fileCount += 1;

        if (
          key !== "receipt" ||
          value.size > MAX_RECEIPT_BYTES
        ) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "El comprobante no es válido o supera el tamaño permitido.",
            },
            {
              status: 413,
            }
          );
        }
      }
    }

    if (
      fieldCount > MAX_FORM_FIELDS ||
      totalTextBytes > MAX_TEXT_BYTES ||
      fileCount > 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Los datos enviados exceden el límite permitido.",
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------------
    // 2. OBTENER DATOS DEL FORMULARIO
    // --------------------------------------------------------

    const customerName = getText(
      formData,
      "customerName"
    );

    const customerWhatsapp = getText(
      formData,
      "customerWhatsapp"
    );

    const serviceCode = getText(
      formData,
      "serviceCode"
    );

    const date = getText(
      formData,
      "date"
    );

    const time = getText(
      formData,
      "time"
    );

    const paymentMethod = getText(
      formData,
      "paymentMethod"
    );

    const cashCurrency = getText(
      formData,
      "cashCurrency"
    ).toUpperCase();

    // --------------------------------------------------------
    // 3. VALIDAR NOMBRE DEL CLIENTE
    // --------------------------------------------------------

    if (
      customerName.length < 2 ||
      customerName.length > 80 ||
      /[\x00-\x1F\x7F]/.test(customerName)
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

    // --------------------------------------------------------
    // 4. VALIDAR WHATSAPP
    // --------------------------------------------------------

    const whatsappDigits =
      customerWhatsapp.replace(/\D/g, "");

    if (
      whatsappDigits.length < 10 ||
      whatsappDigits.length > 15 ||
      customerWhatsapp.length > 30 ||
      !/^[+\d\s().-]+$/.test(
        customerWhatsapp
      )
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

    // --------------------------------------------------------
    // 5. VALIDAR SERVICIO
    // --------------------------------------------------------

    if (
      !(serviceCode in SERVICES)
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
      SERVICES[serviceCode as ServiceCode];

    // --------------------------------------------------------
    // 6. VALIDAR MÉTODO DE PAGO
    // --------------------------------------------------------

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El método de pago seleccionado no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (paymentMethod === "cash") {
      if (!CASH_CURRENCIES.has(cashCurrency)) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Selecciona la moneda para el pago en efectivo.",
          },
          {
            status: 400,
          }
        );
      }
    } else {
      const payerBank = getText(
        formData,
        "payerBank"
      );

      const reference = getText(
        formData,
        "reference"
      );

      const referenceDigits =
        reference.replace(/\D/g, "");

      const receipt =
        formData.get("receipt");

      if (
        payerBank.length < 2 ||
        payerBank.length > 80 ||
        /[\x00-\x1F\x7F]/.test(payerBank) ||
        reference.length > 60 ||
        referenceDigits.length < 4 ||
        !receipt ||
        typeof receipt === "string" ||
        receipt.size === 0
      ) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Completa los datos del pago y adjunta el comprobante.",
          },
          {
            status: 400,
          }
        );
      }
    }

    // --------------------------------------------------------
    // 7. VALIDAR FECHA
    // --------------------------------------------------------

    if (!isValidDate(date)) {
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

    // --------------------------------------------------------
    // 8. VALIDAR HORA
    // --------------------------------------------------------

    if (!/^\d{2}:\d{2}$/.test(time)) {
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

    if (!ALLOWED_SLOTS.has(time)) {
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

    const startsAt = new Date(
      `${date}T${time}:00${VENEZUELA_OFFSET}`
    );

    if (
      Number.isNaN(startsAt.getTime())
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

    // --------------------------------------------------------
    // 9. IMPEDIR RESERVAS EN EL PASADO
    // --------------------------------------------------------

    if (startsAt <= new Date()) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "Ese horario ya pasó. Selecciona otro horario.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // 10. COMPROBAR EL DÍA DE LA SEMANA
    // --------------------------------------------------------

    const dateForWeekday = new Date(
      `${date}T12:00:00${VENEZUELA_OFFSET}`
    );

    // Mediodía en Caracas = 16:00 UTC.
    // Usamos getUTCDay para no depender
    // de la zona horaria de Vercel.
    const weekday =
      dateForWeekday.getUTCDay();

    if (weekday === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "WAESTUDIO no abre los domingos.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // 11. COMPROBAR HORARIO DE ATENCIÓN
    // --------------------------------------------------------

    const startMinutes =
      minutesFromTime(time);

    const endMinutes =
      startMinutes +
      service.durationMinutes;

    if (
      startMinutes < BUSINESS_OPEN_MINUTES ||
      endMinutes > BUSINESS_CLOSE_MINUTES
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "El servicio no cabe dentro del horario de atención.",
        },
        {
          status: 409,
        }
      );
    }

    const endsAt = new Date(
      startsAt.getTime() +
        service.durationMinutes * 60 * 1000
    );

    // --------------------------------------------------------
    // 12. PRIMERA CONSULTA DE DISPONIBILIDAD
    // --------------------------------------------------------

    const initiallyBusy =
      await isGoogleCalendarBusy(
        startsAt,
        endsAt
      );

    if (initiallyBusy) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "Ese horario acaba de ser ocupado. Selecciona otro horario.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // 13. ADQUIRIR CANDADOS TEMPORALES
    // --------------------------------------------------------

    const lockResult =
      await acquireCalendarLocks(
        startsAt,
        endsAt
      );

    if (!lockResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "Otro cliente está confirmando un horario que se cruza con esta cita. Selecciona otro horario o inténtalo nuevamente.",
        },
        {
          status: 409,
        }
      );
    }

    acquiredLocks = lockResult.locks;

    // --------------------------------------------------------
    // 14. SEGUNDA CONSULTA DE DISPONIBILIDAD
    // --------------------------------------------------------

    const busyAfterLock =
      await isGoogleCalendarBusy(
        startsAt,
        endsAt
      );

    if (busyAfterLock) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "Ese horario acaba de ser ocupado. Selecciona otro horario.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------------
    // 15. CREAR CITA DEFINITIVA
    // --------------------------------------------------------

    const bookingCode = createBookingCode();

    const calendarEvent =
      await createGoogleCalendarEvent({
        bookingCode,
        customerName,
        customerWhatsapp,
        service,
        startsAt,
        endsAt,
      });

    const isCash = paymentMethod === "cash";

    // --------------------------------------------------------
    // 16. RESPUESTA AL CLIENTE
    // --------------------------------------------------------

    return NextResponse.json(
      {
        ok: true,

        source: "google-calendar",

        bookingId: calendarEvent.eventId,

        bookingCode,

        calendarEventId:
          calendarEvent.eventId,

        calendarCreated: true,

        paymentMethod:
          paymentMethod || null,

        cashCurrency: isCash
          ? cashCurrency || null
          : null,

        status: isCash
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
    // Los candados se liberan al terminar,
    // independientemente del resultado.
    // La cita confirmada permanece en Google Calendar.

    await releaseCalendarLocks(acquiredLocks);
  }
}
