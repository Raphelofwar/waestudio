
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { FiDownload } from "react-icons/fi";
import { SiWhatsapp } from "react-icons/si";

type BookingTicketProps = {
  bookingCode: string;
  customerName: string;
  serviceName: string;
  appointmentDate: Date;
  appointmentTime: string;
  priceUsd: number;

  customerWhatsapp?: string;
  paymentMethod?: "mobile" | "cash" | "transfer" | null;
  cashCurrency?: string | null;
  payerBank?: string;
  paymentReference?: string;
  bcvRate?: number | null;
  amountVes?: number | null;
};

type TicketData = Omit<
  BookingTicketProps,
  "appointmentDate"
> & {
  dateText: string;
};

type TicketField = {
  label: string;
  value: string;
};

const BARBER_WHATSAPP = "584121237187";

const GOLD = "#c5a66d";
const WHITE = "#f5f1e8";
const BACKGROUND = "#090909";

const TICKET_WIDTH = 1080;

function formatDate(date: Date) {
  return date.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatUsd(amount: number) {
  return `$${amount.toFixed(2)} USD`;
}

function formatVes(amount: number) {
  return `Bs. ${amount.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPaymentLabel(data: TicketData) {
  if (data.paymentMethod === "mobile") {
    return "Pago Móvil";
  }

  if (data.paymentMethod === "cash") {
    return data.cashCurrency
      ? `Efectivo ${data.cashCurrency}`
      : "Efectivo";
  }

  if (data.paymentMethod === "transfer") {
    return "Transferencia";
  }

  return null;
}

function getAmountVes(data: TicketData) {
  if (
    typeof data.amountVes === "number" &&
    Number.isFinite(data.amountVes) &&
    data.amountVes > 0
  ) {
    return data.amountVes;
  }

  if (
    typeof data.bcvRate === "number" &&
    Number.isFinite(data.bcvRate) &&
    data.bcvRate > 0
  ) {
    return data.priceUsd * data.bcvRate;
  }

  return null;
}

function buildFields(data: TicketData): TicketField[] {
  const fields: TicketField[] = [
    {
      label: "CLIENTE",
      value: data.customerName,
    },
  ];

  if (data.customerWhatsapp?.trim()) {
    fields.push({
      label: "TELÉFONO",
      value: data.customerWhatsapp.trim(),
    });
  }

  fields.push(
    {
      label: "SERVICIO",
      value: data.serviceName,
    },
    {
      label: "FECHA",
      value: data.dateText,
    },
    {
      label: "HORA",
      value: data.appointmentTime,
    },
    {
      label: "PRECIO",
      value: formatUsd(data.priceUsd),
    }
  );

  const paymentLabel = getPaymentLabel(data);

  if (paymentLabel) {
    fields.push({
      label: "MÉTODO DE PAGO",
      value: paymentLabel,
    });
  }

  if (data.paymentMethod === "mobile") {
    const amountVes = getAmountVes(data);

    if (amountVes !== null) {
      fields.push({
        label: "MONTO EN BOLÍVARES",
        value: formatVes(amountVes),
      });
    }

    if (data.payerBank?.trim()) {
      fields.push({
        label: "BANCO DEL CLIENTE",
        value: data.payerBank.trim(),
      });
    }

    if (data.paymentReference?.trim()) {
      fields.push({
        label: "REFERENCIA REPORTADA",
        value: data.paymentReference.trim(),
      });
    }
  }

  return fields;
}

function buildWhatsAppMessage(data: TicketData) {
  const fields = buildFields(data);

  const lines = [
    "✂️ WAESTUDIO | NUEVA RESERVA",
    "",
    ...fields.map(
      (field) => `${field.label}: ${field.value}`
    ),
    "",
    `CÓDIGO DE CITA: ${data.bookingCode}`,
    "",
    "Cita registrada en WAESTUDIO.",
  ];

  return lines.join("\n");
}

function getWhatsAppUrl(data: TicketData) {
  return (
    `https://wa.me/${BARBER_WHATSAPP}?text=` +
    encodeURIComponent(
      buildWhatsAppMessage(data)
    )
  );
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function divider(
  ctx: CanvasRenderingContext2D,
  y: number
) {
  ctx.beginPath();
  ctx.moveTo(145, y);
  ctx.lineTo(935, y);
  ctx.strokeStyle = "rgba(197,166,109,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  preferredSize: number,
  weight = "500"
) {
  let size = preferredSize;

  while (size > 21) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;

    if (ctx.measureText(text).width <= width) {
      break;
    }

    size -= 2;
  }

  ctx.fillText(text, x, y, width);
}

