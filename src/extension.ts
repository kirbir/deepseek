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
  const myCommandId = "deepseek.useSelectionContext";
  context.subscriptions.push(
    vscode.commands.registerCommand(myCommandId, () => {
      const n = getSelectedText(vscode.window.activeTextEditor);
      vscode.window.showInformationMessage(`Ask AI About: ${n}`);
    })
  );

  // create a new status bar item that we can now manage

  infoBar.command = myCommandId;
  infoBar.tooltip = "Use selected text as context";
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

      if (message.command === "selectImage") {
        const result = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: {
            'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp']
          }
        });

        if (result && result[0]) {
          const imageData = await vscode.workspace.fs.readFile(result[0]);
          const base64Image = Buffer.from(imageData).toString('base64');
          panel.webview.postMessage({
            command: 'imageSelected',
            imageData: base64Image
          });
        }
      }

      if (message.command === "chat") {
        const userPrompt = message.text + " " + currentSelectedText;
        console.log(`The prompt is now: ${userPrompt}`);
        console.log("User prompt:", userPrompt);
        let responseText = "";

        try {
          const messages = [
            {
              role: "system",
              content: "Format your responses using markdown. Use code blocks with appropriate language tags for any code examples.",
            },
            {
              role: "user",
              content: userPrompt,
              ...(message.image ? { images: [message.image] } : {})
            }
          ];

          const streamResponse = await ollama.chat({
            model: "deepseek-r1:8b",
            messages,
            stream: true,
          });

          for await (const part of streamResponse) {
            responseText += part.message.content;
            panel.webview.postMessage({
              command: "chatResponse",
              text: responseText,
              history: currentChatSession.messages,
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

        // Add response and user prompt history to storage in array
        currentChatSession.messages.push({
          role: "user",
          content: userPrompt,
          timestamp: Date.now(),
          ...(message.image ? { images: [message.image] } : {})
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
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "styles.css")
  );

  // Separate HTML sections for clarity
  const head = /*html*/`
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
      <link rel="stylesheet" href="${cssUri}">
      <title>Deep Seek Chat</title>
    </head>
  `;

  const headerStatus = /*html*/`
    <div id="header-status" style="display:flex; align-items:center;">
    <p class="menu-item" id="isOllamaInstalledText">Loading... </p>
    <p class="menu-item" id="isDeepseekInstalledText">Loading... </p>
    </div>

    <header>
      <div id="recent-history">
        <h3>Recent Conversations</h3>
        <div id="history-list"></div>
      </div>
    </header>
  `;

  const mainContent = /*html*/`
    <div id="deepseek-container">
      <h1 id="deepseek-title">What's on your mind?</h1>
      <div id="prompt-container">
      DeepSeek Model: ${ollamaStatus.model 
        ? `Ready (${ollamaStatus.modelName})` 
        : "Not Found - Please run: ollama pull deepseek-r1:8b"}
        <div id="text-wrapper">
          <button id="imageBtn" title="Upload Image">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <textarea id="prompt" placeholder="Ask china anything..." value=null></textarea>
          <button id="askBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="black">
              <path d="M17 13H8.414l4.293-4.293-1.414-1.414L4.586 14l6.707 6.707 1.414-1.414L8.414 15H19V4h-2v9z"/>
            </svg>
          </button>
        </div>
        <div id="imagePreview" style="display: none;">
          <img id="selectedImage" style="max-width: 200px; max-height: 200px; margin: 10px 0;"/>
          <button id="removeImage">❌</button>
        </div>
        
        <div id="response-container">
          <div id="loading" style="display: none;">
            <span style="margin-left: 10px">Thinking...</span>
          </div>
          <div id="response">
            <div class="loading-icon">
            <svg width="64px" height="64px" viewBox="-1.6 -1.6 19.20 19.20" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(6.24,6.24), scale(0.22)"><path transform="translate(-1.6, -1.6), scale(1.2)" fill="#7ed0ec" d="M9.166.33a2.25 2.25 0 00-2.332 0l-5.25 3.182A2.25 2.25 0 00.5 5.436v5.128a2.25 2.25 0 001.084 1.924l5.25 3.182a2.25 2.25 0 002.332 0l5.25-3.182a2.25 2.25 0 001.084-1.924V5.436a2.25 2.25 0 00-1.084-1.924L9.166.33z" strokewidth="0"></path></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M7.706 0.290 C 7.484 0.362,7.356 0.490,7.294 0.699 C 7.259 0.816,7.253 1.088,7.253 2.508 C 7.253 4.389,7.251 4.365,7.443 4.557 C 7.700 4.813,8.300 4.813,8.557 4.557 C 8.749 4.365,8.747 4.389,8.747 2.508 C 8.747 0.688,8.744 0.656,8.596 0.480 C 8.472 0.333,8.339 0.284,8.040 0.276 C 7.893 0.272,7.743 0.278,7.706 0.290 M2.753 2.266 C 2.595 2.338,2.362 2.566,2.281 2.728 C 2.197 2.897,2.193 3.085,2.269 3.253 C 2.343 3.418,4.667 5.750,4.850 5.843 C 5.109 5.976,5.375 5.911,5.643 5.649 C 5.907 5.391,5.977 5.111,5.843 4.850 C 5.750 4.667,3.418 2.343,3.253 2.269 C 3.101 2.200,2.901 2.199,2.753 2.266 M12.853 2.282 C 12.730 2.339,12.520 2.536,11.518 3.541 C 10.597 4.464,10.316 4.762,10.271 4.860 C 10.195 5.025,10.196 5.216,10.272 5.378 C 10.342 5.528,10.572 5.764,10.727 5.845 C 10.884 5.927,11.117 5.926,11.280 5.843 C 11.447 5.757,13.757 3.447,13.843 3.280 C 13.926 3.118,13.927 2.884,13.846 2.729 C 13.764 2.572,13.552 2.364,13.392 2.283 C 13.213 2.192,13.048 2.192,12.853 2.282 M0.699 7.292 C 0.404 7.385,0.258 7.620,0.258 7.999 C 0.259 8.386,0.403 8.618,0.698 8.706 C 0.816 8.741,1.079 8.747,2.508 8.747 C 3.997 8.747,4.196 8.742,4.318 8.702 C 4.498 8.644,4.644 8.498,4.702 8.318 C 4.788 8.053,4.745 7.677,4.608 7.491 C 4.578 7.451,4.492 7.384,4.417 7.343 L 4.280 7.267 2.547 7.261 C 1.152 7.257,0.791 7.263,0.699 7.292 M11.745 7.278 C 11.622 7.308,11.452 7.411,11.392 7.492 C 11.255 7.677,11.212 8.053,11.298 8.318 C 11.356 8.498,11.502 8.644,11.682 8.702 C 11.804 8.742,12.003 8.747,13.492 8.747 C 14.921 8.747,15.184 8.741,15.302 8.706 C 15.597 8.618,15.741 8.386,15.742 7.999 C 15.742 7.614,15.595 7.383,15.290 7.291 C 15.187 7.260,14.864 7.254,13.496 7.256 C 12.578 7.258,11.790 7.268,11.745 7.278 M4.853 10.282 C 4.730 10.339,4.520 10.536,3.518 11.541 C 2.597 12.464,2.316 12.762,2.271 12.860 C 2.195 13.025,2.196 13.216,2.272 13.378 C 2.342 13.528,2.572 13.764,2.727 13.845 C 2.884 13.927,3.117 13.926,3.280 13.843 C 3.447 13.757,5.757 11.447,5.843 11.280 C 5.926 11.118,5.927 10.884,5.846 10.729 C 5.764 10.572,5.552 10.364,5.392 10.283 C 5.213 10.192,5.048 10.192,4.853 10.282 M10.753 10.266 C 10.595 10.338,10.362 10.566,10.281 10.728 C 10.197 10.897,10.193 11.085,10.269 11.253 C 10.343 11.418,12.667 13.750,12.850 13.843 C 13.109 13.976,13.375 13.911,13.643 13.649 C 13.907 13.391,13.977 13.111,13.843 12.850 C 13.750 12.667,11.418 10.343,11.253 10.269 C 11.101 10.200,10.901 10.199,10.753 10.266 M7.745 11.277 C 7.620 11.309,7.451 11.412,7.392 11.492 C 7.254 11.678,7.253 11.691,7.253 13.489 C 7.253 14.921,7.259 15.184,7.294 15.302 C 7.382 15.597,7.615 15.741,8.000 15.741 C 8.385 15.741,8.618 15.597,8.706 15.302 C 8.768 15.090,8.767 11.875,8.704 11.690 C 8.644 11.514,8.575 11.430,8.420 11.346 C 8.310 11.286,8.246 11.271,8.057 11.264 C 7.930 11.259,7.790 11.265,7.745 11.277 " stroke="none" fill-rule="evenodd" fill="#000000"></path></g></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const scripts = /*html*/`
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"><\/script>
    <script>
      const vscode = acquireVsCodeApi();
      const prompt = document.getElementById('prompt');
      const loadingElement = document.getElementById('loading');
      const askButton = document.getElementById('askBtn');
      const imageBtn = document.getElementById('imageBtn');
      let selectedImageData = null;

      // Image button click handler
      imageBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'selectImage' });
      });

      // Remove image button
      document.getElementById('removeImage').addEventListener('click', () => {
        selectedImageData = null;
        document.getElementById('imagePreview').style.display = 'none';
      });

      // Auto-resize textarea
      const autoResize = () => {
        prompt.style.height = 'auto';
        prompt.style.height = Math.min(prompt.scrollHeight, 180) + 'px';
      };

      prompt.addEventListener('input', autoResize);
      autoResize();
      prompt.value = "".trim();

      // Configure marked
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

      // Status updates
      const isOllamaInstalledElement = document.getElementById('isOllamaInstalledText');
      isOllamaInstalledElement.innerHTML = ${ollamaStatus.installed} ? 'OLLAMA - Active' : 'not found';
      
      const isDeepseekInstalledElement = document.getElementById('isDeepseekInstalledText');
      isDeepseekInstalledElement.innerHTML = ${ollamaStatus.model} 
        ? 'DEEPSEEK - Active' 
        : 'not found -  Please run: ollama pull deepseek-r1:8b';

      // Event Listeners
      askButton.addEventListener('click', () => {
        const text = prompt.value.trim();
        loadingElement.style.display = 'flex';
        askButton.disabled = true;
        vscode.postMessage({ 
          command: 'chat', 
          text,
          image: selectedImageData 
        });
        prompt.value = "";
      });

      // Message Handler
      window.addEventListener('message', event => {
        const {command, text, history, imageData} = event.data;
        
        if (command === 'imageSelected') {
          selectedImageData = imageData;
          const imagePreview = document.getElementById('imagePreview');
          const selectedImage = document.getElementById('selectedImage');
          selectedImage.src = \`data:image/jpeg;base64,\${imageData}\`;
          imagePreview.style.display = 'block';
        }

        if (command === 'chatResponse') {
          // Update history list
          const recentHistory = document.getElementById('history-list');
          recentHistory.innerHTML = '';

          if (history && history.length > 0) {
            history.slice(-10).forEach(msg => {
              const historyEntry = document.createElement("p");
              historyEntry.style.borderBottom = '1px solid #333';
              historyEntry.style.padding = '4px';
              const icon = msg.role === 'user' ? '👤' : '🤖';
              const content = msg.content.substring(0, 50);
              historyEntry.appendChild(document.createTextNode(icon + ' ' + content));
              recentHistory.appendChild(historyEntry);
            });
          }

          // Update response
          const htmlContent = marked.parse(text);
          document.getElementById('response').innerHTML = htmlContent;
          
          // Reset UI state
          loadingElement.style.display = 'none';
          askButton.disabled = false;
          
          // Add copy buttons to code blocks
          document.querySelectorAll('pre code').forEach((block) => {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'code-block-header';
            
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '📋 Copy';
            copyButton.className = 'copy-button';
            
            copyButton.addEventListener('click', async () => {
              const code = block.textContent || '';
              await navigator.clipboard.writeText(code);
              copyButton.innerHTML = '✅ Copied!';
              setTimeout(() => {
                copyButton.innerHTML = '📋 Copy';
              }, 2000);
            });

            buttonContainer.appendChild(copyButton);
            block.parentElement?.insertBefore(buttonContainer, block);
            hljs.highlightBlock(block);
          });
        }
      });
    <\/script>
  `;

  // Combine all sections
  return /*html*/`
    <!DOCTYPE html>
    <html>
      ${head}
      <body>
        ${headerStatus}
        ${mainContent}
        ${scripts}
      </body>
    </html>
  `;
}
