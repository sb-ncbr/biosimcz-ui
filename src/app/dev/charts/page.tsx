import { notFound } from "next/navigation";
import { ChartLab } from "./ChartLab";

// Dev-only chart lab: the route does not exist in production builds.
const Page = () => {
  if (process.env.NODE_ENV === "production") notFound();
  return <ChartLab />;
};

export default Page;
