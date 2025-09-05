import { generateId, zodSchema } from "ai";
import type {

	LanguageModelV2,
	LanguageModelV2CallWarning,
} from "@ai-sdk/provider";
import type { ChatMessageData, Tool } from "@lmstudio/sdk";


// export function getContent(
// 	messages: ChatMessageData[],
// ): Array<LanguageModelV2Content> {
// 	const content: Array<LanguageModelV2Content> = [];
// 	for (const message of messages) {
// 		if (message.role === "assistant") {
// 			for (const part of message.content) {
// 				content.push(part);
// 			}
// 		}
// 	}
// 	return content;
// }

// export function getToolCalls(
// 	messages: ChatMessageData[],
// ): Array<LanguageModelV2FunctionToolCall> {
// 	const toolCalls: Array<LanguageModelV2FunctionToolCall> = [];
// 	for (const message of messages) {
// 		if (message.role === "assistant") {
// 			for (const part of message.content) {
// 				if (part.type === "toolCallRequest") {
// 					toolCalls.push({
// 						toolCallType: part.toolCallRequest.type,
// 						toolCallId: part.toolCallRequest.id ?? generateId(),
// 						toolName: part.toolCallRequest.name,
// 						args: JSON.stringify(part.toolCallRequest.arguments),
// 					});
// 				}
// 			}
// 		}
// 	}
// 	return toolCalls;
// }

export function getTools(
	mode: Parameters<LanguageModelV2["doGenerate"]>[0],
): { tools: Tool[]; warnings: LanguageModelV2CallWarning[] } {

	const warnings: LanguageModelV2CallWarning[] = [];
	const tools: Tool[] = [];
	for (const tool of mode.tools ?? []) {
		if (tool.type !== "function") {
			warnings.push({
				type: "unsupported-tool",
				tool: tool,
				details: `Not implemented for tool type ${tool.type}`,
			});
			continue;
		}

		if (mode.toolChoice?.type === "tool") {
			if (mode.toolChoice.toolName !== tool.name) {
				warnings.push({
					type: "unsupported-tool",
					tool: tool,
					details: `Tool ${tool.name} is not the tool specified in toolChoice`,
				});
				continue;
			}
		}
		// Raw function because we don't have zod schema support for the tool parameters
		tools.push({
			name: tool.name,
			description: tool.description ?? "",
			type: "rawFunction",
			parametersJsonSchema: tool.inputSchema,
			checkParameters: (params: Record<string, unknown>) => {},
			implementation: async () => {},
		});
	}

	if (mode.toolChoice?.type === "required") {
		warnings.push({
			type: "other",
			message: "Required tool choice is not supported in LMStudio",
		});
	}

	return { tools, warnings };
}
