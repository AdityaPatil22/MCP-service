import readline from "readline/promises";
import { MCPService } from "./services/MCPService.js";
import { LLMService } from "./services/LLMService.js";
import { ToolService } from "./services/ToolService.js";
import { formatToolResult } from "./utils/formatters.js";
import { config } from "./config/config.js";

class MCPClient {
  private mcpService: MCPService;
  private llmService: LLMService;
  private toolService: ToolService;

  constructor() {
    this.mcpService = new MCPService();
    this.llmService = new LLMService(() => this.mcpService.tools);
    this.toolService = new ToolService();
  }

  async initialize(serverScriptPath: string): Promise<void> {
    await this.mcpService.connectToServer(serverScriptPath);

    console.log(
      "Connected to server with tools:",
      this.mcpService.tools.map(({ name }) => name)
    );
  }

  async processQuery(query: string): Promise<string> {
    try {
      const ollamaResponse = await this.llmService.callModelAPI(query);
      const responseContent = ollamaResponse.message?.content || "No response";

      const toolCalls = this.toolService.parseToolCalls(ollamaResponse);

      if (!toolCalls) {
        return responseContent;
      }

      let finalResponse = `${responseContent}\n\n`;

      for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        const toolArgs = this.toolService.normalizeToolArguments(toolCall.arguments);

        finalResponse += `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]\n`;

        const result = await this.mcpService.callTool(toolName, toolArgs);
        const formattedResult = formatToolResult(result);

        finalResponse += `\nTool result:\n${formattedResult}\n`;

        const analysisPrompt = `Analyze the following data and provide insights:\n${formattedResult}`;
        const analysisResponse = await this.llmService.callModelAPI(analysisPrompt);
        const analysisContent = analysisResponse.message?.content || "No analysis provided.";

        finalResponse += `\nAnalysis:\n${analysisContent}`;
      }

      return finalResponse;
    } catch (error) {
      return `An error occurred while processing your query: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async chatLoop(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client with Ollama Started!");
      console.log(`Using Ollama model: ${config.ollama.model}`);
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") break;

        const response = await this.processQuery(message);
        console.log("\n" + response);
      }

      console.log("\nAvailable tools:");
      this.mcpService.tools.forEach(tool => {
        console.log(`- ${tool.name}`);
      });

    } finally {
      rl.close();
    }
  }
}

async function main(): Promise<void> {
  const buildPaths = process.argv.slice(2);
  if (buildPaths.length === 0) {
    console.log("Usage: node index.js <path1> <path2> ...");
    return;
  }

  const mcpClient = new MCPClient();

  try {
    for (const path of buildPaths) {
      await mcpClient.initialize(path);
    }

    await mcpClient.chatLoop();
  } finally {
    process.exit(0);
  }
}

main();
