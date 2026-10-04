import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

const ALLOWED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function cleanFilename(filename: string) {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .toLowerCase();
}

export async function POST(request: Request) {
  let bookingId: string | null = null;
  let receiptPath: string | null = null;

  try {
    const formData = await request.formData();

    const customerName = getText(formData, "customerName");
    const customerWhatsapp = getText(
      formData,
      "customerWhatsapp"
    );

    const serviceCode = getText(formData, "serviceCode");
    const date = getText(formData, "date");
    const time = getText(formData, "time");

    const paymentMethod = getText(
      formData,
      "paymentMethod"
    );

    const payerBank = getText(formData, "payerBank");
    const reference = getText(formData, "reference");

    const bcvRateText = getText(formData, "bcvRate");
    const bcvRate = Number(bcvRateText);

    const receipt = formData.get("receipt");

    /*
     * VALIDACIONES
     */

    if (customerName.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          message: "El nombre del cliente no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    const whatsappDigits = customerWhatsapp.replace(
      /\D/g,
      ""
    );

    if (whatsappDigits.length < 10) {
      return NextResponse.json(
        {
          ok: false,
          message: "El número de WhatsApp no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (!serviceCode) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debes seleccionar un servicio.",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          ok: false,
          message: "La fecha no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json(
        {
          ok: false,
          message: "La hora no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      paymentMethod !== "mobile" &&
      paymentMethod !== "transfer"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "El método de pago no es válido.",
        },
        {
          status: 400,
        }
      );
    }

    if (payerBank.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debes indicar el banco.",
        },
        {
          status: 400,
        }
      );
    }

    if (reference.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          message: "La referencia de pago no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (!Number.isFinite(bcvRate) || bcvRate <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "La tasa BCV no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    if (!(receipt instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Debes adjuntar el comprobante.",
        },
        {
          status: 400,
        }
      );
    }

    if (receipt.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El comprobante no puede superar los 5 MB.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "El comprobante debe ser JPG, PNG o WEBP.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * OBTENER SERVICIO REAL DESDE SUPABASE
     */

    const {
      data: service,
      error: serviceError,
    } = await supabaseAdmin
      .from("services")
      .select(
        "id, code, name, price_usd, duration_minutes, active"
      )
      .eq("code", serviceCode)
      .eq("active", true)
      .single();

    if (serviceError || !service) {
      console.error(
        "Error buscando servicio:",
        serviceError
      );

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

    const priceUsd = Number(service.price_usd);

    const priceVes = Number(
      (priceUsd * bcvRate).toFixed(2)
    );

    /*
     * HORARIO DE VENEZUELA UTC-4
     */

    const startsAt = new Date(
      `${date}T${time}:00-04:00`
    );

    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        {
          ok: false,
          message: "La fecha de la reserva no es válida.",
        },
        {
          status: 400,
        }
      );
    }

    const endsAt = new Date(
      startsAt.getTime() +
        Number(service.duration_minutes) * 60 * 1000
    );

    /*
     * CREAR RESERVA
     */

    const {
      data: booking,
      error: bookingError,
    } = await supabaseAdmin
      .from("bookings")
      .insert({
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,

        service_id: service.id,
        service_name: service.name,
        service_price_usd: priceUsd,
        service_duration_minutes:
          service.duration_minutes,

        bcv_rate: bcvRate,
        service_price_ves: priceVes,

        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id, booking_code")
      .single();

    if (bookingError || !booking) {
      console.error(
        "Error creando reserva:",
        bookingError
      );

      if (bookingError?.code === "23P01") {
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

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible registrar la reserva.",
        },
        {
          status: 500,
        }
      );
    }

    bookingId = booking.id;

    /*
     * GUARDAR COMPROBANTE
     */

    const extension =
      receipt.name.split(".").pop() || "jpg";

    const filename = cleanFilename(
      `comprobante-${Date.now()}.${extension}`
    );

    receiptPath = `${booking.id}/${filename}`;

    const fileBuffer = Buffer.from(
      await receipt.arrayBuffer()
    );

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("payment-receipts")
        .upload(receiptPath, fileBuffer, {
          contentType: receipt.type,
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Error subiendo comprobante:",
        uploadError
      );

      await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("id", booking.id);

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible guardar el comprobante.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * REGISTRAR PAGO
     */

    const { error: paymentError } =
      await supabaseAdmin.from("payments").insert({
        booking_id: booking.id,
        method: paymentMethod,
        payer_bank: payerBank,
        reference,
        amount_usd: priceUsd,
        bcv_rate: bcvRate,
        amount_ves: priceVes,
        receipt_path: receiptPath,
      });

    if (paymentError) {
      console.error(
        "Error registrando pago:",
        paymentError
      );

      await supabaseAdmin.storage
        .from("payment-receipts")
        .remove([receiptPath]);

      await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("id", booking.id);

      return NextResponse.json(
        {
          ok: false,
          message:
            "No fue posible registrar el pago.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * TODO CORRECTO
     */

    return NextResponse.json(
      {
        ok: true,
        bookingId: booking.id,
        bookingCode: booking.booking_code,
        status: "payment_reported",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Error general creando reserva:", error);

    /*
     * LIMPIEZA DE EMERGENCIA
     */

    if (receiptPath) {
      await supabaseAdmin.storage
        .from("payment-receipts")
        .remove([receiptPath]);
    }

    if (bookingId) {
      await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("id", bookingId);
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Ocurrió un error inesperado al procesar la reserva.",
      },
      {
        status: 500,
      }
    );
  }
}