import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { MemoriesScreen } from "@/features/memories/MemoriesScreen";

export default withErrorBoundary(MemoriesScreen, "memories");
