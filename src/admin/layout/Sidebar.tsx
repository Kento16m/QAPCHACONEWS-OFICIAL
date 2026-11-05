import { Link } from "@tanstack/react-router";
import { Logo } from "../features/auth/AuthScreen";
import { useDashboard } from "../features/today/api";
import { isReady, navFor, type NavItem } from "../lib/nav";
import { useSession } from "../lib/session";
import { cn } from "@/lib/utils";
import favicon from "../../../public/favicon.png";

const itemClass =
  "flex h-10 items-center gap-3 rounded-lg px-3 font-medium transition-colors duration-150";

function Item({
  item,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  count: number | undefined;
  onNavigate: (() => void) | undefined;
}) {
  const Icon = item.icon;

  if (!isReady(item.to)) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? `${item.label}: pronto` : undefined}
        className={cn(
          itemClass,
          "cursor-default text-muted-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto text-xs">Pronto</span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      activeOptions={{ exact: item.to === "/" }}
      activeProps={{ className: "bg-accent text-accent-foreground" }}
      inactiveProps={{ className: "text-foreground hover:bg-muted" }}
      className={cn(itemClass, collapsed && "justify-center px-0")}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {count !== undefined && <span className="ml-auto text-xs">{count}</span>}
        </>
      )}
    </Link>
  );
}

export function Sidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { profile } = useSession();
  const { data: stats } = useDashboard();
  const groups = navFor(profile?.role === "admin" ? "admin" : "editor");

  return (
    <nav aria-label="Principal" className="flex h-full flex-col overflow-y-auto px-4 py-5">
      {collapsed ? (
        <img src={favicon} alt="QAP Chaco News" className="mx-auto mb-5 size-9 rounded-md" />
      ) : (
        <Logo className="mx-2 mb-5 h-11 w-auto self-start" />
      )}
      {groups.map((group) => (
        <div key={group.title} className="mb-4">
          {collapsed ? (
            <div className="mx-2 mb-2 h-px bg-border" />
          ) : (
            <h2 className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{group.title}</h2>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <Item
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  count={item.counter && stats ? stats[item.counter] : undefined}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
