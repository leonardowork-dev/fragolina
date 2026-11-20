import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { CountdownScreen } from "@/features/countdown/CountdownScreen";

export default withErrorBoundary(CountdownScreen, "countdown");
