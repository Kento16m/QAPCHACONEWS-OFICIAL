import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

export const STREAM_URL = "https://cdn.streaming.com.py:7136/;";
export const STATION_NAME = "Radio QAP ChacoNews";
// The owner's schedule, shown while off the air.
export const ON_AIR_HOURS = "de 17:00 a 19:00";
export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];
const COVER = { src: "/radio-cover.png", sizes: "512x512", type: "image/png" };
const VOLUME_KEY = "radio_volume";

export type RadioStatus = "idle" | "loading" | "playing" | "paused" | "reconnecting" | "failed";
export type NowPlaying = { title: string; artist: string; listeners: number; online: boolean };

const readVolume = () => {
  try {
    const saved = window.localStorage.getItem(VOLUME_KEY);
    const volume = saved === null ? 1 : Number(saved);
    return volume >= 0 && volume <= 1 ? volume : 1;
  } catch {
    return 1;
  }
};

let state: { status: RadioStatus; volume: number } = { status: "idle", volume: readVolume() };
let audio: HTMLAudioElement | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
const subscribers = new Set<() => void>();

const update = (patch: Partial<typeof state>) => {
  state = { ...state, ...patch };
  if ("mediaSession" in navigator && audio)
    navigator.mediaSession.playbackState = state.status === "playing" ? "playing" : "paused";
  subscribers.forEach((notify) => notify());
};

const cancelRetry = () => {
  clearTimeout(retryTimer);
  retryTimer = undefined;
};

const connect = () => {
  const element = getAudio();
  element.src = STREAM_URL;
  element.play()?.catch((error: unknown) => {
    // Failed connections also fire "error", which handles them. Only a browser refusal stops here.
    if (error instanceof DOMException && error.name === "NotAllowedError") release("paused");
  });
};

// Closing the connection saves mobile data, and resuming opens the live stream instead of old buffer.
const release = (status: "paused" | "idle" | "failed") => {
  cancelRetry();
  attempts = 0;
  update({ status });
  audio?.pause();
  audio?.removeAttribute("src");
  audio?.load();
};

const reconnectLater = () => {
  if (retryTimer !== undefined || !["loading", "playing", "reconnecting"].includes(state.status))
    return;
  const delay = RETRY_DELAYS_MS[attempts];
  if (delay === undefined) return release("failed");
  attempts += 1;
  update({ status: "reconnecting" });
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    connect();
  }, delay);
};

const markPlaying = () => {
  cancelRetry();
  attempts = 0;
  update({ status: "playing" });
};

const getAudio = () => {
  if (audio) return audio;
  const element = new Audio();
  audio = element;
  element.preload = "none";
  element.volume = state.volume;

  element.addEventListener("playing", markPlaying);
  element.addEventListener("error", reconnectLater);
  element.addEventListener("stalled", reconnectLater);
  element.addEventListener("ended", reconnectLater);
  element.addEventListener("waiting", () => {
    if (state.status === "playing") update({ status: "loading" });
  });
  // A stall can recover by itself, and then "playing" does not fire again.
  element.addEventListener("timeupdate", () => {
    if (element.readyState >= 3 && state.status === "reconnecting") markPlaying();
  });
  // Headphones unplugged or a phone call. Browsers also pause right before "ended".
  element.addEventListener("pause", () => {
    if (state.status === "playing" && !element.ended) release("paused");
  });
  window.addEventListener("online", () => {
    if (state.status !== "reconnecting" && state.status !== "failed") return;
    cancelRetry();
    attempts = 0;
    update({ status: "loading" });
    connect();
  });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", playRadio);
    navigator.mediaSession.setActionHandler("pause", pauseRadio);
    setRadioMetadata("", "");
  }
  return element;
};

export const playRadio = () => {
  cancelRetry();
  attempts = 0;
  update({ status: "loading" });
  connect();
};

export const pauseRadio = () => release("paused");
export const stopRadio = () => release("idle");

export const toggleRadio = () =>
  ["loading", "playing", "reconnecting"].includes(state.status) ? pauseRadio() : playRadio();

export const setRadioVolume = (volume: number) => {
  update({ volume });
  if (audio) audio.volume = volume;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Private browsing can block storage: the volume still applies to this visit.
  }
};

export const setRadioMetadata = (title: string, artist: string) => {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: title || STATION_NAME,
    artist: artist || "QAP ChacoNews",
    artwork: [COVER],
  });
};

// iOS ignores volume changes from a page and always reports 1.
export const canChangeVolume = () => {
  const probe = new Audio();
  probe.volume = 0.5;
  return probe.volume === 0.5;
};

export const songText = (song: NowPlaying | undefined) => {
  if (!song?.title) return song?.online === false ? "Sin emisión en este momento" : null;
  return song.artist ? `${song.artist} – ${song.title}` : song.title;
};

export const getRadioState = () => state;

const subscribe = (notify: () => void) => {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
};

export const useRadio = () => useSyncExternalStore(subscribe, getRadioState);

export const useNowPlaying = (enabled: boolean) => {
  const { data } = useQuery({
    queryKey: ["radio-now-playing"],
    enabled,
    // The header asks on every page, so it asks less often until someone listens.
    // React Query stops this interval while the tab is hidden.
    refetchInterval: getRadioState().status === "idle" ? 60_000 : 20_000,
    retry: false,
    queryFn: async (): Promise<NowPlaying> => {
      const response = await fetch("/.netlify/functions/now-playing");
      if (!response.ok) throw new Error("now-playing unavailable");
      return response.json();
    },
  });

  const title = data?.title ?? "";
  const artist = data?.artist ?? "";
  useEffect(() => setRadioMetadata(title, artist), [title, artist]);

  return data;
};
