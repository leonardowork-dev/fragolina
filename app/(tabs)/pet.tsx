import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { PetScreen } from "@/features/pet/PetScreen";

export default withErrorBoundary(PetScreen, "pet");
