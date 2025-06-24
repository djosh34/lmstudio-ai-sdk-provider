import { generateId, zodSchema } from "ai";
import type {
	LanguageModelV1FunctionToolCall,
	LanguageModelV1ToolChoice,
	LanguageModelV1,
	LanguageModelV1CallWarning,
} from "@ai-sdk/provider";
import type { ChatMessageData, Tool } from "@lmstudio/sdk";

export function getToolCalls(
	messages: ChatMessageData[],
): Array<LanguageModelV1FunctionToolCall> {
	const toolCalls: Array<LanguageModelV1FunctionToolCall> = [];
	for (const message of messages) {
		if (message.role === "assistant") {
			for (const part of message.content) {
				if (part.type === "toolCallRequest") {
					toolCalls.push({
						toolCallType: part.toolCallRequest.type,
						toolCallId: part.toolCallRequest.id ?? generateId(),
						toolName: part.toolCallRequest.name,
						args: JSON.stringify(part.toolCallRequest.arguments),
					});
				}
			}
		}
	}
	return toolCalls;
}

export function getTools(
	mode: Parameters<LanguageModelV1["doGenerate"]>[0]["mode"],
): { tools: Tool[]; warnings: LanguageModelV1CallWarning[] } {
	if (mode.type === "object-json") {
		return { tools: [], warnings: [] };
	}

	if (mode.type === "object-tool") {
		return {
			tools: [
				{
					name: mode.tool.name,
					description: mode.tool.description ?? "",
					type: "rawFunction",
					parametersJsonSchema: mode.tool.parameters,
					checkParameters: (params: Record<string, unknown>) => {},
					implementation: async () => {},
				},
			],
			warnings: [],
		};
	}

	if (mode.toolChoice?.type === "none") {
		return { tools: [], warnings: [] };
	}

	const warnings: LanguageModelV1CallWarning[] = [];
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
			parametersJsonSchema: tool.parameters,
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
