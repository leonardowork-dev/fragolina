import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { DrawScreen } from "@/features/draw/DrawScreen";

export default withErrorBoundary(DrawScreen, "draw");
