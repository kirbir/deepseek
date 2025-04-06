// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ChatSession, ChatMessage } from "./types/types";

let infoBar: vscode.StatusBarItem;
let currentSelectedText: string = "";

let currentChatSession: ChatSession = {
  messages: [],
  created: Date.now(),
};

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
      vscode.window.showInformationMessage(`Ask AI About: ${n}`);
    })
  );

  // create a new status bar item that we can now manage

  infoBar.command = myCommandId;
  infoBar.tooltip = "Show selected text";
  context.subscriptions.push(infoBar);
  infoBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
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
    // Check Ollama status and update the webview
    checkOllamaSetup().then((ollamaStatus) => {
      panel.webview.html = getWebviewContent(
        panel.webview,
        context.extensionUri,
        {
          ...ollamaStatus,
          modelName: "deepseek-r1:8b", // Adding required modelName property
        }
      );
    });

    panel.webview.onDidReceiveMessage(async (message: any) => {
      console.log("Received message from webview:", message);

      if (message.command === "chat") {
        const userPrompt = message.text + " " + currentSelectedText;
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
              history: currentChatSession.messages
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
          history: currentChatSession.messages.slice(-10),
        });

        // Add respone and user prompt history to storage in array
        currentChatSession.messages.push({
          role: "user",
          content: userPrompt,
          timestamp: Date.now(),
        });

        currentChatSession.messages.push({
          role: "assistant",
          content: responseText,
          timestamp: Date.now(),
        });
      }
    });
  });

  context.subscriptions.push(statusBarItem, disposable);
  updateStatusBarItem();
}

async function checkOllamaSetup(): Promise<{
  installed: boolean;
  model: boolean;
}> {
  try {
    const response = await ollama.list();
    const deepSeekModel = response.models.find((model) =>
      model.name.startsWith("deepseek-r1")
    );

    const hasDeepSeek = !!deepSeekModel;
    const modelName = deepSeekModel?.name || "";
    return {
      installed: true,
      model: hasDeepSeek,
    };
  } catch (error) {
    return { installed: false, model: false };
  }
}

