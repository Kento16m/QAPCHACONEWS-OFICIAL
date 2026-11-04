import { Eye, EyeOff, Loader2 } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  aside?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, aside, type = "text", className, ...props },
  ref,
) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && show ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn(
            "h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive",
            isPassword && "pr-12",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={loading}
      aria-busy={loading}
      className="h-12 w-full rounded-xl text-base font-bold"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-semibold text-primary hover:underline">
      {children}
    </button>
  );
}
