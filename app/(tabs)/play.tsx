import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { PlayScreen } from "@/features/play/PlayScreen";

export default withErrorBoundary(PlayScreen, "play");
