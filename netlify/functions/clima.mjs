import { proxyWeather } from "../shared/openweather.mjs";

export default (request) =>
  proxyWeather(request.url, process.env.OPENWEATHER_API_KEY?.trim() ?? "");
