import type { Metadata } from "next";
import { ReviewSummary } from "@/features/review-publish";
import { WizardColumn, WizardPageHeader } from "@/widgets/wizard-shell";

const ReviewPage = () => (
  <WizardColumn>
    <WizardPageHeader eyebrow="Before you publish" title="Review and publish" lead="Check your deposition before it goes public." />
    <ReviewSummary />
  </WizardColumn>
);

const metadata: Metadata = { title: "Review and publish - New deposition | MDRepo" };

export { metadata };
export default ReviewPage;
