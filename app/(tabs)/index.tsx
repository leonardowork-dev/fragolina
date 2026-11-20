import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { HomeScreen } from "@/features/home/HomeScreen";

export default withErrorBoundary(HomeScreen, "home");
