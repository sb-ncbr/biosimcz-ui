import Link from "next/link";
import { Button, Content, H1, P } from "@/shared/ui";

const RecordNotFound = () => (
  <Content>
    <H1>Record not found</H1>
    <P>This record does not exist or is not public.</P>
    <Button asChild variant="outline">
      <Link href="/records">Search simulations</Link>
    </Button>
  </Content>
);

export default RecordNotFound;
