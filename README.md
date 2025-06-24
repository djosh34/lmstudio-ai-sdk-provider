# LM Studio AI SDK Provider

LM Studio provider for the [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) with proper token usage tracking.

## Why This Provider?

The OpenAI-compatible client doesn't track token usage during streaming. This provider uses the [LM Studio TypeScript SDK](https://lmstudio.ai/docs/typescript) which has better support and proper token tracking.

## Requirements

- Node.js 18+
- [LM Studio](https://lmstudio.ai/) running locally or remotely

## Installation

```bash
npm install @djosh34/lmstudio-ai-sdk-provider
```

## Usage

```typescript
import { createLMStudio } from '@djosh34/lmstudio-ai-sdk-provider';
import { generateText, streamText } from 'ai';

// Create provider (uses localhost:1234 by default)
const lmstudio = createLMStudio();

// Generate text
const { text } = await generateText({
  model: lmstudio('your-model-name'),
  prompt: 'Hello, world!',
});

// Stream text
const { textStream } = await streamText({
  model: lmstudio('your-model-name'),
  prompt: 'Tell me a story',
});

for await (const delta of textStream) {
  process.stdout.write(delta);
}
```

## Tool Calling Example

```typescript
import { createLMStudio } from '@djosh34/lmstudio-ai-sdk-provider';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const lmstudio = createLMStudio();

const { text } = await generateText({
  model: lmstudio('your-model-name'),
  prompt: 'Calculate 15 + 27',
  tools: {
    calculator: tool({
      description: 'A calculator tool',
      parameters: z.object({
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ a, b }) => a + b,
    }),
  },
});
```

## Configuration

```typescript
import { createLMStudio } from '@djosh34/lmstudio-ai-sdk-provider';

// Custom LM Studio server
const lmstudio = createLMStudio({
  // LM Studio connection settings go here
  // See LM Studio TypeScript SDK docs for options
});

// Provider-specific options
const { text } = await generateText({
  model: lmstudio('your-model-name'),
  prompt: 'Hello!',
  providerOptions: {
    lmstudio: {
      contextOverflowPolicy: 'stopAtLimit',
      // Other LM Studio specific options
    }
  }
});
```

## What Works

- Text generation
- Text streaming
- Tool calling
- Token usage tracking
- Reasoning parsing (for supported models)
- All LM Studio-specific features

## What Doesn't Work

- Image generation (LM Studio limitation)
- Embeddings (use dedicated embedding models)

## API Reference

### `createLMStudio(settings?)`

Creates an LM Studio provider instance.

- `settings`: Optional LM Studio connection and model settings

### Provider Methods

- `lmstudio(modelId, settings?)` - Create a chat model
- `lmstudio.chat(modelId, settings?)` - Alias for the above
- `lmstudio.languageModel(modelId, settings?)` - Alias for the above

## License

Apache-2.0