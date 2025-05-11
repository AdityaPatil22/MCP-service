export class ToolSelectorService {
  private model: string;
  private endpoint: string;

  constructor(model = 'mistral:latest', endpoint = 'http://localhost:11434/api/generate') {
    this.model = model;
    this.endpoint = endpoint;
  }

  async selectTool(prompt: string, availableTools: string[]): Promise<string[] | null> {
  const formattedPrompt = `
    You are a tool selector. Given a user query and a list of available tools, return a JSON object with a "tool_calls" array. Each item should have a "name" and "arguments".
    Available tools: ${JSON.stringify(availableTools)}
    Query: "${prompt}"
    Respond in this format:
    {
      "tool_calls": [
        {
          "name": "tool_name",
          "arguments": {
            "arg1": "value1"
          }
        }
      ]
    }
  `.trim();

  const response = await fetch(this.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: this.model,
      prompt: formattedPrompt,
      stream: false,
    }),
  });

  const data = await response.json();
  const rawOutput = data.response;

  try {
    const parsed = JSON.parse(rawOutput.trim());
    const tools = parsed?.tool_calls?.map((tool: any) => tool.name);
    return Array.isArray(tools) && tools.length > 0 ? tools : null;
  } catch (err) {
    console.error("Failed to parse tool selection response:", rawOutput);
    return null;
  }
}

}
