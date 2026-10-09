import { APP_NAME } from "@/shared/config/client";
import { Footer } from "@/shared/ui";

// Helpdesk URL is UNKNOWN (batch-a 1.2); the link is added once the infra owner supplies it.
const SiteFooter = () => (
  <Footer className="bg-surface">
    <div className="text-text flex flex-col gap-1 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between md:px-6 xl:px-12">
      <span>{APP_NAME}</span>
      <span>Need help? e-INFRA CZ helpdesk</span>
    </div>
  </Footer>
);

export { SiteFooter };
