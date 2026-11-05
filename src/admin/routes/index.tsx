import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <h1 className="w-[264px] p-6 text-2xl font-semibold">Requiere atención</h1>,
});
