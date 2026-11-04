export const OPENWEATHER_CITY = "Asuncion,PY";
export const OPENWEATHER_CITY_LABEL = "Asunción, PY";

export type WeatherCurrent = {
  city: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  visibility: number;
  sunrise: number;
  sunset: number;
  uvIndex?: number;
  airQuality?: number;
  coordinates?: { lat: number; lon: number };
};

export type ForecastDay = {
  day: string;
  icon: string;
  description: string;
  tempMin: number;
  tempMax: number;
};

export type HourlyForecastPoint = {
  label: string;
  time: string;
  temp: number;
  icon: string;
};

export type WeatherSnapshot = {
  current: WeatherCurrent;
  forecast: ForecastDay[];
  hourly: HourlyForecastPoint[];
  uvIndex: number;
  visibility: number;
  sunrise: number;
  sunset: number;
  airQuality: number;
};

type ForecastEntry = {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    temp_min?: number;
    temp_max?: number;
  };
  weather: Array<{
    icon: string;
    description: string;
  }>;
};

type ForecastResponse = {
  list?: ForecastEntry[];
};

const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000;

type WeatherCacheEntry<T> = {
  timestamp: number;
  data: T;
};

function readWeatherCache<T>(cacheKey: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WeatherCacheEntry<T> | null;
    if (!parsed || typeof parsed.timestamp !== "number" || parsed.timestamp === 0) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    const isFresh = Date.now() - parsed.timestamp < WEATHER_CACHE_TTL_MS;
    if (!isFresh) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed.data ?? null;
  } catch {
    try {
      window.localStorage.removeItem(cacheKey);
    } catch {
      // Ignore localStorage write failures.
    }
    return null;
  }
}

function writeWeatherCache<T>(cacheKey: string, data: T) {
  if (typeof window === "undefined") return;

  try {
    const entry: WeatherCacheEntry<T> = {
      timestamp: Date.now(),
      data,
    };
    window.localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Ignore localStorage write failures to avoid breaking the weather UI.
  }
}

async function fetchJsonWithWeatherCache<T>(
  cacheKey: string,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = readWeatherCache<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const data = await loader();
  writeWeatherCache(cacheKey, data);
  return data;
}

// The server adds the API key; see netlify/shared/openweather.mjs.
function buildWeatherUrl(endpoint: string, params: URLSearchParams) {
  params.set("endpoint", endpoint);
  return `/api/clima?${params.toString()}`;
}

async function parseWeatherError(response: Response): Promise<Error> {
  if (response.status === 429) {
    return new Error("Se excedió el límite de peticiones de OpenWeatherMap. Intentalo más tarde.");
  }

  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) {
      return new Error(payload.message);
    }
  } catch {
    // Ignore JSON parsing issues and fall through to a generic error.
  }

  return new Error("No se pudo obtener la información del clima.");
}

export async function fetchCurrentWeatherForCity(city: string): Promise<WeatherCurrent> {
  const query = city.trim() || OPENWEATHER_CITY;
  const cacheKey = `weather:current:${query}`;

  const data = await fetchJsonWithWeatherCache<{
    name?: string;
    coord?: { lat?: number; lon?: number };
    main?: { temp?: number; feels_like?: number; humidity?: number };
    wind?: { speed?: number };
    weather?: Array<{ description?: string; icon?: string }>;
    visibility?: number;
    sys?: { sunrise?: number; sunset?: number };
  }>(cacheKey, async () => {
    const params = new URLSearchParams({
      q: query,
      units: "metric",
      lang: "es",
    });

    const response = await fetch(buildWeatherUrl("/weather", params));

    if (!response.ok) {
      throw await parseWeatherError(response);
    }

    return (await response.json()) as {
      name?: string;
      coord?: { lat?: number; lon?: number };
      main?: { temp?: number; feels_like?: number; humidity?: number };
      wind?: { speed?: number };
      weather?: Array<{ description?: string; icon?: string }>;
      visibility?: number;
      sys?: { sunrise?: number; sunset?: number };
    };
  });

  if (typeof data.main?.temp !== "number") {
    throw new Error("La respuesta del clima no contiene datos válidos.");
  }

  return {
    city: data.name ?? OPENWEATHER_CITY_LABEL,
    temperature: data.main.temp,
    feelsLike: data.main.feels_like ?? data.main.temp,
    humidity: data.main.humidity ?? 0,
    windSpeed: data.wind?.speed ?? 0,
    description: data.weather?.[0]?.description ?? "Sin descripción",
    icon: data.weather?.[0]?.icon ?? "01d",
    visibility: data.visibility ?? 10000,
    sunrise: data.sys?.sunrise ?? Math.floor(Date.now() / 1000),
    sunset: data.sys?.sunset ?? Math.floor(Date.now() / 1000),
    ...(typeof data.coord?.lat === "number" && typeof data.coord.lon === "number"
      ? { coordinates: { lat: data.coord.lat, lon: data.coord.lon } }
      : {}),
  };
}

export async function fetchCurrentWeather(): Promise<WeatherCurrent> {
  return fetchCurrentWeatherForCity(OPENWEATHER_CITY);
}

