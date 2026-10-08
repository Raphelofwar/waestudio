
"use client";

import { useState } from "react";
import Image from "next/image";
import {
  FiDownload,
  FiShare2,
} from "react-icons/fi";

type BookingTicketProps = {
  bookingCode: string;
  customerName: string;
  serviceName: string;
  appointmentDate: Date;
  appointmentTime: string;
  priceUsd: number;
};

const GOLD = "#c5a66d";
const WHITE = "#f5f1e8";
const BACKGROUND = "#090909";

const TICKET_WIDTH = 1080;
const TICKET_HEIGHT = 1700;

function formatDate(date: Date) {
  return date.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();

  ctx.moveTo(x + radius, y);

  ctx.lineTo(
    x + width - radius,
    y
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );

  ctx.lineTo(
    x + width,
    y + height - radius
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );

  ctx.lineTo(
    x + radius,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );

  ctx.lineTo(
    x,
    y + radius
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  );

  ctx.closePath();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  minSize = 22,
  weight = "500"
) {
  let size = initialSize;

  ctx.font =
    `${weight} ${size}px Arial, sans-serif`;

  while (
    size > minSize &&
    ctx.measureText(text).width > maxWidth
  ) {
    size -= 2;

    ctx.font =
      `${weight} ${size}px Arial, sans-serif`;
  }

  return size;
}

function drawDivider(
  ctx: CanvasRenderingContext2D,
  y: number
) {
  ctx.beginPath();

  ctx.moveTo(145, y);
  ctx.lineTo(935, y);

  ctx.strokeStyle =
    "rgba(197,166,109,0.28)";

  ctx.lineWidth = 2;
  ctx.stroke();
}

async function loadLogo() {
  const logo = new window.Image();

  logo.src = "/waestudio-app-512.png";

  await logo.decode();

  return logo;
}

