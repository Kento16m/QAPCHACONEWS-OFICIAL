import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/terminos-y-condiciones")({
  head: () =>
    pageHead(
      "/terminos-y-condiciones",
      "Términos y Condiciones",
      "Normas de uso del sitio QAP ChacoNews, operado por Ímpetus E.A.S.",
    ),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      lastUpdated="6 de noviembre de 2026"
      intro={
        <>
          <p>
            Estos Términos y Condiciones regulan el uso del sitio web QAP ChacoNews, sus servicios,
            contenidos, herramientas de acceso y cualquier característica asociada al medio digital
            operado por Ímpetus E.A.S. El acceso y la utilización del sitio implican la aceptación
            plena y sin reservas de estas normas.
          </p>
        </>
      }
      sections={[
        {
          title: "Aceptación",
          content: (
            <>
              <p>
                Al acceder, navegar y utilizar QAP ChacoNews, el usuario declara que ha leído,
                comprende y acepta estos términos. Si no está de acuerdo con alguno de los puntos,
                debe abstenerse de utilizar el sitio.
              </p>
              <p>
                QAP ChacoNews puede modificar estos términos en cualquier momento. Las versiones
                vigentes se publicarán en el sitio y serán aplicables desde la fecha de publicación
                del cambio.
              </p>
            </>
          ),
        },
        {
          title: "Objeto del servicio",
          content: (
            <>
              <p>
                El portal tiene como finalidad informar, analizar y contextualizar temas de interés
                local, regional, nacional e internacional, con especial foco en el Chaco paraguayo y
                en la realidad del territorio del país.
              </p>
              <p>
                Los contenidos publicados pueden incluir noticias, reportajes, análisis, multimedia,
                entrevistas, contenidos de opinión y piezas de interés público, todos bajo criterios
                editoriales y de verificación. QAP ChacoNews busca mantener rigor, contexto y
                enfoque claro, aunque el usuario debe entender que la información puede estar sujeta
                a cambios de última hora o a una revisión posterior según nuevos datos.
              </p>
            </>
          ),
        },
        {
          title: "Uso permitido",
          content: (
            <>
              <p>El usuario se compromete a:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>utilizar el sitio con fines legales y lícitos;</li>
                <li>no intervenir en su funcionamiento ni vulnerar medidas de seguridad;</li>
                <li>
                  no recopilar contenidos con fines de extracción automatizada sin autorización;
                </li>
                <li>respetar la propiedad intelectual y los derechos de terceros;</li>
                <li>no generar de forma artificial visitas o clics en los anuncios del sitio;</li>
                <li>
                  no usar el sitio para difundir contenido falso, abusivo, difamatorio,
                  discriminatorio o ilegal.
                </li>
              </ul>
            </>
          ),
        },
        {
          title: "Propiedad intelectual",
          content: (
            <>
              <p>
                Todos los textos, imágenes, gráficos, logotipos, diseños, códigos y demás materiales
                del portal son propiedad de QAP ChacoNews, de Ímpetus E.A.S. o de terceros con
                licencia o autorización expresa. Queda prohibida la reproducción, distribución,
                difusión, copia o reutilización no autorizada salvo en los casos permitidos por la
                normativa aplicable y por la propia política editorial.
              </p>
            </>
          ),
        },
        {
          title: "Comentarios y participación",
          content: (
            <>
              <p>
                Cuando el usuario interactúa en secciones de comentarios, participación o comunidad,
                acepta que su texto pueda ser publicado bajo las reglas del sitio y que QAP
                ChacoNews puede moderarlo, editarlo, eliminarlo o limitarlo si considera que
                incumple normas de decencia, legalidad, seguridad o buen uso editorial.
              </p>
              <p>
                QAP ChacoNews no queda obligado a publicar todo contenido remitido por terceros y
                puede retirar, ocultar o ajustar materiales si estima que se vulneran criterios de
                calidad, seguridad o normativa aplicable.
              </p>
            </>
          ),
        },
        {
          title: "Publicidad",
          content: (
            <>
              <p>
                El sitio puede mostrar anuncios de terceros, entre ellos los servidos por Google
                AdSense. Cada anunciante es responsable de sus anuncios y de lo que ofrece, y su
                presencia en el sitio no implica aprobación ni recomendación por parte de QAP
                ChacoNews. El tratamiento de datos asociado se explica en la Política de Privacidad
                y en la Política de Cookies.
              </p>
            </>
          ),
        },
        {
          title: "Enlaces externos",
          content: (
            <>
              <p>
                El sitio puede incluir enlaces a otras páginas, servicios, redes sociales y recursos
                externos. Esos enlaces se ofrecen únicamente como referencia y no implican
                aprobación, control ni responsabilidad por el contenido de terceros.
              </p>
            </>
          ),
        },
        {
          title: "Disponibilidad del servicio",
          content: (
            <>
              <p>
                QAP ChacoNews se esfuerza por mantener la disponibilidad del portal y la continuidad
                de los servicios, pero no garantiza que el sitio esté siempre disponible, libre de
                interrupciones o completamente libre de errores técnicos. El acceso puede verse
                afectado por mantenimiento, fallos de infraestructura, problemas de terceros o
                circunstancias ajenas a nuestra voluntad.
              </p>
            </>
          ),
        },
        {
          title: "Limitación de responsabilidad",
          content: (
            <>
              <p>
                En la medida máxima permitida por la ley, QAP ChacoNews y Ímpetus E.A.S. no serán
                responsables por daños directos, indirectos, consecuentes o incidentales derivados
                del uso del sitio, incluyendo pérdida de información, perjuicios económicos,
                interrupciones de servicio, errores de contenido o decisiones tomadas por usuarios
                basadas en información publicada.
              </p>
            </>
          ),
        },
        {
          title: "Ley aplicable",
          content: (
            <>
              <p>
                Estos términos se rigen por la legislación de la República del Paraguay, con
                especial atención a la normativa aplicable a medios digitales, propiedad intelectual
                y servicios de la información. Cualquier controversia que se derive de su
                interpretación o aplicación será resuelta en los tribunales competentes de la ciudad
                de Asunción, salvo que la normativa vigente disponga otra cosa.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
