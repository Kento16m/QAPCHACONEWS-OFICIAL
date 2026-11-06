import type { ReactNode } from "react";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-primary"
    >
      {children}
    </a>
  );
}

// Shared by the privacy and cookie policies. Follows support.google.com/adsense/answer/1348695.
export function AdsDisclosure() {
  return (
    <>
      <p>
        QAP ChacoNews puede mostrar anuncios a través de Google AdSense. Los proveedores externos,
        incluido Google, utilizan cookies para mostrar anuncios según las visitas anteriores de cada
        usuario a este sitio o a otros sitios web.
      </p>
      <p>
        Las cookies de publicidad permiten a Google y a sus socios mostrar anuncios en función de
        las visitas a este sitio o a otros sitios de internet. Estos terceros pueden colocar y leer
        cookies en su navegador, y usar balizas web, direcciones IP u otros identificadores para
        recopilar información a partir de la publicación de anuncios. Otros proveedores o redes
        publicitarias que publiquen anuncios en el sitio también pueden usar cookies.
      </p>
      <p>
        Puede desactivar la publicidad personalizada en{" "}
        <ExternalLink href="https://www.google.com/settings/ads">
          Configuración de anuncios de Google
        </ExternalLink>
        . También puede desactivar el uso de cookies de algunos proveedores externos para publicidad
        personalizada en{" "}
        <ExternalLink href="https://www.aboutads.info/choices/">aboutads.info</ExternalLink>. Más
        información en{" "}
        <ExternalLink href="https://www.google.com/policies/privacy/partners/">
          Cómo utiliza Google los datos de los sitios de sus socios
        </ExternalLink>
        .
      </p>
      <p>
        Si elige «Rechazar» en el aviso de cookies, o mientras no haya elegido, solo solicitamos
        anuncios no personalizados. Estos no se basan en su navegación anterior, aunque pueden usar
        cookies para limitar la cantidad de veces que se muestra un anuncio, medir resultados y
        prevenir fraudes. A los visitantes del Espacio Económico Europeo, el Reino Unido y Suiza se
        les puede pedir su consentimiento mediante un mensaje de la plataforma de Google.
      </p>
    </>
  );
}
