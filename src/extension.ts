// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

let infoBar: vscode.StatusBarItem;
let currentSelectedText: string = "";

import ollama from "ollama";

export function activate(context: vscode.ExtensionContext) {


  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  infoBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1000
  );
  // register a command that is invoked when the infoBar
  // item is selected
  const myCommandId = "sample.showSelectionCount";
  context.subscriptions.push(
    vscode.commands.registerCommand(myCommandId, () => {
      const n = getSelectedText(vscode.window.activeTextEditor);
      vscode.window.showInformationMessage(
        `Ask AI About: ${n}`
      );
    })
  );

  // create a new status bar item that we can now manage

  infoBar.command = myCommandId;
  infoBar.tooltip = "Show selected text";
  context.subscriptions.push(infoBar);
  infoBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  infoBar.text = `$(megaphone) Ready`;
  infoBar.show();

  // context.subscriptions.push(
  //   vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem)
  // );
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem)
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

    panel.webview.html = getWebviewContent(panel.webview,context.extensionUri);

    panel.webview.onDidReceiveMessage(async (message: any) => {
      console.log("Received message from webview:", message);

      if (message.command === "chat") {
        const userPrompt = message.text + " " + (currentSelectedText );
        console.log(`The prompt is now: ${userPrompt}`);
        console.log("User prompt:", userPrompt);
        let responseText = "";

        try {
          const streamResponse = await ollama.chat({
            model: "deepseek-r1:8b",
            messages: [
              {
                role: "system",
                content:
                  "Format your responses using markdown. Use code blocks with appropriate language tags for any code examples.",
              },
              {
                role: "user",
                content: userPrompt,
              },
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
  updateStatusBarItem();
}

function updateStatusBarItem(): void {
	const selectedText = getSelectedText(vscode.window.activeTextEditor);
	if (selectedText) {
		infoBar.text = `$(megaphone) ${selectedText.substring(0,30)}...`;
		infoBar.show();
    currentSelectedText = selectedText;
	} else {
    infoBar.text = "ready";
		infoBar.show();
    currentSelectedText = "";
	}
}

function getSelectedText(editor: vscode.TextEditor | undefined): string {
	if (!editor) return "";
	
	return editor.selections.map(selection => editor.document.getText(selection)).join('\n');

}

export function deactivate() {}

function getWebviewContent(webview:vscode.Webview, extensionUri:vscode.Uri): string {
  //get path to css styles
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri,'media','styles.css'));

  return /*html*/ `
  <!DOCTYPE html>
  <html>
      <head>
          <meta charset="UTF-8">
          <!-- Add highlight.js CSS -->
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
          <link rel="stylesheet" href="${cssUri}">
          <!-- Add your existing styles -->
          <style>

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
