import { createFileRoute } from "@tanstack/react-router";
import { RadioPlayer } from "@/components/radio/RadioPlayer";
import { pageHead } from "@/lib/page-head";

const DESCRIPTION = "Escuchá la radio de QAP ChacoNews en vivo, desde el Chaco paraguayo.";

export const Route = createFileRoute("/radio")({
  head: () => {
    const head = pageHead("/radio", "Radio en vivo", DESCRIPTION);
    return {
      ...head,
      meta: [
        ...head.meta,
        { property: "og:image", content: "https://qapchaconews.com/radio-cover.png" },
      ],
    };
  },
  component: RadioPlayer,
});
