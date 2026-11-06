import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { WeatherDashboard } from "@/components/weather/WeatherDashboard";

export const Route = createFileRoute("/clima")({
  head: () =>
    pageHead(
      "/clima",
      "Clima en Paraguay",
      "Pronóstico del tiempo en Asunción, el Chaco y otras ciudades de Paraguay.",
    ),
  component: ClimaPage,
});

function ClimaPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <h1 className="sr-only">Clima en Paraguay</h1>
      <WeatherDashboard theme="dark" />
    </div>
  );
}