export async function fetchUvIndexForCoordinates(lat: number, lon: number): Promise<number> {
  const cacheKey = `weather:uv:${lat}:${lon}`;
  const data = await fetchJsonWithWeatherCache<{ value?: number }>(cacheKey, async () => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });

    const response = await fetch(buildWeatherUrl("/uvi", params));
    if (!response.ok) {
      throw await parseWeatherError(response);
    }

    return (await response.json()) as { value?: number };
  });

  return typeof data.value === "number" ? data.value : 0;
}

export async function fetchAirQualityForCoordinates(lat: number, lon: number): Promise<number> {
  const cacheKey = `weather:air-quality:${lat}:${lon}`;
  const data = await fetchJsonWithWeatherCache<{ list?: Array<{ main?: { aqi?: number } }> }>(
    cacheKey,
    async () => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
      });

      const response = await fetch(buildWeatherUrl("/air_pollution", params));
      if (!response.ok) {
        throw await parseWeatherError(response);
      }

      return (await response.json()) as {
        list?: Array<{ main?: { aqi?: number } }>;
      };
    },
  );

  return typeof data.list?.[0]?.main?.aqi === "number" ? data.list[0].main.aqi : 0;
}

export async function fetchWeatherSnapshotForCity(city: string): Promise<WeatherSnapshot> {
  const [current, forecast, hourly] = await Promise.all([
    fetchCurrentWeatherForCity(city),
    fetchForecastWeatherForCity(city),
    fetchHourlyForecastForCity(city),
  ]);

  const uvIndex = current.coordinates
    ? await fetchUvIndexForCoordinates(current.coordinates.lat, current.coordinates.lon)
    : 0;
  const airQuality = current.coordinates
    ? await fetchAirQualityForCoordinates(current.coordinates.lat, current.coordinates.lon)
    : 0;

  return {
    current,
    forecast,
    hourly,
    uvIndex,
    visibility: current.visibility,
    sunrise: current.sunrise,
    sunset: current.sunset,
    airQuality,
  };
}

export async function fetchHourlyForecastForCity(city: string): Promise<HourlyForecastPoint[]> {
  const query = city.trim() || OPENWEATHER_CITY;
  const cacheKey = `weather:hourly:${query}`;

  const data = await fetchJsonWithWeatherCache<ForecastResponse>(cacheKey, async () => {
    const params = new URLSearchParams({
      q: query,
      units: "metric",
      lang: "es",
    });

    const response = await fetch(buildWeatherUrl("/forecast", params));

    if (!response.ok) {
      throw await parseWeatherError(response);
    }

    return (await response.json()) as ForecastResponse;
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const items = (data.list ?? []).filter((item) => item.dt >= nowSeconds).slice(0, 6);

  return items.map((item, index) => {
    const date = new Date(item.dt * 1000);
    const formattedTime = date.toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      label: index === 0 ? "Ahora" : formattedTime,
      time: formattedTime,
      temp: Math.round(item.main?.temp ?? 0),
      icon: item.weather?.[0]?.icon ?? "01d",
    };
  });
}

export async function fetchForecastWeatherForCity(city: string): Promise<ForecastDay[]> {
  const query = city.trim() || OPENWEATHER_CITY;
  const cacheKey = `weather:forecast:${query}`;

  const data = await fetchJsonWithWeatherCache<ForecastResponse>(cacheKey, async () => {
    const params = new URLSearchParams({
      q: query,
      units: "metric",
      lang: "es",
    });

    const response = await fetch(buildWeatherUrl("/forecast", params));

    if (!response.ok) {
      throw await parseWeatherError(response);
    }

    return (await response.json()) as ForecastResponse;
  });

  const list = data.list ?? [];

  if (list.length === 0) {
    throw new Error("El pronóstico no devolvió datos disponibles.");
  }

  const dayGroups = new Map<
    string,
    {
      day: string;
      temps: number[];
      sample: { icon: string; description: string };
      sampleDate: Date;
      sampleDistance: number;
    }
  >();

  for (const item of list) {
    const entryTime = new Date(item.dt * 1000);
    const dayKey = entryTime.toISOString().slice(0, 10);
    const hour = entryTime.getHours();
    const distanceFromNoon = Math.abs(hour - 12);
    const temp = item.main?.temp ?? 0;

    const current = dayGroups.get(dayKey);
    const icon = item.weather?.[0]?.icon ?? "01d";
    const description = item.weather?.[0]?.description ?? "Sin descripción";

    if (!current) {
      dayGroups.set(dayKey, {
        day: dayKey,
        temps: [temp],
        sample: { icon, description },
        sampleDate: entryTime,
        sampleDistance: distanceFromNoon,
      });
      continue;
    }

    current.temps.push(temp);

    if (distanceFromNoon < current.sampleDistance) {
      current.sample = { icon, description };
      current.sampleDate = entryTime;
      current.sampleDistance = distanceFromNoon;
    }
  }

  return Array.from(dayGroups.values())
    .slice(0, 5)
    .map((group) => {
      const date = new Date(group.sampleDate);
      const tempMin = Math.min(...group.temps);
      const tempMax = Math.max(...group.temps);

      return {
        day: date.toLocaleDateString("es-PY", { weekday: "short" }),
        icon: group.sample.icon,
        description: group.sample.description,
        tempMin,
        tempMax,
      };
    });
}

export async function fetchForecastWeather(): Promise<ForecastDay[]> {
  return fetchForecastWeatherForCity(OPENWEATHER_CITY);
}
