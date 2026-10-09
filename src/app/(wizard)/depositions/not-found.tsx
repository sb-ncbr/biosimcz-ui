import Link from "next/link";
import { getCurrentSession } from "@/server/session";
import { Button, H1, Muted } from "@/shared/ui";
import { AppBar } from "@/widgets/app-bar";

// Rendered by notFound() from the [draftId] layout and pages, so it sits above the wizard shell (there is no draft to
// show a sidebar for). Unknown, deleted, malformed and foreign drafts all end up here (missing-states 1.3, Q1 default).
const DepositionNotFound = async () => {
  const session = await getCurrentSession();
  return (
    <div className="flex min-h-screen flex-col">
      <AppBar user={session?.user ?? null} />
      <main className="mx-auto flex w-full max-w-160 flex-1 flex-col items-start gap-3 px-4 py-16">
        <H1>Deposition not found</H1>
        <Muted>There is no deposition with this address, or it was deleted.</Muted>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/depositions">Go to My depositions</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default DepositionNotFound;
