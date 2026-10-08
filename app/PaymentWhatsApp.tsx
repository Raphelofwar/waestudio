
"use client";

import { useState } from "react";
import { SiWhatsapp } from "react-icons/si";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";

type PaymentWhatsAppProps = {
  customerName: string;
  customerWhatsapp: string;
  bookingCode: string | null;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  amountUsd: number;
  amountVes: number | null;
  paymentMethod: "mobile" | "transfer";
  bank: string;
  reference: string;
  receipt: File | null;
};

const WAESTUDIO_WHATSAPP = "584121237187";

export default function PaymentWhatsApp({
  customerName,
  customerWhatsapp,
  bookingCode,
  serviceName,
  appointmentDate,
  appointmentTime,
  amountUsd,
  amountVes,
  paymentMethod,
  bank,
  reference,
  receipt,
}: PaymentWhatsAppProps) {
  const [shareMessage, setShareMessage] =
    useState<string | null>(null);

  const paymentLabel =
    paymentMethod === "mobile"
      ? "Pago Móvil"
      : "Transferencia bancaria";

  const formatVes = (value: number) =>
    new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const reportText = [
    "Hola, WAESTUDIO.",
    "",
    "Quiero reportar los datos del pago de mi reserva.",
    "",
    `Código de reserva: ${bookingCode || "No disponible"}`,
    `Cliente: ${customerName}`,
    `WhatsApp: ${customerWhatsapp}`,
    `Servicio: ${serviceName}`,
    `Fecha: ${appointmentDate}`,
    `Hora: ${appointmentTime}`,
    `Monto: $${amountUsd}`,
    amountVes !== null
      ? `Equivalente: Bs. ${formatVes(amountVes)}`
      : null,
    `Método: ${paymentLabel}`,
    `Banco emisor: ${bank}`,
    `Referencia: ${reference}`,
    "",
    "Compartiré el comprobante para su verificación.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const whatsappUrl =
    `https://wa.me/${WAESTUDIO_WHATSAPP}?text=${encodeURIComponent(
      reportText
    )}`;

  async function shareReceipt() {
    setShareMessage(null);

    if (!receipt) {
      setShareMessage(
        "No hay ningún comprobante seleccionado."
      );
      return;
    }

    if (
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function" ||
      !navigator.canShare({ files: [receipt] })
    ) {
      setShareMessage(
        "Este dispositivo no permite compartir la imagen directamente. Abre WhatsApp y adjunta la captura desde tu galería."
      );
      return;
    }

    try {
      await navigator.share({
        files: [receipt],
        title: "Comprobante WAESTUDIO",
        text: bookingCode
          ? `Comprobante de pago - Reserva ${bookingCode}`
          : "Comprobante de pago WAESTUDIO",
      });

      setShareMessage(
        "Comprueba que seleccionaste el chat de WAESTUDIO y pulsaste Enviar. La aplicación no puede verificar automáticamente su recepción."
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Error al compartir comprobante:",
        error
      );

      setShareMessage(
        "No se pudo abrir el menú para compartir. Puedes adjuntar la captura manualmente en WhatsApp."
      );
    }
  }

  return (
    <section className="mt-6 rounded-[26px] border border-[#c5a66d]/25 bg-[#c5a66d]/[0.045] p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#c5a66d]">
        Verificación de pago
      </p>

      <h3 className="mt-3 text-lg font-medium text-[#f5f1e8]">
        Envía tu comprobante
      </h3>

      <p className="mt-2 text-xs leading-5 text-white/45">
        Tu cita ya tiene un código de reserva.
        Para verificar el pago, envía sus datos
        y la captura a nuestro WhatsApp oficial.
      </p>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#c5a66d] px-4 text-center text-xs font-semibold text-[#090909] transition active:scale-[0.98]"
      >
        <SiWhatsapp size={18} />
        Enviar datos por WhatsApp
      </a>

      <button
        type="button"
        onClick={shareReceipt}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#c5a66d]/35 bg-[#c5a66d]/[0.055] px-4 text-xs font-medium text-[#c5a66d] transition active:scale-[0.98]"
      >
        <ShareRoundedIcon sx={{ fontSize: 19 }} />
        Compartir comprobante
      </button>

      {shareMessage && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-[11px] leading-5 text-white/60"
        >
          {shareMessage}
        </p>
      )}

      <p className="mt-4 border-t border-white/10 pt-4 text-[10px] leading-5 text-white/35">
        En el menú de compartir, selecciona
        WhatsApp y el chat de WAESTUDIO.
        Debes confirmar el envío; seleccionar
        una captura no significa que se haya
        recibido ni verificado el pago.
      </p>
    </section>
  );
}