async function createTicketFile(
  data: TicketData
): Promise<File> {
  const fields = buildFields(data);

  const footerY = Math.max(
    1480,
    860 + (fields.length - 1) * 118 + 140
  );

  const height = footerY + 220;

  const canvas = document.createElement("canvas");
  canvas.width = TICKET_WIDTH;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "No se pudo generar el comprobante."
    );
  }

  // Fondo
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, TICKET_WIDTH, height);

  // Tarjeta principal
  roundedRect(
    ctx,
    48,
    48,
    984,
    height - 96,
    40
  );

  ctx.fillStyle = "#111111";
  ctx.fill();

  ctx.strokeStyle = "rgba(197,166,109,0.45)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Logo
  try {
    const logo = new window.Image();
    logo.src = "/waestudio-app-512.png";
    await logo.decode();

    ctx.drawImage(
      logo,
      430,
      110,
      220,
      220
    );
  } catch (error) {
    console.warn(
      "No se pudo cargar el logo:",
      error
    );
  }

  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillText("WAESTUDIO", 540, 380);

  ctx.fillStyle = "#8c8983";
  ctx.font = "22px Arial, sans-serif";
  ctx.fillText("MEN'S GROOMING", 540, 425);

  divider(ctx, 470);

  ctx.fillStyle = WHITE;
  ctx.font = "600 46px Arial, sans-serif";
  ctx.fillText(
    "CITA REGISTRADA",
    540,
    550
  );

  ctx.fillStyle = "#a7a29a";
  ctx.font = "24px Arial, sans-serif";
  ctx.fillText(
    "Tu código de reserva",
    540,
    617
  );

  roundedRect(
    ctx,
    135,
    665,
    810,
    140,
    24
  );

  ctx.fillStyle = "rgba(197,166,109,0.09)";
  ctx.fill();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.textAlign = "center";

  drawFittedText(
    ctx,
    data.bookingCode,
    540,
    755,
    710,
    55,
    "700"
  );

  // Datos de la cita
  fields.forEach((field, index) => {
    const y = 860 + index * 118;

    ctx.textAlign = "left";
    ctx.fillStyle = GOLD;
    ctx.font = "600 21px Arial, sans-serif";
    ctx.fillText(
      field.label,
      145,
      y
    );

    ctx.fillStyle = WHITE;

    drawFittedText(
      ctx,
      field.value,
      145,
      y + 48,
      790,
      34
    );
  });

  // Pie del comprobante
  divider(ctx, footerY);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a7a29a";
  ctx.font = "24px Arial, sans-serif";

  ctx.fillText(
    "Presenta tu código al llegar",
    540,
    footerY + 65
  );

  ctx.font = "20px Arial, sans-serif";

  ctx.fillText(
    "Este comprobante confirma la cita, no el pago.",
    540,
    footerY + 115
  );

  const blob = await new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(
              new Error(
                "No se pudo preparar la imagen PNG."
              )
            );
          }
        },
        "image/png",
        1
      );
    }
  );

  return new File(
    [blob],
    `WAESTUDIO-${data.bookingCode}.png`,
    {
      type: "image/png",
    }
  );
}

function saveTicket(file: File) {
  const url = URL.createObjectURL(file);

  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
}

