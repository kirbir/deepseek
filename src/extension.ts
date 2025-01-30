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
          console.log("About to call Ollama...");
          const streamResponse = await ollama.chat({
            model: "deepseek-r1:8b",
            messages: [{ role: "user", content: userPrompt }],
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
            text: `An error occurred: ${error}`,
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
			<style>
	body {
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
margin: 1rem;
padding: 1rem;
background-color: #f5f5f5;
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
color: #333;
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
border: 2px solid #ddd;
border-radius: 8px;
padding: 1rem;
margin-top: 1rem;
max-height: 300px;
overflow-y: auto;
}
#response {
color: #333;
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
			<script>
				const vscode = acquireVsCodeApi();

				document.getElementById('askBtn').addEventListener('click', () => {
					const text = document.getElementById('prompt').value.trim();
					vscode.postMessage({ command: 'chat', text });
				});

				window.addEventListener('message',event => {
					const {command,text} = event.data;
					if (command === 'chatResponse'){
					document.getElementById('response').innerText = text;
				}
			})
					
			</script>
		</body>
	</html>
	`;
}
