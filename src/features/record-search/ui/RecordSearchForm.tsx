import { Search } from "lucide-react";
import { AdornedInput, Button } from "@/shared/ui";
import { cn } from "@/shared/lib";

type RecordSearchFormProps = {
  // hero: the homepage and /records search, large and always full width; wide: inline; compact: app bar; page: the /records column, input only (Enter submits).
  size?: "hero" | "wide" | "compact" | "page";
  defaultValue?: string;
  className?: string;
};

// A plain GET form to /records: works without JS, the result is a shareable URL and no client state is needed.
const RecordSearchForm = ({
  size = "wide",
  defaultValue = "",
  className,
}: RecordSearchFormProps) => (
  <form
    role="search"
    action="/records"
    method="get"
    className={cn(
      "flex w-full items-center gap-2",
      size === "compact" && "w-64",
      className,
    )}
  >
    <AdornedInput
      type="search"
      name="q"
      defaultValue={defaultValue}
      placeholder={
        size === "compact"
          ? "Search records"
          : "Search by name, author, group or description"
      }
      aria-label="Search records"
      maxLength={200}
      autoComplete="off"
      startAdornment={<Search className="size-4" aria-hidden />}
      containerClassName={cn(
        "bg-background min-w-0 flex-1",
        size === "hero" && "min-h-12 px-4",
        size === "compact" && "min-h-9",
        size === "page" && "min-h-10",
      )}
      className={cn(size === "hero" && "text-base")}
    />
    {size === "page" ? (
      <Button type="submit" className="sr-only">
        Search
      </Button>
    ) : size === "compact" ? (
      <Button type="submit" size="icon-sm" variant="ghost" aria-label="Search">
        <Search aria-hidden />
      </Button>
    ) : (
      <Button
        type="submit"
        size={size === "hero" ? "lg" : "default"}
        className={cn(size === "hero" && "min-h-12", "max-md:min-h-11")}
      >
        Search
      </Button>
    )}
  </form>
);

export { RecordSearchForm };
export type { RecordSearchFormProps };
