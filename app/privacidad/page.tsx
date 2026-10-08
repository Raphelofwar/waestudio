
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad | WAESTUDIO",
  description:
    "Información sobre la privacidad y el tratamiento de datos en WAESTUDIO.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#090909] px-5 py-10 text-[#f5f1e8]">
      <article className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-[#c5a66d]"
        >
          ← Volver a WAESTUDIO
        </Link>

        <h1 className="mt-10 text-3xl font-semibold">
          Política de privacidad
        </h1>

        <p className="mt-3 text-sm text-white/50">
          Última actualización: 8 de octubre de 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-white/75">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              1. Información general
            </h2>
            <p>
              WAESTUDIO es una plataforma digital que permite
              a los clientes consultar horarios disponibles
              y reservar servicios de barbería.
              Esta política explica cómo utilizamos
              la información proporcionada durante
              el proceso de reserva.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              2. Información recopilada
            </h2>
            <p>
              Para gestionar una cita, podemos solicitar
              el nombre del cliente, número de teléfono,
              servicio seleccionado, fecha, hora
              y modalidad de pago.
            </p>
            <p className="mt-3">
              Cuando el cliente selecciona un pago
              electrónico, también puede proporcionar
              información de referencia y compartir
              voluntariamente su comprobante mediante
              WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              3. Uso de la información
            </h2>
            <p>
              Utilizamos los datos necesarios para
              registrar y organizar citas, gestionar
              disponibilidad, identificar reservas,
              comunicarnos con los clientes y verificar
              manualmente los pagos cuando corresponda.
            </p>
            <p className="mt-3">
              No vendemos la información personal de
              los clientes ni utilizamos los datos
              obtenidos de Google Calendar para
              publicidad personalizada.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              4. Integración con Google Calendar
            </h2>
            <p>
              WAESTUDIO utiliza Google Calendar,
              autorizado por el responsable del negocio,
              para consultar la disponibilidad de
              horarios y registrar las citas.
            </p>
            <p className="mt-3">
              El acceso al calendario se utiliza
              exclusivamente para la gestión de la
              agenda de la barbería y no requiere
              que los clientes conecten sus propias
              cuentas de Google.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              5. Pagos y comprobantes
            </h2>
            <p>
              WAESTUDIO no realiza una verificación
              bancaria automática de los pagos.
              Los comprobantes que el cliente decide
              compartir por WhatsApp son revisados
              directamente por el responsable del negocio.
            </p>
            <p className="mt-3">
              La aplicación no guarda las imágenes
              de los comprobantes en una base de
              datos propia.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              6. Servicios de terceros
            </h2>
            <p>
              Para su funcionamiento, WAESTUDIO
              utiliza servicios tecnológicos como
              Google Calendar, infraestructura de
              alojamiento web y WhatsApp cuando
              el cliente decide compartir información
              por esa vía.
            </p>
            <p className="mt-3">
              Estos servicios pueden procesar datos
              conforme a sus propias políticas
              de privacidad.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              7. Conservación y protección
            </h2>
            <p>
              La información se conserva durante
              el tiempo necesario para gestionar
              las reservas y cumplir las obligaciones
              aplicables.
              Procuramos limitar el acceso a los datos
              al personal autorizado para administrar
              la agenda.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              8. Derechos del cliente
            </h2>
            <p>
              Los clientes pueden comunicarse con
              WAESTUDIO para solicitar información
              sobre sus datos personales, así como
              su corrección o eliminación cuando
              corresponda.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#c5a66d]">
              9. Contacto
            </h2>
            <p>
              Para consultas relacionadas con
              privacidad y reservas, puedes
              comunicarte con WAESTUDIO por WhatsApp.
            </p>
            <a
              href="https://wa.me/584121237187"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-semibold text-[#c5a66d] underline underline-offset-4"
            >
              Contactar a WAESTUDIO
            </a>
          </section>
        </div>

        <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/35">
          © WAESTUDIO · Privacidad y protección de datos
        </footer>
      </article>
    </main>
  );
}
