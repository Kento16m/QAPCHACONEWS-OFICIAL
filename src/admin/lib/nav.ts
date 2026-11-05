import {
  CalendarDays,
  ChartColumn,
  History,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Newspaper,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

export type CounterKey = "articles_total" | "comments_total" | "subscribers" | "users_total";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  counter?: CounterKey;
};

export type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "Contenido",
    items: [
      { to: "/", label: "Hoy", icon: LayoutDashboard },
      { to: "/articulos", label: "Artículos", icon: Newspaper, counter: "articles_total" },
      { to: "/portada", label: "Portada", icon: LayoutTemplate },
      { to: "/calendario", label: "Calendario", icon: CalendarDays },
      { to: "/imagenes", label: "Imágenes", icon: Image },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { to: "/comentarios", label: "Comentarios", icon: MessageSquare, counter: "comments_total" },
      {
        to: "/newsletter",
        label: "Newsletter",
        icon: Mail,
        adminOnly: true,
        counter: "subscribers",
      },
      { to: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true, counter: "users_total" },
    ],
  },
  {
    title: "Análisis",
    items: [
      { to: "/estadisticas", label: "Estadísticas", icon: ChartColumn },
      { to: "/actividad", label: "Actividad", icon: History, adminOnly: true },
    ],
  },
  {
    title: "Ajustes",
    items: [{ to: "/categorias", label: "Categorías y etiquetas", icon: Tags, adminOnly: true }],
  },
];

// Screens already built. Each stage adds its own, and the menu shows the rest as coming soon.
const READY = new Set(["/", "/articulos", "/portada", "/calendario", "/imagenes"]);

export const isReady = (to: string) => READY.has(to);

export const navFor = (role: "editor" | "admin"): NavGroup[] =>
  GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => role === "admin" || !item.adminOnly),
  })).filter((group) => group.items.length > 0);
