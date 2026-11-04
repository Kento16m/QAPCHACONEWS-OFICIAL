const normalizeHost = (hostname: string) =>
  hostname
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/:\d+$/, "")
    .replace(/\/$/, "")
    .trim()
    .toLowerCase();

const toHostList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeHost);

const matchesAllowedHost = (hostname: string, allowed: string) => {
  const normalizedHostname = normalizeHost(hostname);
  const normalizedAllowed = normalizeHost(allowed);

  if (!normalizedHostname || !normalizedAllowed) return false;
  if (normalizedHostname === normalizedAllowed) return true;

  if (normalizedAllowed.startsWith("*.")) {
    const suffix = normalizedAllowed.slice(1);
    return normalizedHostname.endsWith(suffix) && normalizedHostname !== suffix.slice(1);
  }

  const allowedBase = normalizedAllowed.replace(/^\./, "");
  return normalizedHostname === allowedBase || normalizedHostname.endsWith(`.${allowedBase}`);
};

export const getAllowedAdminHosts = (): string[] => {
  const defaultHosts = ["localhost", "127.0.0.1", "admin.localhost"];
  const rawHosts = [
    ...toHostList(import.meta.env.VITE_ADMIN_HOST),
    ...toHostList(import.meta.env.VITE_ADMIN_SUBDOMAIN),
    ...defaultHosts,
  ];

  return [...new Set(rawHosts)]
    .filter(Boolean)
    .filter((host) => host && !host.startsWith("http://") && !host.startsWith("https://"));
};

export const isAdminHostAllowed = (hostname?: string) => {
  if (!hostname) return false;

  const normalizedHostname = normalizeHost(hostname);
  const allowedHosts = getAllowedAdminHosts();

  return allowedHosts.some((allowed) => matchesAllowedHost(normalizedHostname, allowed));
};

export const getAdminRedirectUrl = () => {
  const allowedHosts = getAllowedAdminHosts();
  const [firstAllowedHost] = allowedHosts.filter(
    (host) => !host.includes("localhost") && !host.includes("127.0.0.1") && !host.startsWith("*."),
  );

  if (firstAllowedHost) return `https://${firstAllowedHost}/`;
  return "/";
};
