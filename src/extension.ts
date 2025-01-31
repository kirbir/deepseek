// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ollama from "ollama";

export function activate(context: vscode.ExtensionContext) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.text = "$(comment-discussion) Deep Seek Chat";
  statusBarItem.command = "deepseek.start";
  statusBarItem.tooltip = "Open deep seek chat";
  statusBarItem.show();

  const disposable = vscode.commands.registerCommand("deepseek.start", () => {
    const panel = vscode.window.createWebviewPanel(
      "deepChat",
      "Deep Seek Chat",
      vscode.ViewColumn.Two,
      { enableScripts: true }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(async (message: any) => {
      console.log("Received message from webview:", message);

      if (message.command === "chat") {
        const userPrompt = message.text;
        console.log("User prompt:", userPrompt);
        let responseText = "";

        try {
          const streamResponse = await ollama.chat({
            model: 'deepseek-r1:8b',
            messages: [
              { 
                role: 'system', 
                content: 'Format your responses using markdown. Use code blocks with appropriate language tags for any code examples.'
              },
              { 
                role: 'user', 
                content: userPrompt 
              }
            ],
            stream: true,
          });

          for await (const part of streamResponse) {
            responseText += part.message.content;
            panel.webview.postMessage({
              command: "chatResponse",
              text: responseText,
            });
          }
        } catch (error) {
          console.error("Error:", error);
          panel.webview.postMessage({
            command: "chatResponse",
            text: `\`\`\`error\nAn error occurred: ${error}\n\`\`\``,
          });
        }

        panel.webview.postMessage({
          command: "chatResponse",
          text: responseText,
        });
      }
    });
  });

  context.subscriptions.push(statusBarItem, disposable);
}

export function deactivate() {}

function getWebviewContent(): string {
  return /*html*/ `
  <!DOCTYPE html>
  <html>
      <head>
          <meta charset="UTF-8">
          <!-- Add highlight.js CSS -->
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
          <!-- Add your existing styles -->
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  margin: 1rem;
                  padding: 1rem;
                  color: rgb(224, 241, 239);
                  background-color: rgb(38, 38, 38);
              }

              #deepseek-container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  max-width: 800px;
                  width: 100%;
                  padding: 1rem;
              }

              #deepseek-title {
                  color: rgb(224, 241, 239);
                  font-size: 1.5rem;
                  margin-bottom: 2rem;
                  text-align: center;
              }

              #prompt-container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 1rem;
                  width: 100%;
              }

              #prompt {
                  resize: none;
                  min-height: 150px;
                  border: 2px solid #ddd;
                  border-radius: 8px;
                  padding: 0.5rem;
                  font-size: 1rem;
                  line-height: 1.5;
                  color: #333;
                  transition: border-color 0.3s ease;
              }

              #prompt:focus {
                  outline: none;
                  border-color: #2196F3;
              }

              #askBtn {
                  display: inline-block;
                  padding: 0.5rem 1rem;
                  background-color: #2196F3;
                  color: white;
                  text-decoration: none;
                  border-radius: 4px;
                  font-size: 1rem;
                  cursor: pointer;
                  transition: background-color 0.3s ease;
              }

              #askBtn:hover {
                  background-color: #1976D2;
              }

              #response-container {
                  color: rgb(134, 134, 134);
                  border: 2px solid #ddd;
                  border-radius: 8px;
                  padding: 1rem;
                  margin-top: 1rem;
                  max-height: 70vh;
                  overflow-y: auto;
              }

              #response {
                  color: rgb(224, 241, 239);
                  line-height: 1.5;
                  font-size: 1rem;
              }

              .loading-icon {
                  display: inline-block;
                  width: 20px;
                  height: 20px;
                  border: 3px solid #2196F3;
                  border-top-color: #fff;
                  border-radius: 50%;
                  animation: spin 1s ease-in-out infinite;
              }

              @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
              }

              .code-block-header {
                  display: flex;
                  justify-content: flex-end;
                  padding: 4px;
                  background: #0d1117;  /* GitHub dark background */
                  border-bottom: 1px solid #30363d;  /* GitHub dark border */
                  border-top-left-radius: 6px;
                  border-top-right-radius: 6px;
              }

              .copy-button {
                  background: #21262d;  /* GitHub dark button background */
                  border: 1px solid #30363d;
                  border-radius: 4px;
                  padding: 4px 8px;
                  cursor: pointer;
                  font-size: 12px;
                  color: #c9d1d9;  /* GitHub dark text */
              }

              .copy-button:hover {
                  background: #30363d;
                  border-color: #8b949e;
              }

              /* Adjust pre styling to connect with header */
              pre {
                  margin-top: 0 !important;
                  border-top-left-radius: 0 !important;
                  border-top-right-radius: 0 !important;
                  border: 1px solid #30363d !important;  /* GitHub dark border */
              }
          </style>
          <title>Deep Seek Chat</title>
      </head>
      <body>
          <div id="deepseek-container">
              <h1 id="deepseek-title">Deep Seek Chat</h1>
              <div id="prompt-container">
                  <textarea id="prompt" placeholder="Ask china anything..."></textarea>
                  <button id="askBtn">Ask</button>
                  <div id="response-container">
                      <div id="response"></div>
                  </div>
              </div>
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
          <script>
              const vscode = acquireVsCodeApi();

              // Configure marked with syntax highlighting
              marked.setOptions({
                  highlight: function(code, lang) {
                      if (lang && hljs.getLanguage(lang)) {
                          return hljs.highlight(code, { language: lang }).value;
                      }
                      return hljs.highlightAuto(code).value;
                  },
                  breaks: true,
                  gfm: true
              });

              document.getElementById('askBtn').addEventListener('click', () => {
                  const text = document.getElementById('prompt').value.trim();
                  vscode.postMessage({ command: 'chat', text });
              });

              window.addEventListener('message', event => {
                  const {command, text} = event.data;
                  if (command === 'chatResponse') {
                      // Convert markdown to HTML with syntax highlighting
                      const htmlContent = marked.parse(text);
                      document.getElementById('response').innerHTML = htmlContent;

                      // Add copy button to each code block
                      document.querySelectorAll('pre code').forEach((block) => {
                          // Create copy button container
                          const buttonContainer = document.createElement('div');
                          buttonContainer.className = 'code-block-header';
                          
                          // Create copy button
                          const copyButton = document.createElement('button');
                          copyButton.innerHTML = '📋 Copy';
                          copyButton.className = 'copy-button';
                          
                          // Add click handler
                          copyButton.addEventListener('click', async () => {
                              const code = block.textContent || '';
                              await navigator.clipboard.writeText(code);
                              copyButton.innerHTML = '✅ Copied!';
                              setTimeout(() => {
                                  copyButton.innerHTML = '📋 Copy';
                              }, 2000);
                          });

                          // Add button to container
                          buttonContainer.appendChild(copyButton);

                          // Add container before the code block
                          block.parentElement?.insertBefore(buttonContainer, block);

                          // Apply syntax highlighting
                          hljs.highlightBlock(block);
                      });
                  }
              });
          </script>
      </body>
  </html>
  `;
}
