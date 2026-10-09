import { Button } from "@/shared/ui";
import { signInWithEinfra } from "../actions";

// A plain form so sign-in works before hydration; the action starts the OIDC flow on the server.
const SignInButton = ({ next }: { next: string }) => (
  <form action={signInWithEinfra}>
    <input type="hidden" name="next" value={next} />
    <Button type="submit" className="w-full">Sign in with e-INFRA CZ</Button>
  </form>
);

export { SignInButton };
