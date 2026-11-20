import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { MonthScreen } from "@/features/memories/MonthScreen";

export default withErrorBoundary(MonthScreen, "month");