export default function BookingTicket({
  bookingCode,
  customerName,
  serviceName,
  appointmentDate,
  appointmentTime,
  priceUsd,
}: BookingTicketProps) {
  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const dateText =
    formatDate(appointmentDate);

  async function generateTicket(): Promise<Blob> {
    const canvas =
      document.createElement("canvas");

    canvas.width = TICKET_WIDTH;
    canvas.height = TICKET_HEIGHT;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      throw new Error(
        "No se pudo preparar la imagen del ticket."
      );
    }

    // Fondo general
    ctx.fillStyle = BACKGROUND;

    ctx.fillRect(
      0,
      0,
      TICKET_WIDTH,
      TICKET_HEIGHT
    );

    // Tarjeta principal
    drawRoundedRect(
      ctx,
      48,
      48,
      984,
      1604,
      40
    );

    ctx.fillStyle = "#111111";
    ctx.fill();

    ctx.strokeStyle =
      "rgba(197,166,109,0.45)";

    ctx.lineWidth = 3;
    ctx.stroke();

    // Logotipo
    try {
      const logo =
        await loadLogo();

      ctx.drawImage(
        logo,
        430,
        110,
        220,
        220
      );
    } catch (error) {
      console.warn(
        "No se pudo cargar el logo del ticket:",
        error
      );
    }

    // Nombre de la barbería
    ctx.textAlign = "center";

    ctx.fillStyle = GOLD;

    ctx.font =
      "600 30px Arial, sans-serif";

    ctx.fillText(
      "WAESTUDIO",
      540,
      380
    );

    ctx.fillStyle = "#8c8983";

    ctx.font =
      "22px Arial, sans-serif";

    ctx.fillText(
      "MEN'S GROOMING",
      540,
      425
    );

    drawDivider(ctx, 470);

    // Encabezado de reserva
    ctx.fillStyle = WHITE;

    ctx.font =
      "600 46px Arial, sans-serif";

    ctx.fillText(
      "CITA REGISTRADA",
      540,
      550
    );

    ctx.fillStyle = "#a7a29a";

    ctx.font =
      "24px Arial, sans-serif";

    ctx.fillText(
      "Tu código de reserva",
      540,
      617
    );

    // Recuadro del código
    drawRoundedRect(
      ctx,
      135,
      665,
      810,
      140,
      24
    );

    ctx.fillStyle =
      "rgba(197,166,109,0.09)";

    ctx.fill();

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = GOLD;

    ctx.textAlign = "center";

    fitFont(
      ctx,
      bookingCode,
      710,
      55,
      24,
      "700"
    );

    ctx.fillText(
      bookingCode,
      540,
      755
    );

    // Datos de la reserva
    const fields = [
      {
        label: "CLIENTE",
        value: customerName,
      },
      {
        label: "SERVICIO",
        value: serviceName,
      },
      {
        label: "FECHA",
        value: dateText,
      },
      {
        label: "HORA",
        value: appointmentTime,
      },
      {
        label: "PRECIO",
        value: `$${priceUsd} USD`,
      },
    ];

    const firstFieldY = 860;
    const fieldSpacing = 120;

    fields.forEach(
      (field, index) => {
        const y =
          firstFieldY +
          index * fieldSpacing;

        ctx.textAlign = "left";

        ctx.fillStyle = GOLD;

        ctx.font =
          "600 21px Arial, sans-serif";

        ctx.fillText(
          field.label,
          145,
          y
        );

        ctx.fillStyle = WHITE;

        fitFont(
          ctx,
          field.value,
          790,
          34,
          22,
          "500"
        );

        ctx.fillText(
          field.value,
          145,
          y + 48
        );
      }
    );

    // Separación inferior
    drawDivider(ctx, 1480);

    // Indicaciones del ticket
    ctx.textAlign = "center";

    ctx.fillStyle = "#a7a29a";

    ctx.font =
      "24px Arial, sans-serif";

    ctx.fillText(
      "Presenta tu código al llegar",
      540,
      1545
    );

    ctx.font =
      "20px Arial, sans-serif";

    ctx.fillText(
      "Este ticket confirma tu reserva, no el pago.",
      540,
      1590
    );

    // Exportación a PNG
    return new Promise<Blob>(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(
                  "No se pudo generar el ticket."
                )
              );
            }
          },
          "image/png",
          1
        );
      }
    );
  }

  async function downloadTicket() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const blob =
        await generateTicket();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `WAESTUDIO-${bookingCode}.png`;

      document.body.appendChild(link);

      link.click();
      link.remove();

      window.setTimeout(
        () => {
          URL.revokeObjectURL(url);
        },
        1000
      );

      setMessage(
        "El ticket está listo para guardar. Revisa las descargas de tu dispositivo."
      );
    } catch (error) {
      console.error(
        "Error descargando ticket:",
        error
      );

      setMessage(
        "No fue posible guardar el ticket."
      );
    } finally {
      setBusy(false);
    }
  }

  async function shareTicket() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const blob =
        await generateTicket();

      const file =
        new File(
          [blob],
          `WAESTUDIO-${bookingCode}.png`,
          {
            type: "image/png",
          }
        );

      const canShareFiles =
        typeof navigator.share ===
          "function" &&
        typeof navigator.canShare ===
          "function" &&
        navigator.canShare({
          files: [file],
        });

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title:
            "Mi cita en WAESTUDIO",
          text:
            `Reserva WAESTUDIO: ${bookingCode}`,
        });
      } else {
        setMessage(
          "Este dispositivo no permite compartir la imagen directamente. Usa Guardar ticket y compártela desde tu galería."
        );
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Error compartiendo ticket:",
        error
      );

      setMessage(
        "No fue posible compartir el ticket."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7">
      <div className="overflow-hidden rounded-[28px] border border-[#c5a66d]/35 bg-[#111111] p-5">

        {/* Logotipo */}
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

        {/* Código de reserva */}
        <div className="mt-6 border-t border-[#c5a66d]/20 pt-6 text-center">

          <p className="text-[10px] uppercase tracking-[0.2em] text-[#c5a66d]">
            Cita registrada
          </p>

          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#f5f1e8]">
            Tu ticket
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

        {/* Detalles de la cita */}
        <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm">

          <div className="flex justify-between gap-4">
            <span className="text-white/35">
              Cliente
            </span>

            <span className="text-right text-[#f5f1e8]">
              {customerName}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-white/35">
              Servicio
            </span>

            <span className="text-right text-[#f5f1e8]">
              {serviceName}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-white/35">
              Fecha
            </span>

            <span className="text-right capitalize text-[#f5f1e8]">
              {dateText}
            </span>
          </div>

          <div className="flex justify-between gap-4">
            <span className="text-white/35">
              Hora
            </span>

            <span className="text-right text-[#f5f1e8]">
              {appointmentTime}
            </span>
          </div>

          <div className="flex justify-between gap-4 border-t border-white/10 pt-4">
            <span className="text-white/35">
              Precio
            </span>

            <span className="font-semibold text-[#f5f1e8]">
              ${priceUsd} USD
            </span>
          </div>
        </div>

        {/* Nota informativa */}
        <p className="mt-6 border-t border-white/10 pt-4 text-center text-[10px] leading-5 text-white/35">
          Presenta tu código al llegar.
          Este ticket confirma el registro
          de tu cita, no la recepción del pago.
        </p>
      </div>

      {/* Acciones */}
      <div className="mt-4 grid grid-cols-2 gap-3">

        <button
          type="button"
          disabled={busy}
          onClick={downloadTicket}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#f5f1e8] px-3 text-xs font-semibold text-[#090909] transition active:scale-[0.97] disabled:opacity-50"
        >
          <FiDownload size={16} />
          Guardar ticket
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={shareTicket}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#c5a66d]/40 bg-[#c5a66d]/[0.06] px-3 text-xs font-semibold text-[#c5a66d] transition active:scale-[0.97] disabled:opacity-50"
        >
          <FiShare2 size={16} />
          Compartir
        </button>
      </div>

      {message && (
        <p
          role="status"
          className="mt-3 text-center text-xs leading-5 text-white/50"
        >
          {message}
        </p>
      )}
    </section>
  );
}
