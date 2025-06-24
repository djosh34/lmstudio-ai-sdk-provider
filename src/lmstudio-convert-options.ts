import type { LanguageModelV1 } from "@ai-sdk/provider";
import type {
	LLMActionOpts,
	LLMStructuredPredictionSetting,
} from "@lmstudio/sdk";
import {
	FAKE_UNDEFINED,
	mapBackToOriginal,
	type Explicit,
} from "./utils/explicit-mapper";
import {
	type LMStudioChatInputSettings,
	LMStudioChatConfigZodSchema,
} from "./types/lmstudio-types";
import type { ZodIssue } from "zod";
import { ok, err, type Result } from "neverthrow";
import { InvalidArgumentError } from "ai";

function getStructured<TStructuredOutputType>(
	options: Parameters<LanguageModelV1["doGenerate"]>[0],
): Explicit<LLMActionOpts<TStructuredOutputType>>["structured"] {
	if (options.mode.type !== "object-json") {
		return FAKE_UNDEFINED;
	}

	const schema = options.mode.schema;

	const structured: LLMStructuredPredictionSetting = {
		type: "json",
		jsonSchema: schema,
	};

	return structured;
}

function getLMStudioChatConfig(
	provider: string,
	options: Parameters<LanguageModelV1["doGenerate"]>[0],
): Result<LMStudioChatInputSettings | null, ZodIssue[]> {
	const providerMetadata = options.providerMetadata;
	if (!providerMetadata) {
		return ok(null);
	}
	const optionsForLMStudio = providerMetadata[provider];
	if (!optionsForLMStudio) {
		return ok(null);
	}

	const parsed = LMStudioChatConfigZodSchema.safeParse(optionsForLMStudio);
	if (!parsed.success) {
		return err(parsed.error.issues);
	}

	return ok(parsed.data);
}

export function convertLMStudioChatCallOptions<TStructuredOutputType>(
	provider: string,
	generateOptions: Parameters<LanguageModelV1["doGenerate"]>[0],
	providerSettings: LMStudioChatInputSettings,
): LLMActionOpts<TStructuredOutputType> {
	const lmstudioOptions = getLMStudioChatConfig(provider, generateOptions);
	if (lmstudioOptions.isErr()) {
		for (const issue of lmstudioOptions.error) {
			throw new InvalidArgumentError({
				parameter: `\n\n=========================\nZOD ERROR: providerSettings.${issue.path.join(".")}`,
				value: issue.code,
				message: `\n${issue.message}\n\n`,
			});
		}
		throw new InvalidArgumentError({
			parameter: "providerSettings",
			value: lmstudioOptions.error,
			message:
				"Zod is complaining about the provider settings, but no issue is given",
		});
	}
	const lmstudioOptionsValue = lmstudioOptions.value;
	const options = {
		...generateOptions,
		...providerSettings,
		...lmstudioOptionsValue,
	} satisfies LMStudioChatInputSettings;

	const explicitOptions: Explicit<LLMActionOpts<TStructuredOutputType>> = {
		maxTokens: options.maxTokens ?? FAKE_UNDEFINED,
		temperature: options.temperature ?? FAKE_UNDEFINED,

		stopStrings: options.stopSequences ?? FAKE_UNDEFINED,
		topKSampling: options.topK ?? FAKE_UNDEFINED,
		topPSampling: options.topP ?? FAKE_UNDEFINED,

		repeatPenalty: options.frequencyPenalty ?? FAKE_UNDEFINED,

		structured: getStructured(options),

		// Are handled by call
		maxPredictionRounds: FAKE_UNDEFINED,
		signal: FAKE_UNDEFINED,

		allowParallelToolExecution: true,

		// LMStudio specific options
		contextOverflowPolicy:
			lmstudioOptionsValue?.contextOverflowPolicy ?? FAKE_UNDEFINED,
		toolCallStopStrings:
			lmstudioOptionsValue?.toolCallStopStrings ?? FAKE_UNDEFINED,
		xtcProbability: lmstudioOptionsValue?.xtcProbability ?? FAKE_UNDEFINED,
		xtcThreshold: lmstudioOptionsValue?.xtcThreshold ?? FAKE_UNDEFINED,
		cpuThreads: lmstudioOptionsValue?.cpuThreads ?? FAKE_UNDEFINED,
		draftModel: lmstudioOptionsValue?.draftModel ?? FAKE_UNDEFINED,
		reasoningParsing: lmstudioOptionsValue?.reasoningParsing ?? FAKE_UNDEFINED,
		preset: lmstudioOptionsValue?.preset ?? FAKE_UNDEFINED,
		minPSampling: lmstudioOptionsValue?.minPSampling ?? FAKE_UNDEFINED,

		// deprecated options so let them be undefined
		logProbs: lmstudioOptionsValue?.logProbs ?? FAKE_UNDEFINED,
		promptTemplate: lmstudioOptionsValue?.promptTemplate ?? FAKE_UNDEFINED,
		rawTools: lmstudioOptionsValue?.rawTools ?? FAKE_UNDEFINED,

		// experimental options
		speculativeDecodingNumDraftTokensExact:
			lmstudioOptionsValue?.speculativeDecodingNumDraftTokensExact ??
			FAKE_UNDEFINED,
		speculativeDecodingMinDraftLengthToConsider:
			lmstudioOptionsValue?.speculativeDecodingMinDraftLengthToConsider ??
			FAKE_UNDEFINED,
		speculativeDecodingMinContinueDraftingProbability:
			lmstudioOptionsValue?.speculativeDecodingMinContinueDraftingProbability ??
			FAKE_UNDEFINED,
		raw: lmstudioOptionsValue?.raw ?? FAKE_UNDEFINED,

		onFirstToken: FAKE_UNDEFINED,
		onPredictionFragment: FAKE_UNDEFINED,
		onMessage: FAKE_UNDEFINED,
		onRoundStart: FAKE_UNDEFINED,
		onRoundEnd: FAKE_UNDEFINED,
		onPredictionCompleted: FAKE_UNDEFINED,
		onPromptProcessingProgress: FAKE_UNDEFINED,
		onToolCallRequestStart: FAKE_UNDEFINED,
		onToolCallRequestEnd: FAKE_UNDEFINED,
		onToolCallRequestFailure: FAKE_UNDEFINED,
		onToolCallRequestDequeued: FAKE_UNDEFINED,
		handleInvalidToolRequest: FAKE_UNDEFINED,
	};

	const mappedOptions: LLMActionOpts<TStructuredOutputType> =
		mapBackToOriginal(explicitOptions);

	return mappedOptions;
}
