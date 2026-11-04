import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalPage
      title="Política de Cookies"
      lastUpdated="31 de octubre de 2026"
      intro={
        <>
          <p>
            En QAP ChacoNews utilizamos cookies y tecnologías similares para mejorar la experiencia
            de lectura, mantener la seguridad del sitio, recordar preferencias, facilitar el acceso
            a funciones de la web, gestionar autenticación y analizar el uso del portal. Esta
            política explica qué son, qué tipos usamos, para qué los utilizamos y cómo puede
            gestionarlos.
          </p>
        </>
      }
      sections={[
        {
          title: "Qué son las cookies",
          content: (
            <>
              <p>
                Las cookies son pequeños archivos de texto que se almacenan en el navegador o
                dispositivo cuando se visita una página web. Permiten reconocer al usuario, recordar
                configuraciones, guardar información de sesión y facilitar la navegación del sitio.
              </p>
              <p>
                El sitio puede además utilizar tecnologías equivalentes a las cookies, como
                almacenamiento local y de sesión en el navegador, para mantener preferencias,
                estados de autenticación y medidas de seguridad. En ningún caso la utilización de
                estas tecnologías implica acceso ilegítimo a datos ajenos a la información técnica
                necesaria para prestar el servicio y cumplir con requisitos operativos.
              </p>
            </>
          ),
        },
        {
          title: "Tipos de cookies que usamos",
          content: (
            <>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong>Cookies esenciales:</strong> permiten el funcionamiento básico del sitio,
                  la navegación, la seguridad, la gestión de sesiones, la autenticación y el
                  mantenimiento de la experiencia de usuario.
                </li>
                <li>
                  <strong>Cookies funcionales:</strong> recuerdan preferencias como modo visual,
                  ajustes de visualización, historial mínimo de interacción o configuración del
                  sitio.
                </li>
                <li>
                  <strong>Cookies analíticas:</strong> permiten medir tráfico, páginas visitadas,
                  tiempos de lectura, interacciones con contenidos, eventos relevantes y rendimiento
                  general del portal. En la práctica, el sitio puede utilizar analítica de terceros,
                  incluida Google Analytics, para comprender el uso del medio.
                </li>
                <li>
                  <strong>Cookies de autenticación y seguridad:</strong> se usan para mantener
                  sesiones, recordar identidades de usuario, prevenir accesos no autorizados y
                  administrar registros de comentarios, newsletter y perfil.
                </li>
                <li>
                  <strong>Almacenamiento local y de sesión:</strong> el sitio puede guardar
                  información en localStorage y sessionStorage para consentimiento, autenticación,
                  preferencias visuales y control de eventos repetidos.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: "Finalidad del uso",
          content: (
            <>
              <p>Utilizamos cookies y tecnologías similares para:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>mantener el sitio estable y funcional;</li>
                <li>recordar ajustes de navegación y preferencias del usuario;</li>
                <li>
                  permitir el inicio de sesión, la gestión de perfil y la participación en
                  comentarios;
                </li>
                <li>analizar visitas, tráfico, tiempos de lectura y engagement del contenido;</li>
                <li>medir la efectividad de noticias, secciones y campañas editoriales;</li>
                <li>prevenir usos abusivos, accesos no autorizados y fraudes;</li>
                <li>cumplir con requisitos legales y operativos del servicio.</li>
              </ul>
            </>
          ),
        },
        {
          title: "Autenticación, suscripciones y comentarios",
          content: (
            <>
              <p>
                Si accede a funciones con cuenta, perfil, comentarios o newsletter, pueden usarse
                cookies y almacenamiento local para recordar su sesión, su identidad, su suscripción
                o su consentimiento. Estas tecnologías se emplean para que la experiencia del sitio
                sea coherente y segura.
              </p>
              <p>
                QAP ChacoNews no vende datos personales ni crea perfiles publicitarios invasivos con
                fines de comercialización no relacionada con la operación del servicio. En todo
                caso, la información puede ser tratada por proveedores tecnológicos de hosting,
                autenticación, analítica y almacenamiento, conforme a lo descrito en la Política de
                Privacidad.
              </p>
            </>
          ),
        },
        {
          title: "Cómo gestionar o rechazar cookies",
          content: (
            <>
              <p>
                Puede configurar su navegador para aceptar, rechazar o eliminar cookies. La mayoría
                de los navegadores permiten gestionar estas opciones desde la sección de
                configuración de privacidad o seguridad.
              </p>
              <p>
                Si desactiva cookies esenciales, es posible que algunas funciones del sitio no
                funcionen de forma óptima. Si bloquea cookies analíticas o funcionales, la
                experiencia puede cambiar, pero no se verá necesariamente afectada la lectura básica
                del contenido.
              </p>
              <p>
                También puede eliminar cookies ya almacenadas desde la configuración del navegador.
                Tenga en cuenta que la desactivación parcial o total puede requerir iniciar sesión
                nuevamente o restablecer algunos ajustes de visualización.
              </p>
            </>
          ),
        },
        {
          title: "Periodo de conservación",
          content: (
            <>
              <p>
                Las cookies y tecnologías similares se conservan durante el tiempo necesario para
                cumplir la finalidad para la que fueron creadas, o durante el plazo legalmente
                permitido. Algunas expiran al cerrar el navegador o al cumplirse un período
                determinado; otras pueden permanecer durante más tiempo para recordar preferencias o
                mantener un estado funcional del sitio.
              </p>
            </>
          ),
        },
        {
          title: "Cambios en la política",
          content: (
            <>
              <p>
                QAP ChacoNews puede actualizar esta política en función de cambios regulatorios,
                mejoras funcionales, nuevas integraciones de servicios o variaciones en la
                infraestructura tecnológica. Cuando se produzcan cambios relevantes, se actualizará
                la fecha de modificación para que el usuario pueda consultar la versión vigente.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