function updateStatusBarItem(): void {
  const selectedText = getSelectedText(vscode.window.activeTextEditor);
  if (selectedText) {
    infoBar.text = `$(megaphone) ${selectedText.substring(0, 30)}...`;
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

  return editor.selections
    .map((selection) => editor.document.getText(selection))
    .join("\n");
}

export function deactivate() {}

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  ollamaStatus: { installed: boolean; model: boolean; modelName: string }
): string {
  //get path to css styles
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "styles.css")
  );

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
      <header>
      <div id="header-status">
      <div><p class="menu-title" style="font-weight:600">Ollama installed: </p><p class="menu-item" id="isOllamaInstalledText">Loading... </p></div>
      <div><p class="menu-title" style="font-weight:600">Deepseek installed: </p><p class="menu-item" id="isDeepseekInstalledText">Loading... </p></div>
      <span>
      DeepSeek Model: ${
        ollamaStatus.model
          ? `Ready (${ollamaStatus.modelName})`
          : "Not Found - Please run: ollama pull deepseek-r1:8b"
      }
    </span>
      </div>
      <div id="recent-history">
      <h3>Recent Conversations</h3>
      <div id="history-list"></div>
  </div>
      </header>
          <div id="deepseek-container">
              <h1 id="deepseek-title">Deep Seek Chat</h1>
              <div id="prompt-container">
                  <div id="text-wrapper">
                  <textarea id="prompt" placeholder="Ask china anything..." value=null>
                  </textarea>
                  <button id="askBtn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M17 13H8.414l4.293-4.293-1.414-1.414L4.586 14l6.707 6.707 1.414-1.414L8.414 15H19V4h-2v9z"/></svg>
                  </button>
                  </div>
                  
                  <div id="response-container">
                  <div id="loading" style="display: none;">

                  <span style="margin-left: 10px">AI is thinking...</span>
              </div>
                      <div id="response">
                      <div class="loading-icon">
                      <svg height="64px" width="64px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#000000" transform="rotate(0)"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#fec3c3" stroke-width="49.152"> <style type="text/css"> .st0{fill:#000000;} </style> <g> <path class="st0" d="M315.883,231.15l82.752-115.13c7.152-9.942,11.039-21.784,11.039-33.93V46.13h23.911V0H78.415v46.13h23.912 v35.96c0,12.145,3.886,23.988,11.039,33.93l82.752,115.13c2.963,4.136,4.472,8.857,4.483,13.665v22.36 c-0.011,4.808-1.52,9.53-4.483,13.665l-82.752,115.141c-7.154,9.942-11.039,21.783-11.039,33.918v35.971H78.415V512h355.169 v-46.129h-23.911V429.9c0-12.135-3.887-23.976-11.039-33.918L315.883,280.84c-2.963-4.136-4.482-8.857-4.482-13.665v-22.36 C311.401,240.007,312.92,235.286,315.883,231.15z M386.609,461.257H125.393V429.9c0-7.229,2.291-14.317,6.696-20.46l82.753-115.141 c5.708-7.934,8.824-17.41,8.824-27.124v-22.36c0-9.714-3.115-19.202-8.824-27.124L132.1,102.561 c-4.417-6.155-6.708-13.232-6.708-20.471V50.743h261.216V82.09c-0.011,7.239-2.291,14.316-6.709,20.471l-82.752,115.13 c-5.698,7.922-8.813,17.41-8.813,27.124v22.36c0,9.714,3.114,19.19,8.813,27.124l82.763,115.141 c4.407,6.143,6.686,13.231,6.698,20.46V461.257z"></path> <path class="st0" d="M236.268,232.929h39.466c1.672-8.314,5.091-16.237,10.181-23.314l59.491-82.774H166.595l59.492,82.774 C231.177,216.692,234.585,224.616,236.268,232.929z"></path> <path class="st0" d="M246.753,381.588l-65.82,65.831h150.134l-65.82-65.831C260.137,376.487,251.865,376.487,246.753,381.588z"></path> <path class="st0" d="M255.632,247.995c-5.688,0-10.301,4.614-10.301,10.312c0,5.688,4.614,10.3,10.301,10.3 c5.687,0,10.311-4.612,10.311-10.3C265.943,252.609,261.319,247.995,255.632,247.995z"></path> <path class="st0" d="M255.632,289.513c-5.688,0-10.301,4.613-10.301,10.3c0,5.698,4.614,10.312,10.301,10.312 c5.687,0,10.311-4.614,10.311-10.312C265.943,294.126,261.319,289.513,255.632,289.513z"></path> <path class="st0" d="M255.632,332.245c-5.688,0-10.301,4.613-10.301,10.311c0,5.687,4.614,10.312,10.301,10.312 c5.687,0,10.311-4.625,10.311-10.312C265.943,336.858,261.319,332.245,255.632,332.245z"></path> </g> </g><g id="SVGRepo_iconCarrier"> <style type="text/css"> .st0{fill:#000000;} </style> <g> <path class="st0" d="M315.883,231.15l82.752-115.13c7.152-9.942,11.039-21.784,11.039-33.93V46.13h23.911V0H78.415v46.13h23.912 v35.96c0,12.145,3.886,23.988,11.039,33.93l82.752,115.13c2.963,4.136,4.472,8.857,4.483,13.665v22.36 c-0.011,4.808-1.52,9.53-4.483,13.665l-82.752,115.141c-7.154,9.942-11.039,21.783-11.039,33.918v35.971H78.415V512h355.169 v-46.129h-23.911V429.9c0-12.135-3.887-23.976-11.039-33.918L315.883,280.84c-2.963-4.136-4.482-8.857-4.482-13.665v-22.36 C311.401,240.007,312.92,235.286,315.883,231.15z M386.609,461.257H125.393V429.9c0-7.229,2.291-14.317,6.696-20.46l82.753-115.141 c5.708-7.934,8.824-17.41,8.824-27.124v-22.36c0-9.714-3.115-19.202-8.824-27.124L132.1,102.561 c-4.417-6.155-6.708-13.232-6.708-20.471V50.743h261.216V82.09c-0.011,7.239-2.291,14.316-6.709,20.471l-82.752,115.13 c-5.698,7.922-8.813,17.41-8.813,27.124v22.36c0,9.714,3.114,19.19,8.813,27.124l82.763,115.141 c4.407,6.143,6.686,13.231,6.698,20.46V461.257z"></path> <path class="st0" d="M236.268,232.929h39.466c1.672-8.314,5.091-16.237,10.181-23.314l59.491-82.774H166.595l59.492,82.774 C231.177,216.692,234.585,224.616,236.268,232.929z"></path> <path class="st0" d="M246.753,381.588l-65.82,65.831h150.134l-65.82-65.831C260.137,376.487,251.865,376.487,246.753,381.588z"></path> <path class="st0" d="M255.632,247.995c-5.688,0-10.301,4.614-10.301,10.312c0,5.688,4.614,10.3,10.301,10.3 c5.687,0,10.311-4.612,10.311-10.3C265.943,252.609,261.319,247.995,255.632,247.995z"></path> <path class="st0" d="M255.632,289.513c-5.688,0-10.301,4.613-10.301,10.3c0,5.698,4.614,10.312,10.301,10.312 c5.687,0,10.311-4.614,10.311-10.312C265.943,294.126,261.319,289.513,255.632,289.513z"></path> <path class="st0" d="M255.632,332.245c-5.688,0-10.301,4.613-10.301,10.311c0,5.687,4.614,10.312,10.301,10.312 c5.687,0,10.311-4.625,10.311-10.312C265.943,336.858,261.319,332.245,255.632,332.245z"></path> </g> </g></svg>
                      </div>
                      </div>
                  </div>
              </div>
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
          <script>
              const vscode = acquireVsCodeApi();

              const prompt = document.getElementById('prompt');
              const loadingElement = document.getElementById('loading');
              const askButton = document.getElementById('askBtn');

