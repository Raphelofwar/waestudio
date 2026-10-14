
import { createHash, randomBytes } from "crypto";
import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_TIME_ZONE = "America/Caracas";
const VENEZUELA_OFFSET = "-04:00";

const BUSINESS_OPEN_MINUTES = 9 * 60;
const BUSINESS_CLOSE_MINUTES = 18 * 60;

const LOCK_BUCKET_MINUTES = 15;
const LOCK_TTL_MS = 2 * 60 * 1000;

// Los candados técnicos viven fuera del calendario operativo.
// No se eliminan: se liberan con control de versión (ETag).
const LOCK_MARKER_START = "2000-01-01T00:00:00.000Z";
const LOCK_MARKER_END = "2000-01-01T00:01:00.000Z";

const MAX_REQUEST_BYTES = 4_000_000;
const MAX_FORM_FIELDS = 16;
const MAX_TEXT_BYTES = 2_000;
const MAX_RECEIPT_BYTES = 3_800_000;

const PAYMENT_METHODS = new Set([
  "cash",
  "mobile",
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
  ownerToken: string;
};

function getText(
  formData: FormData,
  key: string
): string {
  const value = formData.get(key);

  return typeof value === "string"
    ? value.trim()
    : "";
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
  return (
    process.env.GOOGLE_CALENDAR_ID ||
    "primary"
  );
}

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
      `waestudio-lock-v2-${bucketStart.toISOString()}`
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
    typeof candidate.response?.status ===
    "number"
  ) {
    return candidate.response.status;
  }

  const numericCode = Number(candidate.code);

  return Number.isFinite(numericCode)
    ? numericCode
    : null;
}

function buildLockBuckets(
  startsAt: Date,
  endsAt: Date,
  ownerToken: string
): CalendarLock[] {
  const bucketMs =
    LOCK_BUCKET_MINUTES * 60 * 1000;

  const locks: CalendarLock[] = [];
  const firstBucket =
    Math.floor(startsAt.getTime() / bucketMs) *
    bucketMs;

  for (
    let cursor = firstBucket;
    cursor < endsAt.getTime();
    cursor += bucketMs
  ) {
    const bucketStart = new Date(cursor);

    locks.push({
      eventId: createLockEventId(bucketStart),
      startsAt: bucketStart,
      endsAt: new Date(cursor + bucketMs),
      ownerToken,
    });
  }

  return locks;
}

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

// Se utiliza un evento persistente por bloque horario.
// Google Calendar no permite reutilizar de forma fiable el ID
// de un evento eliminado; por eso estos eventos no se borran.
function createLockEventBody(
  lock: CalendarLock,
  ownerToken: string,
  expiresAt: number
) {
  return {
    id: lock.eventId,
    summary: "WAESTUDIO · Control interno de reservas",
    description:
      "Evento técnico de coordinación. No eliminar ni modificar.",
    transparency: "transparent",
    visibility: "private",
    start: {
      dateTime: LOCK_MARKER_START,
      timeZone: "UTC",
    },
    end: {
      dateTime: LOCK_MARKER_END,
      timeZone: "UTC",
    },
    reminders: {
      useDefault: false,
    },
    extendedProperties: {
      private: {
        waestudioLock: "v2",
        waestudioLockOwner: ownerToken,
        waestudioLockExpiresAt: String(expiresAt),
        waestudioLockBucket: lock.startsAt.toISOString(),
      },
    },
  };
}

async function insertLockEvent(
  lock: CalendarLock
): Promise<boolean> {
  const calendar = createCalendarClient();
  const calendarId = getCalendarId();
  const expiresAt = Date.now() + LOCK_TTL_MS;

  try {
    await calendar.events.insert({
      calendarId,
      requestBody: createLockEventBody(
        lock,
        lock.ownerToken,
        expiresAt
      ),
    });
    return true;
  } catch (error) {
    if (getGoogleHttpStatus(error) !== 409) {
      throw error;
    }
  }

  // Un marcador existente solo se puede tomar si su
  // arrendamiento expiró o ya fue liberado. La actualización
  // condicional evita que dos clientes adquieran el mismo lock.
  const existing = await calendar.events.get({
    calendarId,
    eventId: lock.eventId,
  });

  const privateData =
    existing.data.extendedProperties?.private;

  if (
    privateData?.waestudioLock !== "v2" ||
    privateData.waestudioLockBucket !==
      lock.startsAt.toISOString()
  ) {
    throw new Error(
      "El candado de calendario no pertenece a WAESTUDIO."
    );
  }

  const existingExpiresAt = Number(
    privateData.waestudioLockExpiresAt
  );

  if (
    !Number.isFinite(existingExpiresAt) ||
    existingExpiresAt > Date.now()
  ) {
    return false;
  }

  const etag = existing.data.etag;

  if (!etag) {
    throw new Error(
      "Google Calendar no devolvió la versión del candado."
    );
  }

  try {
    await calendar.events.update(
      {
        calendarId,
        eventId: lock.eventId,
        requestBody: createLockEventBody(
          lock,
          lock.ownerToken,
          expiresAt
        ),
      },
      {
        headers: {
          "If-Match": etag,
        },
      }
    );
    return true;
  } catch (error) {
    if (
      getGoogleHttpStatus(error) === 412 ||
      getGoogleHttpStatus(error) === 409
    ) {
      return false;
    }

    throw error;
  }
}

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
        const current = await calendar.events.get({
          calendarId,
          eventId: lock.eventId,
        });

        const privateData =
          current.data.extendedProperties?.private;

        // Nunca liberar un candado que otro cliente
        // adquirió después de que venciera nuestro TTL.
        if (
          privateData?.waestudioLock !== "v2" ||
          privateData.waestudioLockOwner !==
            lock.ownerToken
        ) {
          return;
        }

        const etag = current.data.etag;

        if (!etag) {
          throw new Error(
            "No se pudo verificar la versión del candado."
          );
        }

        await calendar.events.update(
          {
            calendarId,
            eventId: lock.eventId,
            requestBody: createLockEventBody(
              lock,
              "released",
              0
            ),
          },
          {
            headers: {
              "If-Match": etag,
            },
          }
        );
      } catch (error) {
        const status = getGoogleHttpStatus(error);

        if (
          status === 404 ||
          status === 410 ||
          status === 412
        ) {
          return;
        }

        console.error(
          "No se pudo liberar un candado temporal de Calendar:",
          error
        );
      }
    })
  );
}

