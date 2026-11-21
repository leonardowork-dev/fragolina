import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { ZoneScreen } from "@/features/zone/ZoneScreen";

export default withErrorBoundary(ZoneScreen, "zone");