export default function BookingTicket({
  bookingCode,
  customerName,
  serviceName,
  appointmentDate,
  appointmentTime,
  priceUsd,
  customerWhatsapp,
  paymentMethod,
  cashCurrency,
  payerBank,
  paymentReference,
  bcvRate,
  amountVes,
}: BookingTicketProps) {
  const [ticketFile, setTicketFile] =
    useState<File | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const dateText = formatDate(appointmentDate);

  const data: TicketData = {
    bookingCode,
    customerName,
    serviceName,
    dateText,
    appointmentTime,
    priceUsd,
    customerWhatsapp,
    paymentMethod,
    cashCurrency,
    payerBank,
    paymentReference,
    bcvRate,
    amountVes,
  };

  const fields = buildFields(data);

  // Preparar la imagen al mostrar la reserva.
  // Así el botón de compartir puede abrir
  // inmediatamente el menú del teléfono.
  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      setTicketFile(null);

      try {
        const file = await createTicketFile({
          bookingCode,
          customerName,
          serviceName,
          dateText,
          appointmentTime,
          priceUsd,
          customerWhatsapp,
          paymentMethod,
          cashCurrency,
          payerBank,
          paymentReference,
          bcvRate,
          amountVes,
        });

        if (!cancelled) {
          setTicketFile(file);
        }
      } catch (error) {
        console.error(
          "Error preparando comprobante:",
          error
        );

        if (!cancelled) {
          setMessage(
            "No se pudo preparar el comprobante."
          );
        }
      }
    }

    void prepare();

    return () => {
      cancelled = true;
    };
  }, [
    bookingCode,
    customerName,
    serviceName,
    dateText,
    appointmentTime,
    priceUsd,
    customerWhatsapp,
    paymentMethod,
    cashCurrency,
    payerBank,
    paymentReference,
    bcvRate,
    amountVes,
  ]);

  function downloadTicket() {
    if (!ticketFile || busy) {
      return;
    }

    try {
      saveTicket(ticketFile);

      setMessage(
        "Comprobante preparado. Revisa las descargas de tu dispositivo."
      );
    } catch (error) {
      console.error(
        "Error descargando comprobante:",
        error
      );

      setMessage(
        "No fue posible descargar el comprobante."
      );
    }
  }

  function openWhatsAppFallback(file: File) {
    // Descargar la imagen para adjuntarla
    // manualmente en dispositivos sin Web Share.
    saveTicket(file);

    setMessage(
      "Adjunta en WhatsApp la imagen PNG que se descargó."
    );

    window.location.assign(
      getWhatsAppUrl(data)
    );
  }

  async function sendToBarber() {
    if (!ticketFile || busy) {
      return;
    }

    const file = ticketFile;

    const canShareImage =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [file],
      });

    // Alternativa para dispositivos sin
    // capacidad de compartir archivos PNG.
    if (!canShareImage) {
      openWhatsAppFallback(file);
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await navigator.share({
        files: [file],
        title: "WAESTUDIO | Comprobante de cita",
        text: [
          buildWhatsAppMessage(data),
          "",
          "Enviar al WhatsApp del barbero:",
          "+58 412-1237187",
        ].join("\n"),
      });

      setMessage(
        "Comprueba que hayas enviado el comprobante al WhatsApp del barbero."
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setMessage(
          "Se cerró la opción de compartir. Puedes intentarlo nuevamente."
        );
      } else {
        console.error(
          "Error compartiendo comprobante:",
          error
        );

        setMessage(
          "No se pudo compartir la imagen. Puedes descargarla y enviarla manualmente por WhatsApp."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7">
      <div className="overflow-hidden rounded-[28px] border border-[#c5a66d]/35 bg-[#111111] p-5">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="relative h-20 w-20">
            <Image
              src="/waestudio-app-512.png"
              alt="Logo de WAESTUDIO"
              fill
              sizes="80px"
              className="object-contain"
            />
          </div>

          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c5a66d]">
            WAESTUDIO
          </p>

          <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-white/35">
            Men&apos;s Grooming
          </p>
        </div>

        {/* Código */}
        <div className="mt-6 border-t border-[#c5a66d]/20 pt-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#c5a66d]">
            Cita registrada
          </p>

          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#f5f1e8]">
            Tu comprobante
          </h3>

          <p className="mt-2 text-xs text-white/40">
            Código de reserva
          </p>

          <div className="mt-4 rounded-2xl border border-[#c5a66d]/40 bg-[#c5a66d]/[0.08] px-4 py-4">
            <p className="break-all text-xl font-bold tracking-[0.08em] text-[#c5a66d]">
              {bookingCode}
            </p>
          </div>
        </div>

        {/* Información */}
        <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex justify-between gap-4"
            >
              <span className="shrink-0 text-white/35">
                {field.label}
              </span>

              <span className="min-w-0 break-words text-right text-[#f5f1e8]">
                {field.value}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 border-t border-white/10 pt-4 text-center text-[10px] leading-5 text-white/35">
          Presenta tu código al llegar.
          Este comprobante confirma el registro
          de tu cita, no el pago.
        </p>
      </div>

      {/* Únicamente dos botones */}
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          disabled={busy || !ticketFile}
          onClick={downloadTicket}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#f5f1e8] px-4 text-sm font-semibold text-[#090909] transition active:scale-[0.97] disabled:opacity-50"
        >
          <FiDownload size={18} />
          Descargar comprobante
        </button>

        <button
          type="button"
          disabled={busy || !ticketFile}
          onClick={sendToBarber}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#c5a66d] px-4 text-sm font-semibold text-[#090909] transition active:scale-[0.97] disabled:opacity-50"
        >
          <SiWhatsapp size={20} />
          Enviar al barbero por WhatsApp
        </button>
      </div>

      <p className="mt-3 text-center text-[11px] leading-5 text-white/40">
        Selecciona WhatsApp y envía la imagen
        al barbero: 0412-1237187.
      </p>

      {!ticketFile && !message && (
        <p className="mt-3 text-center text-xs text-white/40">
          Preparando comprobante...
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-3 text-center text-xs leading-5 text-white/60"
        >
          {message}
        </p>
      )}
    </section>
  );
}
