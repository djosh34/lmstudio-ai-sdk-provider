import type { LLMPredictionStopReason } from "@lmstudio/sdk";
import type { FinishReason } from "ai";

export function mapLMStudioFinishReason(
	finishReason: LLMPredictionStopReason,
): FinishReason {
	switch (finishReason) {
		case "userStopped":
			return "stop";
		case "modelUnloaded":
			return "other";
		case "failed":
			return "error";
		case "eosFound":
			return "stop";
		case "stopStringFound":
			return "stop";
		case "maxPredictedTokensReached":
			return "length";
		case "contextLengthReached":
			return "length";
		case "toolCalls":
			return "tool-calls";
	}
}
