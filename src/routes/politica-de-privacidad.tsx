import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/politica-de-privacidad")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidad"
      lastUpdated="31 de octubre de 2026"
      intro={
        <>
          <p>
            En QAP ChacoNews valoramos la privacidad de las personas que visitan, leen o interactúan
            con el sitio. Esta política describe la información que podemos recopilar, cómo la
            utilizamos, con quién la compartimos, qué medidas tomamos para protegerla y cuáles son
            los derechos que asisten a las personas usuarias en relación con sus datos personales.
          </p>
        </>
      }
      sections={[
        {
          title: "Información que recopilamos",
          content: (
            <>
              <p>Podemos recopilar información de distintas formas, incluyendo:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  datos de registro y autenticación, como nombre, correo electrónico, perfil y
                  credenciales asociadas;
                </li>
                <li>
                  datos de contacto cuando se comunica con el equipo del sitio o se registran
                  formularios de consulta;
                </li>
                <li>
                  datos técnicos del dispositivo y del navegador, incluyendo dirección IP, proveedor
                  de acceso, tipo de navegador, sistema operativo y metadatos de conexión;
                </li>
                <li>
                  datos de uso del sitio, páginas visitadas, interacciones, lectura, clicks, tiempo
                  de permanencia, eventos de navegación y tiempos de lectura;
                </li>
                <li>
                  datos necesarios para comentarios, newsletter, suscripciones y gestión de perfil;
                </li>
                <li>
                  información almacenada mediante cookies, almacenamiento local o sesión del
                  navegador para funciones de seguridad, preferencias y analítica.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: "Finalidad del tratamiento",
          content: (
            <>
              <p>Usamos la información para:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>mantener el sitio, sus servicios y su seguridad;</li>
                <li>permitir el registro, acceso, autenticación y la gestión de perfil;</li>
                <li>personalizar la experiencia y recordar preferencias;</li>
                <li>mejorar contenidos, navegación y arquitectura de la información;</li>
                <li>responder consultas, comentarios y solicitudes de contacto;</li>
                <li>
                  gestiona newsletter, suscripciones y participación en la comunidad del medio;
                </li>
                <li>
                  medir uso del portal, rendimiento del contenido y analítica general del sitio;
                </li>
                <li>cumplir requisitos legales, regulatorios, de seguridad o contractuales.</li>
              </ul>
            </>
          ),
        },
        {
          title: "Base legal",
          content: (
            <>
              <p>
                Tratamos los datos con fundamento en la necesidad de prestar el servicio, la
                ejecución de obligaciones legales y contractuales, la seguridad de la plataforma, la
                gestión de usuarios y, en su caso, el consentimiento informado cuando la normativa
                así lo exija. También se considera la legítima atención a intereses del responsable
                del tratamiento para fines operativos y de seguridad.
              </p>
            </>
          ),
        },
        {
          title: "Compartición de información",
          content: (
            <>
              <p>
                QAP ChacoNews no vende sus datos personales a terceros. La información puede
                compartirse con servicios de hosting, infraestructura tecnológica, analítica,
                autenticación social, proveedores de seguridad, almacenamiento y herramientas de
                gestión del sitio, siempre bajo medidas razonables de confidencialidad,
                contractualidad y seguridad.
              </p>
              <p>
                También puede revelarse información cuando lo exija la ley, una autoridad
                competente, un procedimiento judicial, una obligación legal o una necesidad de
                protección de derechos, seguridad o integridad del servicio.
              </p>
            </>
          ),
        },
        {
          title: "Seguridad",
          content: (
            <>
              <p>
                Adoptamos medidas razonables de seguridad para proteger la información frente a
                accesos no autorizados, pérdida, uso indebido o alteración. Sin embargo, ningún
                sistema es totalmente invulnerable. Por ello, el usuario reconoce que el uso del
                sitio implica aceptar este riesgo inherente a cualquier servicio digital.
              </p>
            </>
          ),
        },
        {
          title: "Derechos del usuario",
          content: (
            <>
              <p>
                En relación con sus datos personales, el usuario puede, según el marco legal
                aplicable:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>solicitar acceso a la información que tratamos;</li>
                <li>solicitar corrección de datos inexactos o incompletos;</li>
                <li>pedir la eliminación de datos cuando proceda;</li>
                <li>oponerse o limitar el tratamiento en los supuestos previstos por la ley;</li>
                <li>solicitar la portabilidad de sus datos y ejercer derechos complementarios.</li>
              </ul>
              <p>
                Para ejercer estos derechos puede comunicarse con Ímpetus E.A.S. a través de
                direccion@impetuseas.com o por los canales de contacto visibles en el sitio.
              </p>
            </>
          ),
        },
        {
          title: "Cookies y analítica",
          content: (
            <>
              <p>
                El sitio utiliza cookies, almacenamiento local y tecnologías similares para
                funciones esenciales, rendimiento, autenticación y analítica. La información
                detallada sobre estas tecnologías está disponible en la Política de Cookies del
                sitio.
              </p>
            </>
          ),
        },
        {
          title: "Modificaciones",
          content: (
            <>
              <p>
                Esta política puede actualizarse para reflejar cambios operativos, regulatorios o de
                infraestructura. La fecha de última actualización se mantiene visible para que el
                usuario pueda conocer la versión vigente y revisar las modificaciones relevantes.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
