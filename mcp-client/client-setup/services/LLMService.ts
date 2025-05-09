import fetch from "node-fetch";
import { OllamaResponse } from "../types/interfaces.js";
import { config } from "../config/config.js";

export class LLMService {
  constructor(private tools: () => any[]) {}

  private buildSystemPrompt(): string {
    const toolsDescription = this.tools().map(tool =>
      `Tool: ${tool.name}\nDescription: ${tool.description}\nInput Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`
    ).join("\n\n");

    return `You are an assistant with access to the following tools: ${toolsDescription}
When you need to use a tool, respond using this exact JSON format:
{
  "tool_calls": [
    {
      "name": "tool_name",
      "arguments": {
        "arg1": "value1",
        "arg2": "value2"
      }
    }
  ]
}
Only use tool_calls when a query requires external data. Otherwise, respond normally.`;
  }

  async callModelAPI(prompt: string): Promise<OllamaResponse> {
    try {
      const messages = [
        { role: "system", content: this.buildSystemPrompt() },
        { role: "user", content: prompt }
      ];

      const response = await fetch(`${config.ollama.apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.ollama.model,
          messages,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      return await response.json() as OllamaResponse;
    } catch (error) {
      console.error("Error calling Ollama API:", error);
      throw error;
    }
  }
}
