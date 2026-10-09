import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui";
import { safeNext } from "@/entities/session";
import { loginErrorMessage, SESSION_EXPIRED_MESSAGE, SignInButton } from "@/features/auth";
import { ClearMirrorsOnMount } from "@/features/draft";
import { getCurrentSession } from "@/server/session";

const metadata: Metadata = { title: "Sign in | MDRepo" };

type SearchParams = { next?: string | string[]; error?: string | string[]; expired?: string | string[] };

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

const LoginPage = async ({ searchParams }: { searchParams: Promise<SearchParams> }) => {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getCurrentSession()) redirect(next);
  const error = first(params.error);
  const expired = first(params.expired) !== undefined;
  return (
    <div className="bg-linear-to-br from-primary-700 to-primary-500 flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      {/* Nobody is signed in here (logout and expiry both land on this page), so no local draft copy may outlive the session. */}
      <ClearMirrorsOnMount />
      <Card className="bg-background w-full max-w-md">
        <CardHeader className="items-center text-center">
          <CardTitle>Sign in to MDRepo</CardTitle>
          <CardDescription>Sign in using your e-INFRA CZ identity</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error !== undefined && (
            <Alert variant="error" role="alert">
              <AlertDescription>{loginErrorMessage(error)}</AlertDescription>
            </Alert>
          )}
          {expired && error === undefined && (
            <Alert role="status">
              <AlertDescription>{SESSION_EXPIRED_MESSAGE}</AlertDescription>
            </Alert>
          )}
          <SignInButton next={next} />
        </CardContent>
      </Card>
    </div>
  );
};

export { metadata };
export default LoginPage;