async function acquireCalendarLocks(
  startsAt: Date,
  endsAt: Date
) {
  const ownerToken = randomBytes(16).toString("hex");
  const requiredLocks = buildLockBuckets(
    startsAt,
    endsAt,
    ownerToken
  );

  const acquiredLocks: CalendarLock[] = [];

  try {
    for (const lock of requiredLocks) {
      const acquired = await insertLockEvent(lock);

      if (!acquired) {
        await releaseCalendarLocks(acquiredLocks);

        return {
          ok: false as const,
          locks: [] as CalendarLock[],
        };
      }

      acquiredLocks.push(lock);
    }

    return {
      ok: true as const,
      locks: acquiredLocks,
    };
  } catch (error) {
    await releaseCalendarLocks(acquiredLocks);
    throw error;
  }
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

export async function POST(request: Request) {
  let acquiredLocks: CalendarLock[] = [];

  try {
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
        { status: 413 }
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
            { status: 413 }
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
        { status: 400 }
      );
    }

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

    // VALIDAR CLIENTE

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
        { status: 400 }
      );
    }

    const whatsappDigits =
      customerWhatsapp.replace(/\D/g, "");

    if (
      whatsappDigits.length < 10 ||
      whatsappDigits.length > 15 ||
      customerWhatsapp.length > 30 ||
      !/^[+\d\s().-]+$/.test(customerWhatsapp)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El número de WhatsApp no es válido.",
        },
        { status: 400 }
      );
    }

    // VALIDAR SERVICIO

    if (!(serviceCode in SERVICES)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El servicio seleccionado no está disponible.",
        },
        { status: 400 }
      );
    }

    const service =
      SERVICES[serviceCode as ServiceCode];

    // =====================================================
    // EXPERIENCIA PREMIUM: PRÓXIMAMENTE
    // =====================================================
    //
    // Mantenemos Premium en el catálogo, pero impedimos
    // reservarlo desde la API hasta que se active.
    // Esto protege también contra llamadas directas.
    //
    // Para activarlo en el futuro, revisaremos tanto
    // esta regla como la pantalla de selección.
    // =====================================================

    if (service.code === "premium") {
      return NextResponse.json(
        {
          ok: false,
          code: "SERVICE_NOT_AVAILABLE",
          message:
            "Experiencia Premium estará disponible próximamente.",
        },
        {
          status: 409,
        }
      );
    }

    // VALIDAR PAGO

    if (paymentMethod === "transfer") {
      return NextResponse.json(
        {
          ok: false,
          code: "PAYMENT_METHOD_UNAVAILABLE",
          message: "Transferencia bancaria estará disponible próximamente.",
        },
        { status: 409 }
      );
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El método de pago seleccionado no es válido.",
        },
        { status: 400 }
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
          { status: 400 }
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

      const receipt = formData.get("receipt");

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
          { status: 400 }
        );
      }
    }

    // VALIDAR FECHA

    if (!isValidDate(date)) {
      return NextResponse.json(
        {
          ok: false,
          message: "La fecha no es válida.",
        },
        { status: 400 }
      );
    }

    // VALIDAR HORA

    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json(
        {
          ok: false,
          message: "La hora no es válida.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_SLOTS.has(time)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La hora seleccionada no pertenece a los horarios disponibles de WAESTUDIO.",
        },
        { status: 400 }
      );
    }

    const startsAt = new Date(
      `${date}T${time}:00${VENEZUELA_OFFSET}`
    );

    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "La fecha de la reserva no es válida.",
        },
        { status: 400 }
      );
    }

    if (startsAt <= new Date()) {
      return NextResponse.json(
        {
          ok: false,
          code: "TIME_NOT_AVAILABLE",
          message:
            "Ese horario ya pasó. Selecciona otro horario.",
        },
        { status: 409 }
      );
    }

    const dateForWeekday = new Date(
      `${date}T12:00:00${VENEZUELA_OFFSET}`
    );

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
        { status: 409 }
      );
    }

    // VALIDAR HORARIO LABORAL

    const startMinutes =
      minutesFromTime(time);

    const endMinutes =
      startMinutes + service.durationMinutes;

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
        { status: 409 }
      );
    }

    const endsAt = new Date(
      startsAt.getTime() +
        service.durationMinutes * 60 * 1000
    );

    // PRIMERA COMPROBACIÓN DE DISPONIBILIDAD

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
        { status: 409 }
      );
    }

    // ADQUIRIR CANDADOS TEMPORALES

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
        { status: 409 }
      );
    }

    acquiredLocks = lockResult.locks;

    // SEGUNDA COMPROBACIÓN DE DISPONIBILIDAD

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
        { status: 409 }
      );
    }

    // CREAR CITA DEFINITIVA

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

    return NextResponse.json(
      {
        ok: true,
        source: "google-calendar",

        bookingId: calendarEvent.eventId,
        bookingCode,

        calendarEventId:
          calendarEvent.eventId,

        calendarCreated: true,

        paymentMethod: paymentMethod || null,

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
    await releaseCalendarLocks(acquiredLocks);
  }
}
