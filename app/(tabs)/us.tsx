import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { UsScreen } from "@/features/us/UsScreen";

export default withErrorBoundary(UsScreen, "us");
