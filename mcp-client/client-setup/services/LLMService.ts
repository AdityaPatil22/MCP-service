import fetch from "node-fetch";
import { OllamaResponse } from "../types/interfaces.js";
import { config } from "../config/config.js";

export class LLMService {
  private selectedTools: any[] = [];

  constructor(private tools: () => any[]) {}
  
  // Call this before using callModelAPI()
  setSelectedTools(toolNames: string[]) {
    const allTools = this.tools();
    this.selectedTools = allTools.filter(tool => toolNames.includes(tool.name));
  }

  private buildSystemPrompt(): string {
    if (this.selectedTools.length === 0) {
      return `You are an assistant with no tools available for this query. Respond based on your internal knowledge.`;
    }

    const toolsDescription = this.selectedTools.map(tool =>
      `Tool: ${tool.name}\nDescription: ${tool.description}\nInput Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`
    ).join("\n\n");

    return `You are an assistant with access to the following tools:\n\n${toolsDescription}
    
      Only respond with a tool_call when a query needs external data. Otherwise, just respond normally. Format tool calls like this:

      {
        "tool_calls": [
          {
            "name": "tool_name",
            "arguments": {
              "arg1": "value1"
            }
          }
        ]
      }`;
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
