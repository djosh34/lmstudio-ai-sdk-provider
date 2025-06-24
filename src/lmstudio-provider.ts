import type { LMStudioClientConstructorOpts } from "@lmstudio/sdk";
import { LMStudioChatLanguageModel } from "./lmstudio-chat-model";
import type {
	LMStudioChatInputSettings,
	LMStudioChatModelId,
} from "./types/lmstudio-types";

export interface LMStudioProvider {
	(
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
	): LMStudioChatLanguageModel;

	languageModel(
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
	): LMStudioChatLanguageModel;

	chat(
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
	): LMStudioChatLanguageModel;
}

export function createLMStudio(
	options: LMStudioChatInputSettings = {},
	lmstudioClientSettings?: LMStudioClientConstructorOpts,
): LMStudioProvider {
	const createChatModel = ( modelId: LMStudioChatModelId,) => {
		if (new.target) {
			throw new Error(
				"The LMStudio model function cannot be called with the new keyword.",
			);
		}

		const model = new LMStudioChatLanguageModel(modelId, options, lmstudioClientSettings);
		return model;
	};

	const createLanguageModel = (
		modelId: LMStudioChatModelId,
	) => {
		if (new.target) {
			throw new Error(
				"The LMStudio model function cannot be called with the new keyword.",
			);
		}
		return createChatModel(modelId);
	};

	const provider = (
		modelId: LMStudioChatModelId,
	) => {
		return createChatModel(modelId);
	};

	provider.languageModel = createLanguageModel;
	provider.chat = createChatModel;

	return provider as LMStudioProvider;
}
