import { notFound } from "next/navigation";
import { PrimitivesPreview } from "./PrimitivesPreview";

// Dev-only gallery: the route does not exist in production builds.
const Page = () => {
  if (process.env.NODE_ENV === "production") notFound();
  return <PrimitivesPreview />;
};

export default Page;
