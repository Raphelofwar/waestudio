import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * Estados que NO deben bloquear un horario.
 *
 * Si posteriormente agregamos nuevos estados de cancelación,
 * podemos incluirlos aquí.
 */
const INACTIVE_BOOKING_STATUSES = new Set([
  "cancelled",
  "canceled",
  "cancelada",
  "rejected",
  "rechazada",
]);

type ServiceRow = {
  id: string;
  code: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

type BookingRow = {
  starts_at: string;
  ends_at: string;
  status: string;
};

type BlockedPeriodRow = {
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function localDateTime(
  date: string,
  time: string
) {
  /*
   * Venezuela utiliza UTC-4.
   */
  return new Date(
    `${date}T${time}:00-04:00`
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
        `${date}T12:00:00-04:00`
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
     */

    const {
      data: workingHours,
      error: workingHoursError,
    } = await supabaseAdmin
      .from("working_hours")
      .select(
        "weekday, is_open, open_time, close_time"
      )
      .eq("weekday", weekday)
      .single();

    if (
      workingHoursError ||
      !workingHours
    ) {
      console.error(
        "Error consultando working_hours:",
        workingHoursError
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible consultar el horario del negocio.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * DÍA CERRADO
     */

    if (
      !workingHours.is_open ||
      !workingHours.open_time ||
      !workingHours.close_time
    ) {
      return NextResponse.json({
        ok: true,
        date,
        weekday,
        isOpen: false,
        openTime: null,
        closeTime: null,
        slots: [],
      });
    }

    const openTime =
      String(
        workingHours.open_time
      ).slice(0, 5);

    const closeTime =
      String(
        workingHours.close_time
      ).slice(0, 5);

    /*
     * SERVICIOS ACTIVOS
     */

    const {
      data: servicesData,
      error: servicesError,
    } = await supabaseAdmin
      .from("services")
      .select(
        "id, code, name, duration_minutes, active"
      )
      .eq("active", true);

    if (servicesError) {
      console.error(
        "Error consultando servicios:",
        servicesError
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible consultar los servicios.",
        },
        {
          status: 500,
        }
      );
    }

    const services =
      (servicesData ||
        []) as ServiceRow[];

    /*
     * RANGO COMPLETO DEL DÍA EN VENEZUELA
     */

    const dayStart =
      new Date(
        `${date}T00:00:00-04:00`
      );

    const dayEnd =
      new Date(
        `${date}T23:59:59.999-04:00`
      );

    /*
     * RESERVAS EXISTENTES
     */

    const {
      data: bookingsData,
      error: bookingsError,
    } = await supabaseAdmin
      .from("bookings")
      .select(
        "starts_at, ends_at, status"
      )
      .lt(
        "starts_at",
        dayEnd.toISOString()
      )
      .gt(
        "ends_at",
        dayStart.toISOString()
      );

    if (bookingsError) {
      console.error(
        "Error consultando reservas:",
        bookingsError
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible consultar las reservas existentes.",
        },
        {
          status: 500,
        }
      );
    }

    const bookings =
      (
        (bookingsData ||
          []) as BookingRow[]
      ).filter(
        (booking) =>
          !INACTIVE_BOOKING_STATUSES.has(
            booking.status
          )
      );

    /*
     * BLOQUEOS MANUALES
     */

    const {
      data: blockedData,
      error: blockedError,
    } = await supabaseAdmin
      .from("blocked_periods")
      .select(
        "starts_at, ends_at, reason"
      )
      .lt(
        "starts_at",
        dayEnd.toISOString()
      )
      .gt(
        "ends_at",
        dayStart.toISOString()
      );

    if (blockedError) {
      console.error(
        "Error consultando bloqueos:",
        blockedError
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible consultar los bloqueos de horario.",
        },
        {
          status: 500,
        }
      );
    }

    const blockedPeriods =
      (blockedData ||
        []) as BlockedPeriodRow[];

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
            services.filter(
              (service) => {
                const duration =
                  Number(
                    service.duration_minutes
                  );

                const serviceEndMinutes =
                  slotMinutes +
                  duration;

                /*
                 * El servicio debe terminar antes
                 * del cierre.
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
                 * Comprobar reservas existentes.
                 */
                const bookingConflict =
                  bookings.some(
                    (booking) => {
                      const bookingStart =
                        new Date(
                          booking.starts_at
                        );

                      const bookingEnd =
                        new Date(
                          booking.ends_at
                        );

                      return overlaps(
                        slotStart,
                        serviceEnd,
                        bookingStart,
                        bookingEnd
                      );
                    }
                  );

                if (
                  bookingConflict
                ) {
                  return false;
                }

                /*
                 * Comprobar bloqueos manuales.
                 */
                const blockedConflict =
                  blockedPeriods.some(
                    (period) => {
                      const blockedStart =
                        new Date(
                          period.starts_at
                        );

                      const blockedEnd =
                        new Date(
                          period.ends_at
                        );

                      return overlaps(
                        slotStart,
                        serviceEnd,
                        blockedStart,
                        blockedEnd
                      );
                    }
                  );

                return !blockedConflict;
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

        date,

        weekday,

        isOpen: true,

        openTime,
        closeTime,

        slots,

        bookingsCount:
          bookings.length,

        blockedPeriodsCount:
          blockedPeriods.length,
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
      "Error general consultando disponibilidad:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Ocurrió un error inesperado al consultar la disponibilidad.",
      },
      {
        status: 500,
      }
    );
  }
}