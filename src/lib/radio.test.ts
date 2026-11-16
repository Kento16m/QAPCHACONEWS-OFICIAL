import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudio extends EventTarget {
  static created: FakeAudio[] = [];
  preload = "";
  src = "";
  volume = 1;
  readyState = 0;
  paused = true;
  ended = false;
  sources: string[] = [];
  constructor() {
    super();
    FakeAudio.created.push(this);
  }
  play() {
    this.paused = false;
    this.sources.push(this.src);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load() {}
}

const loadRadio = () => import("./radio");
const audio = () => FakeAudio.created[0]!;
const fire = (type: string) => audio().dispatchEvent(new Event(type));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("Audio", FakeAudio);
  FakeAudio.created = [];
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("radio player", () => {
  it("does not touch the stream until someone presses play", async () => {
    const radio = await loadRadio();
    expect(radio.getRadioState().status).toBe("idle");
    expect(FakeAudio.created).toHaveLength(0);

    radio.playRadio();
    expect(audio().preload).toBe("none");
    expect(audio().src).toBe(radio.STREAM_URL);
    expect(radio.getRadioState().status).toBe("loading");

    fire("playing");
    expect(radio.getRadioState().status).toBe("playing");
  });

  it("uses a single audio element across plays", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    radio.pauseRadio();
    radio.playRadio();
    expect(FakeAudio.created).toHaveLength(1);
  });

  it("drops the connection on pause and reconnects to the live stream on resume", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("playing");

    radio.pauseRadio();
    expect(audio().src).toBe("");
    expect(radio.getRadioState().status).toBe("paused");

    radio.playRadio();
    expect(audio().src).toBe(radio.STREAM_URL);
    expect(audio().sources).toHaveLength(2);
  });

  it("does not reconnect after an error caused by a pause", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    radio.pauseRadio();
    fire("error");
    expect(radio.getRadioState().status).toBe("paused");
    vi.advanceTimersByTime(60_000);
    expect(audio().sources).toHaveLength(1);
  });

  it("reconnects with growing delays, then tells the listener it gave up", async () => {
    const radio = await loadRadio();
    radio.playRadio();

    for (const [index, delay] of radio.RETRY_DELAYS_MS.entries()) {
      fire("error");
      expect(radio.getRadioState().status).toBe("reconnecting");
      vi.advanceTimersByTime(delay - 1);
      expect(audio().sources).toHaveLength(index + 1);
      vi.advanceTimersByTime(1);
      expect(audio().sources).toHaveLength(index + 2);
    }

    fire("error");
    expect(radio.getRadioState().status).toBe("failed");
  });

  it("restarts the delays after the stream recovers", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("error");
    vi.advanceTimersByTime(radio.RETRY_DELAYS_MS[0]!);
    fire("playing");
    expect(radio.getRadioState().status).toBe("playing");

    fire("stalled");
    const before = audio().sources.length;
    vi.advanceTimersByTime(radio.RETRY_DELAYS_MS[0]!);
    expect(audio().sources).toHaveLength(before + 1);
  });

  it("keeps playing when a stall recovers by itself", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("playing");
    fire("stalled");
    audio().readyState = 4;
    fire("timeupdate");

    expect(radio.getRadioState().status).toBe("playing");
    vi.advanceTimersByTime(60_000);
    expect(audio().sources).toHaveLength(1);
  });

  it("ignores the timeupdate a browser fires while reloading", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("error");
    audio().readyState = 0;
    fire("timeupdate");
    expect(radio.getRadioState().status).toBe("reconnecting");
  });

  it("reconnects at once when the network returns, even after giving up", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    for (const delay of radio.RETRY_DELAYS_MS) {
      fire("error");
      vi.advanceTimersByTime(delay);
    }
    fire("error");
    expect(radio.getRadioState().status).toBe("failed");
    const before = audio().sources.length;

    window.dispatchEvent(new Event("online"));
    expect(radio.getRadioState().status).toBe("loading");
    expect(audio().sources).toHaveLength(before + 1);
  });

  it("does not resume on network return if the listener paused", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    radio.pauseRadio();
    window.dispatchEvent(new Event("online"));
    expect(radio.getRadioState().status).toBe("paused");
    expect(audio().sources).toHaveLength(1);
  });

  it("reflects a pause coming from the system", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("playing");
    fire("pause");
    expect(radio.getRadioState().status).toBe("paused");
    expect(audio().src).toBe("");
  });

  it("reconnects when a live stream ends, even though the browser pauses first", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("playing");
    audio().ended = true;
    fire("pause");
    fire("ended");
    expect(radio.getRadioState().status).toBe("reconnecting");
  });

  it("goes back to paused when the browser refuses to play", async () => {
    const radio = await loadRadio();
    vi.spyOn(FakeAudio.prototype, "play").mockRejectedValueOnce(
      new DOMException("blocked", "NotAllowedError"),
    );
    radio.playRadio();
    await vi.advanceTimersByTimeAsync(0);
    expect(radio.getRadioState().status).toBe("paused");
  });

  it("stop returns the player to idle", async () => {
    const radio = await loadRadio();
    radio.playRadio();
    fire("playing");
    radio.stopRadio();
    expect(radio.getRadioState().status).toBe("idle");
    expect(audio().src).toBe("");
  });

  it("remembers the volume between visits", async () => {
    const radio = await loadRadio();
    radio.setRadioVolume(0.3);
    radio.playRadio();
    expect(audio().volume).toBe(0.3);

    vi.resetModules();
    const next = await loadRadio();
    expect(next.getRadioState().volume).toBe(0.3);
  });

  it("ignores a corrupt saved volume", async () => {
    window.localStorage.setItem("radio_volume", "9");
    const radio = await loadRadio();
    expect(radio.getRadioState().volume).toBe(1);
  });

  it("survives a browser that blocks storage", async () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.spyOn(window.localStorage, "getItem").mockImplementation(blocked);
    vi.spyOn(window.localStorage, "setItem").mockImplementation(blocked);

    const radio = await loadRadio();
    expect(() => radio.setRadioVolume(0.5)).not.toThrow();
    expect(radio.getRadioState().volume).toBe(0.5);
  });

  it("publishes the song to the lock screen", async () => {
    class FakeMetadata {
      constructor(public init: MediaMetadataInit) {}
    }
    const session = { metadata: null as FakeMetadata | null, setActionHandler: vi.fn() };
    vi.stubGlobal("MediaMetadata", FakeMetadata);
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });

    const radio = await loadRadio();
    radio.playRadio();
    expect(session.setActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
    expect(session.setActionHandler).toHaveBeenCalledWith("pause", expect.any(Function));

    radio.setRadioMetadata("Polca", "Los Ojeda");
    expect(session.metadata?.init).toMatchObject({ title: "Polca", artist: "Los Ojeda" });

    radio.setRadioMetadata("", "");
    expect(session.metadata?.init.title).toBe(radio.STATION_NAME);

    Reflect.deleteProperty(navigator, "mediaSession");
  });
});
