import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";

export default withErrorBoundary(OnboardingScreen, "onboarding");
