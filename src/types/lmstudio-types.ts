import {
	type KVConfig,
	type LLMContextOverflowPolicy,
	type LLMReasoningParsing,
	type LLMPromptTemplate,
	type LLMTool,
	type LLMToolParameters,
	type LLMToolUseSetting,
	type ChatMessageData,
	ChatMessage,
} from "@lmstudio/sdk";
import { z } from "zod";

export type LMStudioChatModelId = string;

const LLMToolZodSchema = z.object({
	type: z.literal("function"),
	function: z.object({
		name: z.string(),
		description: z.string().optional(),
		parameters: z
			.object({
				type: z.literal("object"),
				properties: z.record(z.string(), z.any()),
				required: z.array(z.string()).optional(),
				additionalProperties: z.boolean().optional(),
			})
			.optional(),
	}),
}) satisfies z.ZodType<LLMTool>;

const LLMToolUseSettingZodSchema = z
	.object({
		type: z.literal("none"),
	})
	.or(
		z.object({
			type: z.literal("toolArray"),
			tools: z.array(LLMToolZodSchema),
			force: z.boolean().optional().default(false),
		}),
	) satisfies z.ZodType<LLMToolUseSetting>;

export interface LMStudioChatInputSettings {

	/**
	 * Base URL for the LM Studio instance.
	 * 
	 * When not specified, connects to LM Studio on localhost by default.
	 * To connect to a remote LM Studio instance, enable "Serve on Local Network" 
	 * in LM Studio settings and use the format: ws://[ip]:[port] (no trailing slashes).
	 * 
	 * @example
	 * ```typescript
	 * // Connect to remote LM Studio instance
	 * baseURL: "ws://192.168.1.100:1234"
	 * ```
	 */
	baseURL?: string;

	contextOverflowPolicy?: LLMContextOverflowPolicy;
	toolCallStopStrings?: string[];
	xtcProbability?: number;
	xtcThreshold?: number;
	cpuThreads?: number;
	draftModel?: string;
	reasoningParsing?: LLMReasoningParsing;
	preset?: string;
	minPSampling?: number;

	// deprecated options
	logProbs?: number | false;
	promptTemplate?: LLMPromptTemplate;
	rawTools?: LLMToolUseSetting;

	// experimental options
	speculativeDecodingNumDraftTokensExact?: number;
	speculativeDecodingMinDraftLengthToConsider?: number;
	speculativeDecodingMinContinueDraftingProbability?: number;
	raw?: KVConfig;
}

export const LMStudioChatConfigZodSchema = z.object({
	contextOverflowPolicy: z
		.enum(["stopAtLimit", "truncateMiddle", "rollingWindow"])
		.optional(),
	toolCallStopStrings: z.array(z.string()).optional(),
	xtcProbability: z.number().optional(),
	xtcThreshold: z.number().optional(),
	cpuThreads: z.number().optional(),
	draftModel: z.string().optional(),
	reasoningParsing: z
		.object({
			enabled: z.boolean(),
			startString: z.string(),
			endString: z.string(),
		})
		.optional(),
	preset: z.string().optional(),
	minPSampling: z.number().optional(),

	logProbs: z.number().optional(),
	promptTemplate: z.any().optional(),
	rawTools: LLMToolUseSettingZodSchema.optional(),

	speculativeDecodingNumDraftTokensExact: z.number().optional(),
	speculativeDecodingMinDraftLengthToConsider: z.number().optional(),
	speculativeDecodingMinContinueDraftingProbability: z.number().optional(),
	raw: z
		.object({
			fields: z.array(
				z.object({
					key: z.string(),
					value: z.any().optional(),
				}),
			),
		})
		.optional(),
}) satisfies z.ZodType<LMStudioChatInputSettings>;

export const ALWAYS_ABORT_AFTER_TOOL_CALL_REASON =
	"ALWAYS_ABORT_AFTER_TOOL_CALL_REASON";

export class ChatMessageWithAccess extends ChatMessage {
	constructor(message: ChatMessage) {
		super((message as unknown as ChatMessageWithAccess).data, true);
		Object.setPrototypeOf(this, ChatMessageWithAccess.prototype);
	}

	getData(): ChatMessageData {
		const data = this.data;
		return data;
	}
}
