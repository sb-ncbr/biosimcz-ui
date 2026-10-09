import Link from "next/link";
import { Button, Content, H1, P } from "@/shared/ui";

// notFound() thrown in [replica]/layout is handled by this segment, one level up, so it renders inside the site shell.
const ReplicaNotFound = () => (
  <Content>
    <H1>Replica not found</H1>
    <P>This replica does not exist for this record.</P>
    <Button asChild variant="outline">
      <Link href="/records">Search simulations</Link>
    </Button>
  </Content>
);

export default ReplicaNotFound;
