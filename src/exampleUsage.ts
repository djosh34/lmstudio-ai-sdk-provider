import { createLMStudio } from "@/lmstudio-provider";
import type { LMStudioChatInputSettings } from "@/types/lmstudio-types";
import { generateText, streamText, tool, type CoreMessage } from "ai";
import { z } from "zod";

export async function callLMStudio() {
	await callLMStudioStream();
}

export async function callLMStudioGenerate() {
	const model = createLMStudio().chat("qwen3-1.7b-dwq");

	const messages: CoreMessage[] = [
		// {
		// 	role: "user",
		// 	content: "What is the meaning of life?",
		// },
		// {
		// 	role: "user",
		// 	content:
		// 		"Fill in all the parameters of the calculator tool, doesn't matter what the values are as long as they are valid",
		// },
		{
			role: "user",
			content: "Use the calculator tool to calculate 1 + 1",
		},
		// {
		//     role: "user",
		//     content: "You must first call both get_current_time and get_current_time2 with valid parameters, and then say thank you to me",
		// },
	];
	// {
	//     name: "get_current_time",
	//     description: "Get the current time",
	//     parametersSchema: z.object({
	//         time_zone: z.string(),
	//     }),
	//     type: "function" as const,
	//     checkParameters: () => {},
	//     implementation: (_params, toolCallContext) => {},
	// },
	// {
	//     name: "get_current_time2",
	//     description: "Get the current time2",
	//     parametersSchema: z.object({
	//         time_zone: z.string(),
	//     }),
	//     type: "function" as const,
	//     checkParameters: () => {},
	//     implementation: (_params, toolCallContext) => {},
	// },

	const result = await generateText({
		model: model,
		messages: messages,
		tools: {
			calculator: tool({
				description: "A calculator",
				parameters: z.object({ a: z.number(), b: z.number() }),

				execute: async ({ a, b }) => {
					return a + b;
				},
			}),
			// get_current_time: tool({
			// 	description: "Get the current time",
			// 	parameters: z.object({
			// 		time_zone: z.string(),
			// 	}),
			// 	execute: async ({ time_zone }) => {
			// 		return "correct";
			// 	},
			// }),
			// get_current_time2: tool({
			// 	description: "Get the current time2",
			// 	parameters: z.object({
			// 		time_zone: z.string(),
			// 	}),
			// 	execute: async ({ time_zone }) => {
			// 		return "correct2";
			// 	},
			// }),
		},
		providerOptions: {
			lmstudio: {
				contextOverflowPolicy: "stopAtLimit",
			},
		},
		maxSteps: 10,
	});

	// result.response.body = null;
	// console.log(JSON.stringify(result, null, 2));
	// console.log(result.reasoning);
	// console.log(result.text);
	// console.log(result.toolCalls);
	// console.log(JSON.stringify(result.warnings, null, 2));
}

export async function callLMStudioStream() {
	const model = createLMStudio().chat("qwen3-1.7b-dwq");

	const messages: CoreMessage[] = [
		// {
		// 	role: "user",
		// 	content: "What is the meaning of life?",
		// },
		// {
		// 	role: "user",
		// 	content:
		// 		"Fill in all the parameters of the calculator tool, doesn't matter what the values are as long as they are valid",
		// },
		{
			role: "user",
			content:
				"Use the calculator tool to calculate 1 + 1, but also think a bit",
		},
		// {
		//     role: "user",
		//     content: "You must first call both get_current_time and get_current_time2 with valid parameters, and then say thank you to me",
		// },
	];
	// {
	//     name: "get_current_time",
	//     description: "Get the current time",
	//     parametersSchema: z.object({
	//         time_zone: z.string(),
	//     }),
	//     type: "function" as const,
	//     checkParameters: () => {},
	//     implementation: (_params, toolCallContext) => {},
	// },
	// {
	//     name: "get_current_time2",
	//     description: "Get the current time2",
	//     parametersSchema: z.object({
	//         time_zone: z.string(),
	//     }),
	//     type: "function" as const,
	//     checkParameters: () => {},
	//     implementation: (_params, toolCallContext) => {},
	// },

	const result = streamText({
		model: model,
		messages: messages,
		tools: {
			calculator: tool({
				description: "A calculator",
				parameters: z.object({ a: z.number(), b: z.number() }),

				execute: async ({ a, b }) => {
					return a + b;
				},
			}),
			// get_current_time: tool({
			// 	description: "Get the current time",
			// 	parameters: z.object({
			// 		time_zone: z.string(),
			// 	}),
			// 	execute: async ({ time_zone }) => {
			// 		return "correct";
			// 	},
			// }),
			// get_current_time2: tool({
			// 	description: "Get the current time2",
			// 	parameters: z.object({
			// 		time_zone: z.string(),
			// 	}),
			// 	execute: async ({ time_zone }) => {
			// 		return "correct2";
			// 	},
			// }),
		},
		providerOptions: {
			lmstudio: {
				contextOverflowPolicy: "stopAtLimit",
			},
		},
		maxSteps: 20,
		toolCallStreaming: true,
	});

	for await (const chunk of result.fullStream) {
		if (chunk.type === "reasoning" || chunk.type === "text-delta") {
			process.stdout.write(chunk.textDelta);
		}
		// console.log(JSON.stringify(chunk, null, 2));
	}

	// result.response.body = null;
	// console.log(JSON.stringify(result, null, 2));
	// console.log(result.reasoning);
	// console.log(result.text);
	// console.log(result.toolCalls);
	// console.log(JSON.stringify(result.warnings, null, 2));
}
// toolCallStreaming: true,
