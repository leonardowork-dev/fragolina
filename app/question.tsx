import { withErrorBoundary } from "@/design/layout/ErrorBoundary";
import { QuestionScreen } from "@/features/qa/QuestionScreen";

export default withErrorBoundary(QuestionScreen, "question");
