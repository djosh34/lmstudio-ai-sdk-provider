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
	providerSettings: LMStudioChatInputSettings = {},
): LMStudioProvider {
	const createChatModel = (
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
	) => {
		if (new.target) {
			throw new Error(
				"The LMStudio model function cannot be called with the new keyword.",
			);
		}
		if (!settings) {
			return new LMStudioChatLanguageModel(modelId, providerSettings);
		}

		const model = new LMStudioChatLanguageModel(modelId, settings);
		return model;
	};

	const createLanguageModel = (
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
	) => {
		if (new.target) {
			throw new Error(
				"The LMStudio model function cannot be called with the new keyword.",
			);
		}
		return createChatModel(modelId, settings);
	};

	const provider = (
		modelId: LMStudioChatModelId,
		settings?: LMStudioChatInputSettings,
	) => {
		return createChatModel(modelId, settings);
	};

	provider.languageModel = createLanguageModel;
	provider.chat = createChatModel;

	return provider as LMStudioProvider;
}
