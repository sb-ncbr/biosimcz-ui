import Link from "next/link";
import { Content, H1, P } from "@e-infra/design-system";

const NotFound = () => (
  <Content>
    <H1>Page not found</H1>
    <P>
      <Link href="/" className="underline">
        Back to the start page
      </Link>
    </P>
  </Content>
);

export default NotFound;
