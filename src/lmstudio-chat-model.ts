import type {
	LanguageModelV1,
	LanguageModelV1FunctionTool,
	LanguageModelV1FunctionToolCall,
	LanguageModelV1ProviderDefinedTool,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import { NoContentGeneratedError, NoSuchModelError } from "@ai-sdk/provider";
import type {
	LMStudioChatModelId,
	LMStudioChatInputSettings,
} from "./types/lmstudio-types";
import {
	ALWAYS_ABORT_AFTER_TOOL_CALL_REASON,
	ChatMessageWithAccess,
} from "./types/lmstudio-types";

import { z } from "zod";
import { convertLMStudioChatCallOptions } from "./lmstudio-convert-options";
import { covertVercelMessagesToLMStudioMessages } from "./lmstudio-convert-messages";
import {
	type LMStudioClientConstructorOpts,
	LMStudioClient,
	type LLM,
	type Tool,
	type LLMActBaseOpts,
	type PredictionResult,
	type ChatMessageData,
	type LLMPredictionFragmentWithRoundIndex,
} from "@lmstudio/sdk";
import { mapLMStudioFinishReason } from "./utils/lmstudio-map-finish-reason";
import { getToolCalls, getTools } from "./utils/lmstudio-tools";

function isFunctionTool(
	tool: LanguageModelV1FunctionTool | LanguageModelV1ProviderDefinedTool,
): tool is LanguageModelV1FunctionTool {
	return "parameters" in tool;
}

type DoGenerateOutput = Awaited<ReturnType<LanguageModelV1["doGenerate"]>>;
type DoStreamOutput = Awaited<ReturnType<LanguageModelV1["doStream"]>>;

export class LMStudioChatLanguageModel implements LanguageModelV1 {
	readonly specificationVersion = "v1";
	readonly defaultObjectGenerationMode = "tool";

	readonly modelId: LMStudioChatModelId;
	readonly settings: LMStudioChatInputSettings;

	readonly client: LMStudioClient;
	private modelPromise: Promise<LLM>;
	private _model: LLM | null = null;

	constructor(
		modelId: LMStudioChatModelId,
		settings: LMStudioChatInputSettings,
		clientSettings?: LMStudioClientConstructorOpts,
	) {
		this.modelId = modelId;
		this.settings = settings;

		const lmstudioClientSettings: LMStudioClientConstructorOpts =
			clientSettings ?? {};
		if (!lmstudioClientSettings.logger) {
			lmstudioClientSettings.logger = {
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
			};
		}

		this.client = new LMStudioClient(lmstudioClientSettings);

		this.modelPromise = this.client.llm.load(modelId);
		this._model = null;
	}

	get provider(): string {
		return "lmstudio";
	}

	async getModel(): Promise<LLM> {
		if (this._model) {
			return this._model;
		}

		const awaitModel = async (): Promise<LLM> => {
			try {
				const model = await this.modelPromise;
				this._model = model;

				return model;
			} catch (error) {
				if (
					error instanceof Error &&
					"title" in error &&
					typeof error.title === "string" &&
					error.title.startsWith("Model not found: ")
				) {
					throw new NoSuchModelError({
						errorName: "ModelNotFoundError",
						modelId: this.modelId,
						modelType: "languageModel",
						message: error.title,
					});
				}

				throw new Error(`Failed to load model ${this.modelId}: ${error}`);
			}
		};

		return await awaitModel();
	}

	async doGenerate(
		options: Parameters<LanguageModelV1["doGenerate"]>[0],
	): Promise<DoGenerateOutput> {
		const opts = convertLMStudioChatCallOptions(
			this.provider,
			options,
			this.settings,
		);

		const { messages: chatMessages, warnings } =
			covertVercelMessagesToLMStudioMessages(options.prompt);

		const model = await this.getModel();
		const { tools, warnings: toolWarnings } = getTools(options.mode);
		warnings.push(...toolWarnings);

		const vercelAbortSignal = options.abortSignal;
		const abortController = new AbortController();

		let optionalPredictionResult: PredictionResult | null = null;

		if (vercelAbortSignal) {
			vercelAbortSignal.onabort = () => {
				const reason = vercelAbortSignal.reason;
				abortController.abort(reason);
			};
		}

		const receivedChatMessages: ChatMessageData[] = [];
		const callbackOpts: LLMActBaseOpts<PredictionResult> = {
			onMessage: (message) => {
				const messageWithAccess = new ChatMessageWithAccess(message);
				receivedChatMessages.push(messageWithAccess.getData());
			},
			onRoundEnd: () => {
				abortController.abort(ALWAYS_ABORT_AFTER_TOOL_CALL_REASON);
			},
			onPredictionCompleted: (prediction) => {
				optionalPredictionResult = prediction;
			},
			signal: abortController.signal,
			allowParallelToolExecution: true,
		};

		const allOpts = {
			...opts,
			...callbackOpts,
		};

		try {
			await model.act({ messages: chatMessages }, tools, allOpts);
		} catch (error) {
			const isAborted =
				abortController.signal.aborted &&
				abortController.signal.reason === ALWAYS_ABORT_AFTER_TOOL_CALL_REASON;
			if (!isAborted) {
				throw error;
			}
		}

		if (!optionalPredictionResult) {
			throw new NoContentGeneratedError({
				message: "No content generated",
			});
		}

		const predictionResult = optionalPredictionResult as PredictionResult;

		const toolCalls = getToolCalls(receivedChatMessages);
		if (toolCalls.length > 0) {
			return {
				text: predictionResult.nonReasoningContent ?? undefined,
				reasoning: predictionResult.reasoningContent ?? undefined,
				finishReason: "tool-calls",
				usage: {
					promptTokens: predictionResult.stats.promptTokensCount ?? 0,
					completionTokens: predictionResult.stats.predictedTokensCount ?? 0,
				},
				rawCall: {
					rawPrompt: chatMessages,
					rawSettings: {
						...allOpts,
					},
				},
				rawResponse: {
					headers: {},
					body: predictionResult,
				},
				response: {
					modelId: predictionResult.modelInfo.identifier,
				},
				toolCalls: toolCalls,
				warnings: warnings,
			};
		}

		const finishReason = mapLMStudioFinishReason(
			predictionResult.stats.stopReason,
		);

		return {
			text: predictionResult.nonReasoningContent ?? undefined,
			reasoning: predictionResult.reasoningContent ?? undefined,
			finishReason: finishReason,
			usage: {
				promptTokens: predictionResult.stats.promptTokensCount ?? 0,
				completionTokens: predictionResult.stats.predictedTokensCount ?? 0,
			},
			rawCall: {
				rawPrompt: chatMessages,
				rawSettings: {
					...allOpts,
				},
			},
			rawResponse: {
				headers: {},
				body: predictionResult,
			},
			response: {
				modelId: predictionResult.modelInfo.identifier,
			},
			toolCalls: toolCalls,
			warnings: warnings,
		};
	}

	async doStream(
		options: Parameters<LanguageModelV1["doStream"]>[0],
	): Promise<DoStreamOutput> {
		const opts = convertLMStudioChatCallOptions(
			this.provider,
			options,
			this.settings,
		);

		const { messages: chatMessages, warnings } =
			covertVercelMessagesToLMStudioMessages(options.prompt);

		const model = await this.getModel();
		const { tools, warnings: toolWarnings } = getTools(options.mode);
		warnings.push(...toolWarnings);

		const vercelAbortSignal = options.abortSignal;
		const abortController = new AbortController();

		let optionalPredictionResult: PredictionResult | null = null;

		if (vercelAbortSignal) {
			vercelAbortSignal.onabort = () => {
				const reason = vercelAbortSignal.reason;
				abortController.abort(reason);
			};
		}

		let toolWasCalled = false;

		const stream = new ReadableStream({
			async start(
				controller: ReadableStreamDefaultController<LanguageModelV1StreamPart>,
			) {
				const callbackOpts: LLMActBaseOpts<PredictionResult> = {
					onPredictionFragment: (
						fragment: LLMPredictionFragmentWithRoundIndex,
					) => {
						const reasoningType = fragment.reasoningType;

						// Ignore reasoning start and end tags
						if (reasoningType === "reasoning") {
							controller.enqueue({
								type: "reasoning",
								textDelta: fragment.content,
							});
						} else if (reasoningType === "none") {
							controller.enqueue({
								type: "text-delta",
								textDelta: fragment.content,
							});
						}
					},
					onMessage: (message) => {
						const messageWithAccess = new ChatMessageWithAccess(message);
						const messageData = messageWithAccess.getData();

						const toolCalls = getToolCalls([messageData]);
						if (toolCalls.length > 0) {
							toolWasCalled = true;
						}

						for (const toolCall of toolCalls) {
							controller.enqueue({
								type: "tool-call",
								toolCallType: "function",
								toolCallId: toolCall.toolCallId,
								toolName: toolCall.toolName,
								args: toolCall.args,
							});
						}
					},
					onRoundEnd: () => {
						abortController.abort(ALWAYS_ABORT_AFTER_TOOL_CALL_REASON);
					},
					onPredictionCompleted: (prediction) => {
						optionalPredictionResult = prediction;
					},
					signal: abortController.signal,
					allowParallelToolExecution: true,
				};

				const allOpts = {
					...opts,
					...callbackOpts,
				};

				try {
					await model.act({ messages: chatMessages }, tools, allOpts);
				} catch (error) {
					const isAborted =
						abortController.signal.aborted &&
						abortController.signal.reason ===
							ALWAYS_ABORT_AFTER_TOOL_CALL_REASON;
					if (!isAborted) {
						throw error;
					}
				}

				if (!optionalPredictionResult) {
					throw new NoContentGeneratedError({
						message: "No content generated",
					});
				}

				let finishReason = mapLMStudioFinishReason(
					optionalPredictionResult.stats.stopReason,
				);
				if (toolWasCalled) {
					finishReason = "tool-calls";
				}

				const predictionResult = optionalPredictionResult as PredictionResult;

				controller.enqueue({
					type: "finish",
					finishReason: finishReason,
					usage: {
						promptTokens: predictionResult.stats.promptTokensCount ?? 0,
						completionTokens: predictionResult.stats.predictedTokensCount ?? 0,
					},
				});

				controller.close();
			},
		});

		return {
			stream: stream,
			rawCall: {
				rawPrompt: chatMessages,
				rawSettings: {
					...opts,
				},
			},
			rawResponse: {
				headers: {},
			},
			warnings: warnings,
		};
	}
}

function prepareToolsAndToolChoice(
	mode: Parameters<LanguageModelV1["doGenerate"]>[0]["mode"] & {
		type: "regular";
	},
) {
	// when the tools array is empty, change it to undefined to prevent errors:
	const tools = mode.tools?.length ? mode.tools : undefined;

	if (tools == null) {
		return { tools: undefined, tool_choice: undefined };
	}

	const mappedTools = tools.map((tool) => {
		if (isFunctionTool(tool)) {
			return {
				type: "function" as const,
				function: {
					name: tool.name,
					description: tool.description,
					parameters: tool.parameters,
				},
			};
		}

		return {
			type: "function" as const,
			function: {
				name: tool.name,
			},
		};
	});

	const toolChoice = mode.toolChoice;

	if (toolChoice == null) {
		return { tools: mappedTools, tool_choice: undefined };
	}

	const type = toolChoice.type;

	switch (type) {
		case "auto":
		case "none":
		case "required":
			return { tools: mappedTools, tool_choice: type };
		case "tool":
			return {
				tools: mappedTools,
				tool_choice: {
					type: "function",
					function: {
						name: toolChoice.toolName,
					},
				},
			};
		default: {
			const _exhaustiveCheck: never = type;
			throw new Error(`Unsupported tool choice type: ${_exhaustiveCheck}`);
		}
	}
}
