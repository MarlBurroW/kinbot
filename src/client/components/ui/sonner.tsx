import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "w-[var(--width)] rounded-xl border px-4 py-3 flex items-start gap-3 shadow-lg backdrop-blur-xl bg-popover/90 border-border text-popover-foreground font-sans text-sm",
          title: "font-medium leading-snug",
          description: "text-muted-foreground text-[13px] mt-0.5 leading-snug",
          icon: "mt-0.5 shrink-0 [&>svg]:size-[18px]",
          actionButton:
            "ml-auto shrink-0 self-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors",
          cancelButton:
            "ml-auto shrink-0 self-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors",
          closeButton:
            "absolute top-2 right-2 rounded-md p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors",
          success:
            "!bg-success/10 !border-success/25 dark:!bg-success/15 dark:!border-success/30",
          error:
            "!bg-destructive/10 !border-destructive/25 dark:!bg-destructive/15 dark:!border-destructive/30",
          warning:
            "!bg-warning/10 !border-warning/25 dark:!bg-warning/15 dark:!border-warning/30",
          info:
            "!bg-info/10 !border-info/25 dark:!bg-info/15 dark:!border-info/30",
          loading:
            "!border-border/50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
