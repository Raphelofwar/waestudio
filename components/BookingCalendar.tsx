"use client";

import { useMemo, useState } from "react";

type BookingCalendarProps = {
  onContinuar: (fecha: Date, hora: string) => void;
};

const horarios = [
  "9:00 AM",
  "9:45 AM",
  "10:30 AM",
  "11:15 AM",
  "2:00 PM",
  "2:45 PM",
  "3:30 PM",
  "4:15 PM",
  "5:00 PM",
];

const meses = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const diasSemana = ["D", "L", "M", "M", "J", "V", "S"];

export default function BookingCalendar({
  onContinuar,
}: BookingCalendarProps) {
  const hoy = new Date();

  const [mesActual, setMesActual] = useState(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );

  const [fechaSeleccionada, setFechaSeleccionada] =
    useState<Date | null>(null);

  const [horaSeleccionada, setHoraSeleccionada] =
    useState<string | null>(null);

  const dias = useMemo(() => {
    const year = mesActual.getFullYear();
    const month = mesActual.getMonth();

    const primerDia = new Date(year, month, 1).getDay();
    const totalDias = new Date(year, month + 1, 0).getDate();

    const calendario: Array<number | null> = [];

    for (let i = 0; i < primerDia; i++) {
      calendario.push(null);
    }

    for (let dia = 1; dia <= totalDias; dia++) {
      calendario.push(dia);
    }

    return calendario;
  }, [mesActual]);

  function esPasado(dia: number) {
    const fecha = new Date(
      mesActual.getFullYear(),
      mesActual.getMonth(),
      dia
    );

    const hoyNormalizado = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate()
    );

    return fecha < hoyNormalizado;
  }

  function esDomingo(dia: number) {
    return (
      new Date(
        mesActual.getFullYear(),
        mesActual.getMonth(),
        dia
      ).getDay() === 0
    );
  }

  function seleccionarDia(dia: number) {
    if (esPasado(dia) || esDomingo(dia)) return;

    setFechaSeleccionada(
      new Date(
        mesActual.getFullYear(),
        mesActual.getMonth(),
        dia
      )
    );

    setHoraSeleccionada(null);
  }

  function cambiarMes(direccion: number) {
    setMesActual(
      new Date(
        mesActual.getFullYear(),
        mesActual.getMonth() + direccion,
        1
      )
    );

    setFechaSeleccionada(null);
    setHoraSeleccionada(null);
  }

  function continuar() {
    if (!fechaSeleccionada || !horaSeleccionada) return;

    onContinuar(fechaSeleccionada, horaSeleccionada);
  }

  return (
    <section
      id="fecha"
      className="min-h-[100svh] scroll-mt-0 border-t border-white/10 px-5 pb-24 pt-14 sm:px-7 lg:px-10"
    >
      <p className="text-[10px] uppercase tracking-[0.35em] text-[#c5a66d]">
        Tu reserva
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="h-1.5 w-10 rounded-full bg-[#c5a66d]" />
        <span className="h-1.5 w-10 rounded-full bg-[#c5a66d]" />
        <span className="h-1.5 w-10 rounded-full bg-white/10" />
        <span className="h-1.5 w-10 rounded-full bg-white/10" />
      </div>

      <p className="mt-5 text-[10px] uppercase tracking-[0.25em] text-white/25">
        Paso 2 de 4
      </p>

      <h2 className="mt-3 text-4xl font-medium tracking-[-0.04em]">
        Elige cuándo
        <br />
        <span className="text-white/30">quieres venir.</span>
      </h2>

      {/* CALENDARIO */}
      <div className="mt-10 rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/50 transition active:scale-95"
          >
            ←
          </button>

          <div className="text-center">
            <p className="text-lg font-medium">
              {meses[mesActual.getMonth()]}
            </p>

            <p className="mt-1 text-[10px] tracking-[0.2em] text-white/30">
              {mesActual.getFullYear()}
            </p>
          </div>

          <button
            type="button"
            onClick={() => cambiarMes(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/50 transition active:scale-95"
          >
            →
          </button>
        </div>

        <div className="mt-7 grid grid-cols-7 gap-1.5">
          {diasSemana.map((dia, index) => (
            <div
              key={`${dia}-${index}`}
              className="flex h-8 items-center justify-center text-[10px] text-white/25"
            >
              {dia}
            </div>
          ))}

          {dias.map((dia, index) => {
            if (!dia) {
              return <div key={`vacio-${index}`} />;
            }

            const pasado = esPasado(dia);
            const domingo = esDomingo(dia);

            const seleccionado =
              fechaSeleccionada?.getDate() === dia &&
              fechaSeleccionada?.getMonth() === mesActual.getMonth() &&
              fechaSeleccionada?.getFullYear() === mesActual.getFullYear();

            const disponible = !pasado && !domingo;

            return (
              <button
                type="button"
                key={dia}
                disabled={!disponible}
                onClick={() => seleccionarDia(dia)}
                className={`aspect-square rounded-full text-xs transition ${
                  seleccionado
                    ? "bg-[#c5a66d] font-semibold text-[#090909]"
                    : disponible
                      ? "border border-white/10 bg-white/[0.025] text-white/70 active:scale-90"
                      : "text-white/15"
                }`}
              >
                {dia}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-4 border-t border-white/10 pt-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c5a66d]" />

            <span className="text-[10px] text-white/30">
              Seleccionado
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/10" />

            <span className="text-[10px] text-white/30">
              Disponible
            </span>
          </div>
        </div>
      </div>

      {/* HORARIOS */}
      {fechaSeleccionada && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/25">
            Horarios disponibles
          </p>

          <p className="mt-2 text-lg capitalize">
            {fechaSeleccionada.toLocaleDateString("es-VE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {horarios.map((hora) => {
              const seleccionado =
                horaSeleccionada === hora;

              return (
                <button
                  type="button"
                  key={hora}
                  onClick={() => setHoraSeleccionada(hora)}
                  className={`min-h-12 rounded-xl border text-[12px] transition active:scale-95 ${
                    seleccionado
                      ? "border-[#c5a66d] bg-[#c5a66d] font-semibold text-[#090909]"
                      : "border-white/10 bg-white/[0.025] text-white/60"
                  }`}
                >
                  {hora}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* RESUMEN DE HORARIO */}
      {fechaSeleccionada && horaSeleccionada && (
        <div className="mt-8 rounded-[26px] border border-[#c5a66d]/30 bg-[#c5a66d]/[0.06] p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#c5a66d]">
            Tu horario
          </p>

          <div className="mt-4 flex items-end justify-between gap-5">
            <div>
              <p className="text-xl font-medium capitalize">
                {fechaSeleccionada.toLocaleDateString("es-VE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>

              <p className="mt-2 text-sm text-white/40">
                {horaSeleccionada}
              </p>
            </div>

            <span className="text-xl text-[#c5a66d]">✓</span>
          </div>

          <button
            type="button"
            onClick={continuar}
            className="mt-7 min-h-14 w-full rounded-full bg-[#f5f1e8] px-6 text-sm font-semibold text-[#090909] transition active:scale-[0.98]"
          >
            Continuar
          </button>
        </div>
      )}
    </section>
  );
}