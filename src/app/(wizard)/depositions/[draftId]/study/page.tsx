import type { Metadata } from "next";
import { StudyForm } from "@/features/step-study";
import { WizardColumn, WizardPageHeader } from "@/widgets/wizard-shell";

const StudyPage = () => (
  <WizardColumn>
    <WizardPageHeader eyebrow="Step 1 of 3" title="Study details" lead="How your study will be described, credited, and shared." />
    <StudyForm />
  </WizardColumn>
);

const metadata: Metadata = { title: "Study details - New deposition | MDRepo" };

export { metadata };
export default StudyPage;
