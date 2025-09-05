import type { LanguageModelV2Content } from "@ai-sdk/provider";
import type { ChatMessageData } from "@lmstudio/sdk";
import { generateId } from "ai";

export function convertContent(content: ChatMessageData[]): LanguageModelV2Content[] {
    const convertedContent: LanguageModelV2Content[] = [];
	for (const message of content) {
        if (message.role === "user") {
            for (const part of message.content) {
                if (part.type === "text") {
                    convertedContent.push({
                        type: "text",
                        text: part.text,
                    });
                }
                // TODO file
            }
        }
		if (message.role === "assistant") {
			for (const part of message.content) {
                if (part.type === "text") {
                    convertedContent.push({
                        type: "text",
                        text: part.text,
                    });
                }
				if (part.type === "toolCallRequest") {
					convertedContent.push({
                        type: "tool-call",
						toolCallId: part.toolCallRequest.id ?? generateId(),
						toolName: part.toolCallRequest.name,
						input: JSON.stringify(part.toolCallRequest.arguments),
					});
				}
                // TODO file
			}
		}
        if (message.role === "system") {
            for (const part of message.content) {
                if (part.type === "text") {
                    convertedContent.push({
                        type: "text",
                        text: part.text,
                    });
                }
                // TODO file
            }
        }
        // Don't need this, since the model obviously doesn't create toolCallResults
        // if (message.role === "tool") {
        //     for (const part of message.content) {
        //         if (part.type === "toolCallResult") {
        //             convertedContent.push({
        //                 type: "tool-result",
        //                 toolCallId: part.toolCallId ?? "NO_ID",
        //                 toolName: part.toolCallRequest.name,
        //                 result: JSON.parse(part.content),
        //             });
        //         }
        //     }
        // }
	}
    return convertedContent;
}
