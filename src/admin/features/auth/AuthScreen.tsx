import type { ReactNode } from "react";
import logoDark from "../../../../public/logo-dark.webp";
import logoLight from "../../../../public/logo-light.webp";

export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img src={logoLight} alt="QAP Chaco News" className={`dark:hidden ${className ?? ""}`} />
      <img src={logoDark} alt="QAP Chaco News" className={`hidden dark:block ${className ?? ""}`} />
    </>
  );
}

export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8">
        <Logo className="mb-6 h-12 w-auto" />
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </main>
  );
}