const autoResize = () => {
  prompt.style.height = 'auto';
  prompt.style.height = Math.min(prompt.scrollHeight, 180) + 'px';
};

prompt.addEventListener('input', autoResize);

// Initial sizing
autoResize();
prompt.value ="".trim();

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

              // check and see if Ollama is installed
              const isOllamaInstalledElement = document.getElementById('isOllamaInstalledText');
              isOllamaInstalledElement.innerHTML =  ${
                ollamaStatus.installed
              } ? 'Yes' : 'not found';
              // check and see if Deepseek is installed
              const isDeepseekInstalledElement = document.getElementById('isDeepseekInstalledText');
              isDeepseekInstalledElement.innerHTML =  ${
                ollamaStatus.model
              } ? 'Yes' : 'not found -  Please run: ollama pull deepseek-r1:8b';

              askButton.addEventListener('click', () => {
                  const text = prompt.value.trim();
                  
                  // Show loading state
                  loadingElement.style.display = 'flex';
                  askButton.disabled = true;  // Optional: disable button while processing
                  
                  vscode.postMessage({ command: 'chat', text });
                  prompt.value = "";
              });

              // Handle response
              window.addEventListener('message', event => {
                  const {command, text,history} = event.data;
                  if (command === 'chatResponse') {
                    
         // List the chat history
         let recentHistory = document.getElementById('history-list');
        recentHistory.innerHTML = ''; // Clear existing history

        if (history && history.length > 0) {
            history.slice(-10).forEach(msg => {
                const historyEntry = document.createElement("p");
                historyEntry.style.borderBottom = '1px solid #333';
                historyEntry.style.padding = '4px';
                
                // Simple text node with role emoji and content
                const icon = msg.role === 'user' ? '👤' : '🤖';
                const content = msg.content.substring(0, 50);
                const textnode = document.createTextNode(icon + ' ' + content);
                
                historyEntry.appendChild(textnode);
                recentHistory.appendChild(historyEntry);
            });
        }



                      // Convert markdown to HTML with syntax highlighting
                      const htmlContent = marked.parse(text);
                      document.getElementById('response').innerHTML = htmlContent;
                      
                      // Hide loading state
                      loadingElement.style.display = 'none';
                      askButton.disabled = false;  // Re-enable button
                      
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
