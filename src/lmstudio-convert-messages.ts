import {
	type UserContent,
	type AssistantContent,
	type ToolContent,
	InvalidToolInputError,
} from "ai";
import type {
	ChatMessageData,
	ChatMessagePartTextData,
	ChatMessagePartToolCallRequestData,
	ChatMessagePartToolCallResultData,
} from "@lmstudio/sdk";
import type { LanguageModelV2CallWarning, LanguageModelV2Content, LanguageModelV2Prompt } from "@ai-sdk/provider";
import { z } from "zod";

function convertUserContent(content: UserContent): {
	parts: ChatMessagePartTextData[];
	warnings: LanguageModelV2CallWarning[];
} {
	const warnings: LanguageModelV2CallWarning[] = [];
	if (typeof content === "string") {
		return {
			parts: [
				{
					type: "text",
					text: content,
				},
			],
			warnings,
		};
	}

	const parts: ChatMessagePartTextData[] = [];
	for (const part of content) {
		if (part.type === "text") {
			parts.push({
				type: "text",
				text: part.text,
			});
		} else {
			warnings.push({
				message: `Unsupported content type: ${part.type}`,
				type: "other",
			});
		}
	}

	return { parts, warnings };
}

function convertAssistantContent(content: AssistantContent): {
	parts: (ChatMessagePartTextData | ChatMessagePartToolCallRequestData)[];
	warnings: LanguageModelV2CallWarning[];
} {
	const warnings: LanguageModelV2CallWarning[] = [];

	if (typeof content === "string") {
		return {
			parts: [
				{
					type: "text",
					text: content,
				},
			],
			warnings,
		};
	}

	const parts: (
		| ChatMessagePartTextData
		| ChatMessagePartToolCallRequestData
	)[] = [];
	for (const part of content) {
		if (part.type === "text") {
			parts.push({
				type: "text",
				text: part.text,
			});
		} else if (part.type === "tool-call") {
			const args = z.record(z.string(), z.unknown()).safeParse(part.input);
			if (!args.success) {
				throw new InvalidToolInputError({
					toolInput: JSON.stringify(part.input),
					toolName: part.toolName,
					cause: "Top-level arguments must be a record with string keys",
				});
			}
			parts.push({
				type: "toolCallRequest",
				toolCallRequest: {
					id: part.toolCallId,
					type: "function",
					name: part.toolName,
					arguments: args.data,
				},
			});
		} else {
			warnings.push({
				message: `Unsupported content type: ${part.type}`,
				type: "other",
			});
		}
	}

	return { parts, warnings };
}

function convertToolContent(content: ToolContent): {
	parts: ChatMessagePartToolCallResultData[];
	warnings: LanguageModelV2CallWarning[];
} {
	const warnings: LanguageModelV2CallWarning[] = [];

	const parts: ChatMessagePartToolCallResultData[] = [];
	for (const part of content) {
		if (part.type === "tool-result") {
			parts.push({
				type: "toolCallResult",
				toolCallId: part.toolCallId,
				content: JSON.stringify(part.output),
			});
		} else {
			warnings.push({
				message: `Unsupported content type: ${part.type}`,
				type: "other",
			});
		}
	}

	return { parts, warnings };
}

export function covertVercelMessagesToLMStudioMessages(
	messages: LanguageModelV2Prompt,
): { messages: ChatMessageData[]; warnings: LanguageModelV2CallWarning[] } {
	const lmstudioMessages: ChatMessageData[] = [];
	const warnings: LanguageModelV2CallWarning[] = [];

	for (const message of messages) {
		if (message.role === "user") {
			const { parts, warnings: userContentWarnings } = convertUserContent(
				message.content,
			);
			lmstudioMessages.push({
				role: "user",
				content: parts,
			});
			warnings.push(...userContentWarnings);
		} else if (message.role === "assistant") {
			const { parts, warnings: assistantContentWarnings } =
				convertAssistantContent(message.content);
			lmstudioMessages.push({
				role: "assistant",
				content: parts,
			});
			warnings.push(...assistantContentWarnings);
		} else if (message.role === "system") {
			lmstudioMessages.push({
				role: "system",
				content: [
					{
						type: "text",
						text: message.content,
					},
				],
			});
		} else if (message.role === "tool") {
			const { parts, warnings: toolContentWarnings } = convertToolContent(
				message.content,
			);
			lmstudioMessages.push({
				role: "tool",
				content: parts,
			});
			warnings.push(...toolContentWarnings);
		}
	}

	return { messages: lmstudioMessages, warnings };
}
