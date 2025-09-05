import type {
	LanguageModelV2,
	LanguageModelV2Content,
	LanguageModelV2FunctionTool,
	LanguageModelV2ProviderDefinedTool,
	LanguageModelV2StreamPart,
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
import { getTools } from "./utils/lmstudio-tools";
import { convertContent } from "./utils/lmstudio-convert-content";
import { generateId } from "ai";

function isFunctionTool(
	tool: LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool,
): tool is LanguageModelV2FunctionTool {
	return "parameters" in tool;
}

type DoGenerateOutput = Awaited<ReturnType<LanguageModelV2["doGenerate"]>>;
type DoStreamOutput = Awaited<ReturnType<LanguageModelV2["doStream"]>>;

export class LMStudioChatLanguageModel implements LanguageModelV2 {
	readonly specificationVersion = "v2";
	readonly defaultObjectGenerationMode = "object-tool";
	readonly supportedUrls = {};

	readonly modelId: LMStudioChatModelId;
	readonly settings: LMStudioChatInputSettings;

	readonly client: LMStudioClient;
	private modelPromise: Promise<LLM>;
	private _model: LLM | null = null;

	constructor(
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
		clientSettings?: LMStudioClientConstructorOpts,
	) {
		this.modelId = modelId;
		this.settings = settings ?? {};

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

		if (this.settings.baseURL) {
			lmstudioClientSettings.baseUrl = this.settings.baseURL;
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
		options: Parameters<LanguageModelV2["doGenerate"]>[0],
	): Promise<DoGenerateOutput> {
		const opts = convertLMStudioChatCallOptions(
			this.provider,
			options,
			this.settings,
		);

		const { messages: chatMessages, warnings } =
			covertVercelMessagesToLMStudioMessages(options.prompt);

		const model = await this.getModel();
		const { tools, warnings: toolWarnings } = getTools(options);
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
			// await model.act("What is the meaning of life? speak for long...", [], callbackOpts);
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

		// const toolCalls = getToolCalls(receivedChatMessages);
		// if (toolCalls.length > 0) {
		// 	const content: LanguageModelV2Content[] = [];
		// 	if (predictionResult.nonReasoningContent) {
		// 		content.push({
		// 			type: "text",
		// 			text: predictionResult.nonReasoningContent,
		// 		});
		// 	}
		// 	if (predictionResult.reasoningContent) {
		// 		content.push({
		// 			type: "reasoning",
		// 			text: predictionResult.reasoningContent,
		// 		});
		// 	}
		// 	return {
		// 		content: content,
		// 		finishReason: "tool-calls",
		// 		usage: {
		// 			inputTokens: predictionResult.stats.promptTokensCount ?? 0,
		// 			outputTokens: predictionResult.stats.predictedTokensCount ?? 0,
		// 			totalTokens: predictionResult.stats.totalTokensCount ?? 0,
		// 		},
		// 		request: {
		// 			body: {
		// 				rawPrompt: chatMessages,
		// 				rawSettings: {
		// 					...allOpts,
		// 				},
		// 			},
		// 		},
		// 		response: {
		// 			headers: {},
		// 			body: predictionResult,
		// 			modelId: predictionResult.modelInfo.identifier,
		// 		},
		// 		toolCalls: toolCalls,
		// 		warnings: warnings,
		// 	};
		// }

		const finishReason = mapLMStudioFinishReason(
			predictionResult.stats.stopReason,
		);

		const content: LanguageModelV2Content[] = convertContent(receivedChatMessages);
		// const content: LanguageModelV2Content[] = [];
		// if (predictionResult.nonReasoningContent) {
		// 	content.push({
		// 		type: "text",
		// 		text: predictionResult.nonReasoningContent,
		// 	});
		// }
		// if (predictionResult.reasoningContent) {
		// 	content.push({
		// 		type: "reasoning",
		// 		text: predictionResult.reasoningContent,
		// 	});
		// }

		return {
			content: content,
			finishReason: finishReason,
			usage: {
				inputTokens: predictionResult.stats.promptTokensCount ?? 0,
				outputTokens: predictionResult.stats.predictedTokensCount ?? 0,
				totalTokens: predictionResult.stats.totalTokensCount ?? 0,
			},
			request: {
				body: {
					rawPrompt: chatMessages,
					rawSettings: {
						...allOpts,
					},
				},
			},
			response: {
				headers: {},
				body: predictionResult,
				modelId: predictionResult.modelInfo.identifier,
			},
			warnings: warnings,
		};
	}

	async doStream(
		options: Parameters<LanguageModelV2["doStream"]>[0],
	): Promise<DoStreamOutput> {
		const opts = convertLMStudioChatCallOptions(
			this.provider,
			options,
			this.settings,
		);

		const { messages: chatMessages, warnings } =
			covertVercelMessagesToLMStudioMessages(options.prompt);

		const model = await this.getModel();
		const { tools, warnings: toolWarnings } = getTools(options);
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
				controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>,
			) {
				let textStarted = false;
				const textId = generateId();
				const reasoningId = generateId();

				const callbackOpts: LLMActBaseOpts<PredictionResult> = {
					onPredictionFragment: (
						fragment: LLMPredictionFragmentWithRoundIndex,
					) => {
						const reasoningType = fragment.reasoningType;

						// Ignore reasoning start and end tags

						if (reasoningType === "reasoning") {
							controller.enqueue({
								type: "reasoning-delta",
								id: reasoningId,
								delta: fragment.content,
							});
						} else if (reasoningType === "reasoningStartTag") {
							controller.enqueue({
								type: "reasoning-start",
								id: reasoningId,
							});
						} else if (reasoningType === "reasoningEndTag") {
							controller.enqueue({
								type: "reasoning-end",
								id: reasoningId,
							});
						} else if (reasoningType === "none") {
							if (!textStarted) {
								textStarted = true;
								controller.enqueue({
									type: "text-start",
									id: textId,
								});
							}
							controller.enqueue({
								type: "text-delta",
								id: textId,
								delta: fragment.content,
							});
						}
					},
					onMessage: (message) => {
						const messageWithAccess = new ChatMessageWithAccess(message);
						const messageData = messageWithAccess.getData();

						const toolCalls = convertContent([messageData]).filter(
							(content) => content.type === "tool-call",
						);

						for (const toolCall of toolCalls) {
							toolWasCalled = true;
							controller.enqueue({
								type: "tool-call",
								toolCallId: toolCall.toolCallId,
								toolName: toolCall.toolName,
								input: toolCall.input,
							});
						}
					},
					onRoundEnd: (roundIndex) => {
						abortController.abort(ALWAYS_ABORT_AFTER_TOOL_CALL_REASON);
					},
					onPredictionCompleted: (prediction) => {
						optionalPredictionResult = prediction;
					},
					// signal: abortController.signal,
					allowParallelToolExecution: true,
					maxPredictionRounds: 100,
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
						inputTokens: predictionResult.stats.promptTokensCount ?? 0,
						outputTokens: predictionResult.stats.predictedTokensCount ?? 0,
						totalTokens: predictionResult.stats.totalTokensCount ?? 0,
					},
				});

				controller.close();
			},
		});

		return {
			stream: stream,
			request: {
				body: {
					rawPrompt: chatMessages,
					rawSettings: {
						...opts,
					},
				},
			},
			response: {
				headers: {},
			},
		};
	}
}
