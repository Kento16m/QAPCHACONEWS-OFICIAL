import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/aviso-legal")({
  head: () =>
    pageHead(
      "/aviso-legal",
      "Aviso Legal",
      "Titularidad, responsabilidad editorial y normativa aplicable de QAP ChacoNews.",
    ),
  component: LegalNoticePage,
});

function LegalNoticePage() {
  return (
    <LegalPage
      title="Aviso Legal"
      lastUpdated="6 de noviembre de 2026"
      intro={
        <>
          <p>
            Este Aviso Legal informa sobre la titularidad, la responsabilidad editorial, la
            normativa aplicable y las condiciones generales bajo las cuales se ofrece el servicio de
            QAP ChacoNews. El sitio es operado por Ímpetus E.A.S., con domicilio en Paraguay, y el
            acceso al portal implica el conocimiento y la aceptación de estas disposiciones.
          </p>
        </>
      }
      sections={[
        {
          title: "Titularidad",
          content: (
            <>
              <p>
                QAP ChacoNews es un medio digital de información, análisis y cobertura periodística
                con enfoque regional, cuya titularidad y administración corresponden a Ímpetus
                E.A.S., con RUC 80163332 - 0.
              </p>
              <p>
                Domicilio legal: Calle 11 de Agosto 647, Ñemby, Departamento Central, República del
                Paraguay.
              </p>
              <p>Correo electrónico: direccion@impetuseas.com | Teléfono: +595 972 438 625.</p>
              <p>Director editorial: Lic. Pedro Escobar Medina.</p>
            </>
          ),
        },
        {
          title: "Responsabilidad editorial",
          content: (
            <>
              <p>
                El contenido publicado responde a criterios editoriales, de verificación y
                actualización de la información. QAP ChacoNews se compromete a ejercer una labor
                responsable y a corregir errores o aclaraciones cuando se detecte información
                inexacta, parcial o desactualizada, siempre que sea razonablemente posible.
              </p>
              <p>
                Sin embargo, la publicación de noticias, reportajes, análisis y contenidos de
                actualidad implica que la información puede evolucionar con nuevos datos,
                intervenciones institucionales, cambios de contexto o correcciones posteriores.
              </p>
            </>
          ),
        },
        {
          title: "Responsabilidad por terceros",
          content: (
            <>
              <p>
                QAP ChacoNews puede incorporar contenidos o servicios de terceros, ya sea por
                integración de redes, citas, referencias, multimedia, contenido embebido, enlaces
                externos, proveedores de analítica, publicidad, autenticación social o
                infraestructura tecnológica. El sitio no garantiza ni comparte necesariamente la
                responsabilidad editorial de esos terceros, salvo que exista una relación directa de
                gestión o producción.
              </p>
            </>
          ),
        },
        {
          title: "Seguridad y uso del servicio",
          content: (
            <>
              <p>
                El sitio se ofrece con la finalidad de divulgar información de interés general y
                facilitar el acceso a contenidos de calidad. El usuario debe utilizar la plataforma
                de forma razonable, respetuosa y conforme a la ley. QAP ChacoNews no garantiza la
                continuidad infinita del servicio ni la ausencia total de errores, pero sí busca
                mantener altos estándares de estabilidad, seguridad y calidad editorial.
              </p>
            </>
          ),
        },
        {
          title: "Protección de la propiedad intelectual",
          content: (
            <>
              <p>
                Los contenidos, marcas, diseños, código, textos, gráficos y elementos visuales del
                sitio están protegidos por normas de propiedad intelectual. Su reproducción,
                distribución o uso comercial sin autorización puede ser ilegal y estar sujeto a las
                sanciones previstas por la normativa aplicable, incluida la Ley N.º 1328/1998 de
                Derecho de Autor y Derechos Conexos y normas conexas.
              </p>
            </>
          ),
        },
        {
          title: "Comunicaciones y contacto",
          content: (
            <>
              <p>
                El sitio ofrece canales de contacto para consultas, sugerencias, informes sobre
                contenido, dudas sobre la política legal o requerimientos relacionados con
                privacidad y protección de datos. Para comunicaciones formales puede contactarse con
                Ímpetus E.A.S. a través de direccion@impetuseas.com.
              </p>
            </>
          ),
        },
        {
          title: "Publicidad",
          content: (
            <>
              <p>
                QAP ChacoNews puede incluir anuncios de terceros, entre ellos los servidos por
                Google AdSense. Los anuncios se identifican como publicidad y se presentan separados
                del contenido periodístico. Las decisiones editoriales no dependen de los
                anunciantes, y mostrar un anuncio no implica respaldar su contenido.
              </p>
            </>
          ),
        },
        {
          title: "Ley aplicable",
          content: (
            <>
              <p>
                Este aviso legal se rige por la legislación de la República del Paraguay y, en lo
                que corresponda, por normas de protección de la información, propiedad intelectual,
                servicios digitales y prácticas comerciales. Cualquier cuestión que surja de su
                aplicación se resolverá en los tribunales competentes de la ciudad de Asunción, sin
                perjuicio de las normas y derechos que la ley paraguaya pueda reconocer a usuarios,
                lectores, proveedores o terceros.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
