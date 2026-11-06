import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/quienes-somos")({
  head: () =>
    pageHead(
      "/quienes-somos",
      "Quiénes Somos",
      "QAP ChacoNews es un medio digital que cubre la realidad del Chaco paraguayo y del país con rigor, independencia y cercanía.",
    ),
  component: AboutUsPage,
});

function AboutUsPage() {
  return (
    <LegalPage
      title="Quiénes Somos"
      lastUpdated="19 de octubre de 2026"
      intro={
        <>
          <p>
            QAP ChacoNews nació con el propósito de cubrir la realidad del Chaco paraguayo y del
            país con rigor, independencia y cercanía. Somos un medio digital orientado a ofrecer
            información de calidad, análisis de la actualidad y un punto de referencia para la
            comunidad local y regional.
          </p>
        </>
      }
      sections={[
        {
          title: "Nuestra misión",
          content: (
            <>
              <p>
                Nuestra misión es informar con verdad, contexto y responsabilidad, poniendo al
                servicio de la comunidad una mirada cercana y útil sobre lo que ocurre en la región,
                en los municipios, en el comercio, en la educación, la infraestructura, la política
                y la vida cotidiana.
              </p>
              <p>
                Entendemos que el periodismo no solo informa: también ayuda a interpretar, explicar
                y fortalecer la convivencia social y la participación ciudadana.
              </p>
            </>
          ),
        },
        {
          title: "Nuestra visión",
          content: (
            <>
              <p>
                Buscamos convertirnos en una referencia confiable para la región, con una presencia
                digital sólida, contenidos de alto valor y una relación cercana con la comunidad.
                Queremos ser una herramienta útil para entender el presente, reconocer los datos
                relevantes y aportar claridad a los debates locales.
              </p>
            </>
          ),
        },
        {
          title: "Qué cubrimos",
          content: (
            <>
              <p>Abordamos temas de interés general y local, entre ellos:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>noticias del Chaco paraguayo y otras regiones del país;</li>
                <li>economía, infraestructura y desarrollo regional;</li>
                <li>política, institucionalidad y gestión pública;</li>
                <li>sociedad, cultura, educación y salud;</li>
                <li>análisis y contexto para entender la realidad local con mayor profundidad.</li>
              </ul>
            </>
          ),
        },
        {
          title: "Valores",
          content: (
            <>
              <p>Los pilares del proyecto son:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>rigor informativo;</li>
                <li>Independencia editorial;</li>
                <li>transparencia y verificación;</li>
                <li>cercanía con la audiencia;</li>
                <li>respeto a la diversidad de voces y perspectivas.</li>
              </ul>
            </>
          ),
        },
        {
          title: "Relación con la comunidad",
          content: (
            <>
              <p>
                Creemos en la importancia de escuchar a la comunidad, dar espacio a las historias
                locales y contribuir a una mejor comprensión del territorio. Por eso valoramos la
                participación, la conversación responsable y la difusión de información útil para la
                ciudadanía.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
