/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(__webpack_require__(1));
let infoBar;
let currentSelectedText = "";
let availableModels = [];
let selectedModel = "";
const preferredModel = "gemma4";
let currentChatSession = {
    messages: [],
    created: Date.now(),
};
const ollama_1 = __importDefault(__webpack_require__(2));
function getInitialSelectedModel(modelNames) {
    const gemmaModel = modelNames.find((model) => model.startsWith(preferredModel));
    return gemmaModel || modelNames[0] || "";
}
function activate(context) {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    infoBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    // register a command that is invoked when the infoBar
    // item is selected
    const myCommandId = "deepseek.useSelectionContext";
    context.subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
        const n = getSelectedText(vscode.window.activeTextEditor);
        vscode.window.showInformationMessage(`Ask AI About: ${n}`);
    }));
    // create a new status bar item that we can now manage
    infoBar.command = myCommandId;
    infoBar.tooltip = "Use selected text as context";
    context.subscriptions.push(infoBar);
    infoBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    infoBar.text = `$(megaphone) Ready`;
    infoBar.show();
    // context.subscriptions.push(
    //   vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem)
    // );
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));
    statusBarItem.text = "$(comment-discussion) Deep Seek Chat";
    statusBarItem.command = "deepseek.start";
    statusBarItem.tooltip = "Open deep seek chat";
    statusBarItem.show();
    const disposable = vscode.commands.registerCommand("deepseek.start", () => {
        const panel = vscode.window.createWebviewPanel("deepChat", "Deep Seek Chat", vscode.ViewColumn.Two, { enableScripts: true });
        // Check Ollama status and update the webview
        checkOllamaSetup().then((ollamaStatus) => {
            panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, ollamaStatus);
        });
        panel.webview.onDidReceiveMessage(async (message) => {
            console.log("Received message from webview:", message);
            if (message.command === "selectImage") {
                const result = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        Images: ["png", "jpg", "jpeg", "gif", "webp"],
                    },
                });
                if (result && result[0]) {
                    const imageData = await vscode.workspace.fs.readFile(result[0]);
                    const base64Image = Buffer.from(imageData).toString("base64");
                    panel.webview.postMessage({
                        command: "imageSelected",
                        imageData: base64Image,
                    });
                }
            }
            if (message.command === "chat") {
                if (!availableModels.includes(selectedModel)) {
                    selectedModel = getInitialSelectedModel(availableModels);
                    panel.webview.postMessage({
                        command: "modelChanged",
                        model: selectedModel,
                    });
                }
                if (!selectedModel) {
                    panel.webview.postMessage({
                        command: "chatResponse",
                        text: "```error\nNo Ollama model selected. Please pull a model (for example: ollama pull gemma4) and choose it from the model picker.\n```",
                        history: currentChatSession.messages.slice(-10),
                    });
                    return;
                }
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
                            ...(message.image ? { images: [message.image] } : {}),
                        },
                    ];
                    const streamResponse = await ollama_1.default.chat({
                        model: selectedModel,
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
                        currentSelectedText = "";
                    }
                }
                catch (error) {
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
                    ...(message.image ? { images: [message.image] } : {}),
                });
                currentChatSession.messages.push({
                    role: "assistant",
                    content: responseText,
                    timestamp: Date.now(),
                });
            }
            if (message.command === "setModel") {
                const requestedModel = String(message.model || "");
                if (availableModels.includes(requestedModel)) {
                    selectedModel = requestedModel;
                    panel.webview.postMessage({
                        command: "modelChanged",
                        model: selectedModel,
                    });
                }
            }
        });
    });
    context.subscriptions.push(statusBarItem, disposable);
    updateStatusBarItem();
}
async function checkOllamaSetup() {
    try {
        const response = await ollama_1.default.list();
        availableModels = response.models.map((model) => model.name);
        selectedModel = getInitialSelectedModel(availableModels);
        return {
            installed: true,
            hasModels: availableModels.length > 0,
            modelNames: availableModels,
            selectedModel,
        };
    }
    catch (error) {
        availableModels = [];
        selectedModel = "";
        return {
            installed: false,
            hasModels: false,
            modelNames: [],
            selectedModel: "",
        };
    }
}
function updateStatusBarItem() {
    const selectedText = getSelectedText(vscode.window.activeTextEditor);
    if (selectedText) {
        infoBar.text = `$(megaphone) ${selectedText.substring(0, 8)}...`;
        infoBar.show();
        currentSelectedText = selectedText;
    }
    else {
        infoBar.text = "ready";
        infoBar.show();
        currentSelectedText = "";
    }
}
function getSelectedText(editor) {
    if (!editor)
        return "";
    return editor.selections
        .map((selection) => editor.document.getText(selection))
        .join("\n");
}
function deactivate() { }
function getWebviewContent(webview, extensionUri, ollamaStatus) {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "styles.css"));
    // Separate HTML sections for clarity
    const head = /*html*/ `
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
      <link rel="stylesheet" href="${cssUri}">
      <title>Deep Seek Chat</title>
    </head>
  `;
    const headerStatus = /*html*/ `
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
    const mainContent = /*html*/ `
    <div id="deepseek-container">
      <h1 id="deepseek-title">What's on your mind?</h1>
      <!-- Display selected text/code used for Ai prompt context -->
      <div id="context-display">
      <p>
      ${currentSelectedText
        ? `Current context: ${currentSelectedText.slice(0, 100)}`
        : "No text selection detected, you can select text/code press CTRL+SHIFT+D to use it as context for your prompt"}
      </p>
      </div>
      <div id="prompt-container">
      <div id="model-picker-container">
        <label for="modelSelect">Ollama Model</label>
        <select id="modelSelect" ${!ollamaStatus.hasModels ? "disabled" : ""}>
          ${ollamaStatus.modelNames.length > 0
        ? ollamaStatus.modelNames
            .map((modelName) => `<option value="${modelName}" ${modelName === ollamaStatus.selectedModel
            ? "selected"
            : ""}>${modelName}</option>`)
            .join("")
        : '<option value="">No models installed</option>'}
        </select>
      </div>
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
    const scripts = /*html*/ `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"><\/script>
    <script>
      const vscode = acquireVsCodeApi();
      const prompt = document.getElementById('prompt');
      const loadingElement = document.getElementById('loading');
      const askButton = document.getElementById('askBtn');
      const imageBtn = document.getElementById('imageBtn');
      const modelSelect = document.getElementById('modelSelect');
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
      isDeepseekInstalledElement.innerHTML = ${ollamaStatus.hasModels} ? 'Selected: ${ollamaStatus.selectedModel}' : 'No models found - Please run: ollama pull gemma4';
      askButton.disabled = ${!ollamaStatus.installed || !ollamaStatus.hasModels};

      modelSelect?.addEventListener('change', () => {
        const nextModel = modelSelect.value;
        vscode.postMessage({
          command: 'setModel',
          model: nextModel
        });
      });

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
          askButton.disabled = modelSelect ? modelSelect.disabled : false;
          
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

        if (command === 'modelChanged') {
          isDeepseekInstalledElement.innerHTML = 'Selected: ' + (event.data.model || '');
        }
      });
    <\/script>
  `;
    // Combine all sections
    return /*html*/ `
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


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



Object.defineProperty(exports, "__esModule", ({ value: true }));

const fs = __webpack_require__(3);
const path = __webpack_require__(4);
const browser = __webpack_require__(5);
__webpack_require__(6);

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e.default : e; }

const fs__default = /*#__PURE__*/_interopDefaultCompat(fs);

class Ollama extends browser.Ollama {
  async encodeImage(image) {
    if (typeof image !== "string") {
      return Buffer.from(image).toString("base64");
    }
    try {
      if (fs__default.existsSync(image)) {
        const fileBuffer = await fs.promises.readFile(path.resolve(image));
        return Buffer.from(fileBuffer).toString("base64");
      }
    } catch {
    }
    return image;
  }
  /**
   * checks if a file exists
   * @param path {string} - The path to the file
   * @private @internal
   * @returns {Promise<boolean>} - Whether the file exists or not
   */
  async fileExists(path) {
    try {
      await fs.promises.access(path);
      return true;
    } catch {
      return false;
    }
  }
  async create(request) {
    if (request.from && await this.fileExists(path.resolve(request.from))) {
      throw Error("Creating with a local path is not currently supported from ollama-js");
    }
    if (request.stream) {
      return super.create(request);
    } else {
      return super.create(request);
    }
  }
}
const index = new Ollama();

exports.Ollama = Ollama;
exports["default"] = index;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {



Object.defineProperty(exports, "__esModule", ({ value: true }));

__webpack_require__(6);

const version = "0.5.12";

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class ResponseError extends Error {
  constructor(error, status_code) {
    super(error);
    this.error = error;
    this.status_code = status_code;
    this.name = "ResponseError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResponseError);
    }
  }
}
class AbortableAsyncIterator {
  constructor(abortController, itr, doneCallback) {
    __publicField$1(this, "abortController");
    __publicField$1(this, "itr");
    __publicField$1(this, "doneCallback");
    this.abortController = abortController;
    this.itr = itr;
    this.doneCallback = doneCallback;
  }
  abort() {
    this.abortController.abort();
  }
  async *[Symbol.asyncIterator]() {
    for await (const message of this.itr) {
      if ("error" in message) {
        throw new Error(message.error);
      }
      yield message;
      if (message.done || message.status === "success") {
        this.doneCallback();
        return;
      }
    }
    throw new Error("Did not receive done or success response in stream.");
  }
}
const checkOk = async (response) => {
  if (response.ok) {
    return;
  }
  let message = `Error ${response.status}: ${response.statusText}`;
  let errorData = null;
  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      errorData = await response.json();
      message = errorData.error || message;
    } catch (error) {
      console.log("Failed to parse error response as JSON");
    }
  } else {
    try {
      console.log("Getting text from response");
      const textResponse = await response.text();
      message = textResponse || message;
    } catch (error) {
      console.log("Failed to get text from error response");
    }
  }
  throw new ResponseError(message, response.status);
};
function getPlatform() {
  if (typeof window !== "undefined" && window.navigator) {
    return `${window.navigator.platform.toLowerCase()} Browser/${navigator.userAgent};`;
  } else if (typeof process !== "undefined") {
    return `${process.arch} ${process.platform} Node.js/${process.version}`;
  }
  return "";
}
const fetchWithHeaders = async (fetch, url, options = {}) => {
  const defaultHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": `ollama-js/${version} (${getPlatform()})`
  };
  if (!options.headers) {
    options.headers = {};
  }
  const customHeaders = Object.fromEntries(
    Object.entries(options.headers).filter(([key]) => !Object.keys(defaultHeaders).some((defaultKey) => defaultKey.toLowerCase() === key.toLowerCase()))
  );
  options.headers = {
    ...defaultHeaders,
    ...customHeaders
  };
  return fetch(url, options);
};
const get = async (fetch, host, options) => {
  const response = await fetchWithHeaders(fetch, host, {
    headers: options?.headers
  });
  await checkOk(response);
  return response;
};
const post = async (fetch, host, data, options) => {
  const isRecord = (input) => {
    return input !== null && typeof input === "object" && !Array.isArray(input);
  };
  const formattedData = isRecord(data) ? JSON.stringify(data) : data;
  const response = await fetchWithHeaders(fetch, host, {
    method: "POST",
    body: formattedData,
    signal: options?.signal,
    headers: options?.headers
  });
  await checkOk(response);
  return response;
};
const del = async (fetch, host, data, options) => {
  const response = await fetchWithHeaders(fetch, host, {
    method: "DELETE",
    body: JSON.stringify(data),
    headers: options?.headers
  });
  await checkOk(response);
  return response;
};
const parseJSON = async function* (itr) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const reader = itr.getReader();
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(chunk);
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      try {
        yield JSON.parse(part);
      } catch (error) {
        console.warn("invalid json: ", part);
      }
    }
  }
  for (const part of buffer.split("\n").filter((p) => p !== "")) {
    try {
      yield JSON.parse(part);
    } catch (error) {
      console.warn("invalid json: ", part);
    }
  }
};
const formatHost = (host) => {
  if (!host) {
    return "http://127.0.0.1:11434";
  }
  let isExplicitProtocol = host.includes("://");
  if (host.startsWith(":")) {
    host = `http://127.0.0.1${host}`;
    isExplicitProtocol = true;
  }
  if (!isExplicitProtocol) {
    host = `http://${host}`;
  }
  const url = new URL(host);
  let port = url.port;
  if (!port) {
    if (!isExplicitProtocol) {
      port = "11434";
    } else {
      port = url.protocol === "https:" ? "443" : "80";
    }
  }
  let formattedHost = `${url.protocol}//${url.hostname}:${port}${url.pathname}`;
  if (formattedHost.endsWith("/")) {
    formattedHost = formattedHost.slice(0, -1);
  }
  return formattedHost;
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
let Ollama$1 = class Ollama {
  constructor(config) {
    __publicField(this, "config");
    __publicField(this, "fetch");
    __publicField(this, "ongoingStreamedRequests", []);
    this.config = {
      host: "",
      headers: config?.headers
    };
    if (!config?.proxy) {
      this.config.host = formatHost(config?.host ?? "http://127.0.0.1:11434");
    }
    this.fetch = config?.fetch ?? fetch;
  }
  // Abort any ongoing streamed requests to Ollama
  abort() {
    for (const request of this.ongoingStreamedRequests) {
      request.abort();
    }
    this.ongoingStreamedRequests.length = 0;
  }
  /**
   * Processes a request to the Ollama server. If the request is streamable, it will return a
   * AbortableAsyncIterator that yields the response messages. Otherwise, it will return the response
   * object.
   * @param endpoint {string} - The endpoint to send the request to.
   * @param request {object} - The request object to send to the endpoint.
   * @protected {T | AbortableAsyncIterator<T>} - The response object or a AbortableAsyncIterator that yields
   * response messages.
   * @throws {Error} - If the response body is missing or if the response is an error.
   * @returns {Promise<T | AbortableAsyncIterator<T>>} - The response object or a AbortableAsyncIterator that yields the streamed response.
   */
  async processStreamableRequest(endpoint, request) {
    request.stream = request.stream ?? false;
    const host = `${this.config.host}/api/${endpoint}`;
    if (request.stream) {
      const abortController = new AbortController();
      const response2 = await post(this.fetch, host, request, {
        signal: abortController.signal,
        headers: this.config.headers
      });
      if (!response2.body) {
        throw new Error("Missing body");
      }
      const itr = parseJSON(response2.body);
      const abortableAsyncIterator = new AbortableAsyncIterator(
        abortController,
        itr,
        () => {
          const i = this.ongoingStreamedRequests.indexOf(abortableAsyncIterator);
          if (i > -1) {
            this.ongoingStreamedRequests.splice(i, 1);
          }
        }
      );
      this.ongoingStreamedRequests.push(abortableAsyncIterator);
      return abortableAsyncIterator;
    }
    const response = await post(this.fetch, host, request, {
      headers: this.config.headers
    });
    return await response.json();
  }
  /**
   * Encodes an image to base64 if it is a Uint8Array.
   * @param image {Uint8Array | string} - The image to encode.
   * @returns {Promise<string>} - The base64 encoded image.
   */
  async encodeImage(image) {
    if (typeof image !== "string") {
      const uint8Array = new Uint8Array(image);
      let byteString = "";
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) {
        byteString += String.fromCharCode(uint8Array[i]);
      }
      return btoa(byteString);
    }
    return image;
  }
  /**
   * Generates a response from a text prompt.
   * @param request {GenerateRequest} - The request object.
   * @returns {Promise<GenerateResponse | AbortableAsyncIterator<GenerateResponse>>} - The response object or
   * an AbortableAsyncIterator that yields response messages.
   */
  async generate(request) {
    if (request.images) {
      request.images = await Promise.all(request.images.map(this.encodeImage.bind(this)));
    }
    return this.processStreamableRequest("generate", request);
  }
  /**
   * Chats with the model. The request object can contain messages with images that are either
   * Uint8Arrays or base64 encoded strings. The images will be base64 encoded before sending the
   * request.
   * @param request {ChatRequest} - The request object.
   * @returns {Promise<ChatResponse | AbortableAsyncIterator<ChatResponse>>} - The response object or an
   * AbortableAsyncIterator that yields response messages.
   */
  async chat(request) {
    if (request.messages) {
      for (const message of request.messages) {
        if (message.images) {
          message.images = await Promise.all(
            message.images.map(this.encodeImage.bind(this))
          );
        }
      }
    }
    return this.processStreamableRequest("chat", request);
  }
  /**
   * Creates a new model from a stream of data.
   * @param request {CreateRequest} - The request object.
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or a stream of progress responses.
   */
  async create(request) {
    return this.processStreamableRequest("create", {
      ...request
    });
  }
  /**
   * Pulls a model from the Ollama registry. The request object can contain a stream flag to indicate if the
   * response should be streamed.
   * @param request {PullRequest} - The request object.
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or
   * an AbortableAsyncIterator that yields response messages.
   */
  async pull(request) {
    return this.processStreamableRequest("pull", {
      name: request.model,
      stream: request.stream,
      insecure: request.insecure
    });
  }
  /**
   * Pushes a model to the Ollama registry. The request object can contain a stream flag to indicate if the
   * response should be streamed.
   * @param request {PushRequest} - The request object.
   * @returns {Promise<ProgressResponse | AbortableAsyncIterator<ProgressResponse>>} - The response object or
   * an AbortableAsyncIterator that yields response messages.
   */
  async push(request) {
    return this.processStreamableRequest("push", {
      name: request.model,
      stream: request.stream,
      insecure: request.insecure
    });
  }
  /**
   * Deletes a model from the server. The request object should contain the name of the model to
   * delete.
   * @param request {DeleteRequest} - The request object.
   * @returns {Promise<StatusResponse>} - The response object.
   */
  async delete(request) {
    await del(
      this.fetch,
      `${this.config.host}/api/delete`,
      { name: request.model },
      { headers: this.config.headers }
    );
    return { status: "success" };
  }
  /**
   * Copies a model from one name to another. The request object should contain the name of the
   * model to copy and the new name.
   * @param request {CopyRequest} - The request object.
   * @returns {Promise<StatusResponse>} - The response object.
   */
  async copy(request) {
    await post(this.fetch, `${this.config.host}/api/copy`, { ...request }, {
      headers: this.config.headers
    });
    return { status: "success" };
  }
  /**
   * Lists the models on the server.
   * @returns {Promise<ListResponse>} - The response object.
   * @throws {Error} - If the response body is missing.
   */
  async list() {
    const response = await get(this.fetch, `${this.config.host}/api/tags`, {
      headers: this.config.headers
    });
    return await response.json();
  }
  /**
   * Shows the metadata of a model. The request object should contain the name of the model.
   * @param request {ShowRequest} - The request object.
   * @returns {Promise<ShowResponse>} - The response object.
   */
  async show(request) {
    const response = await post(this.fetch, `${this.config.host}/api/show`, {
      ...request
    }, {
      headers: this.config.headers
    });
    return await response.json();
  }
  /**
   * Embeds text input into vectors.
   * @param request {EmbedRequest} - The request object.
   * @returns {Promise<EmbedResponse>} - The response object.
   */
  async embed(request) {
    const response = await post(this.fetch, `${this.config.host}/api/embed`, {
      ...request
    }, {
      headers: this.config.headers
    });
    return await response.json();
  }
  /**
   * Embeds a text prompt into a vector.
   * @param request {EmbeddingsRequest} - The request object.
   * @returns {Promise<EmbeddingsResponse>} - The response object.
   */
  async embeddings(request) {
    const response = await post(this.fetch, `${this.config.host}/api/embeddings`, {
      ...request
    }, {
      headers: this.config.headers
    });
    return await response.json();
  }
  /**
   * Lists the running models on the server
   * @returns {Promise<ListResponse>} - The response object.
   * @throws {Error} - If the response body is missing.
   */
  async ps() {
    const response = await get(this.fetch, `${this.config.host}/api/ps`, {
      headers: this.config.headers
    });
    return await response.json();
  }
};
const browser = new Ollama$1();

exports.Ollama = Ollama$1;
exports["default"] = browser;


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DOMException: () => (/* binding */ DOMException),
/* harmony export */   Headers: () => (/* binding */ Headers),
/* harmony export */   Request: () => (/* binding */ Request),
/* harmony export */   Response: () => (/* binding */ Response),
/* harmony export */   fetch: () => (/* binding */ fetch)
/* harmony export */ });
/* eslint-disable no-prototype-builtins */
var g =
  (typeof globalThis !== 'undefined' && globalThis) ||
  (typeof self !== 'undefined' && self) ||
  // eslint-disable-next-line no-undef
  (typeof global !== 'undefined' && global) ||
  {}

var support = {
  searchParams: 'URLSearchParams' in g,
  iterable: 'Symbol' in g && 'iterator' in Symbol,
  blob:
    'FileReader' in g &&
    'Blob' in g &&
    (function() {
      try {
        new Blob()
        return true
      } catch (e) {
        return false
      }
    })(),
  formData: 'FormData' in g,
  arrayBuffer: 'ArrayBuffer' in g
}

function isDataView(obj) {
  return obj && DataView.prototype.isPrototypeOf(obj)
}

if (support.arrayBuffer) {
  var viewClasses = [
    '[object Int8Array]',
    '[object Uint8Array]',
    '[object Uint8ClampedArray]',
    '[object Int16Array]',
    '[object Uint16Array]',
    '[object Int32Array]',
    '[object Uint32Array]',
    '[object Float32Array]',
    '[object Float64Array]'
  ]

  var isArrayBufferView =
    ArrayBuffer.isView ||
    function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    name = String(name)
  }
  if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
    throw new TypeError('Invalid character in header field name: "' + name + '"')
  }
  return name.toLowerCase()
}

function normalizeValue(value) {
  if (typeof value !== 'string') {
    value = String(value)
  }
  return value
}

// Build a destructive iterator for the value list
function iteratorFor(items) {
  var iterator = {
    next: function() {
      var value = items.shift()
      return {done: value === undefined, value: value}
    }
  }

  if (support.iterable) {
    iterator[Symbol.iterator] = function() {
      return iterator
    }
  }

  return iterator
}

function Headers(headers) {
  this.map = {}

  if (headers instanceof Headers) {
    headers.forEach(function(value, name) {
      this.append(name, value)
    }, this)
  } else if (Array.isArray(headers)) {
    headers.forEach(function(header) {
      if (header.length != 2) {
        throw new TypeError('Headers constructor: expected name/value pair to be length 2, found' + header.length)
      }
      this.append(header[0], header[1])
    }, this)
  } else if (headers) {
    Object.getOwnPropertyNames(headers).forEach(function(name) {
      this.append(name, headers[name])
    }, this)
  }
}

Headers.prototype.append = function(name, value) {
  name = normalizeName(name)
  value = normalizeValue(value)
  var oldValue = this.map[name]
  this.map[name] = oldValue ? oldValue + ', ' + value : value
}

Headers.prototype['delete'] = function(name) {
  delete this.map[normalizeName(name)]
}

Headers.prototype.get = function(name) {
  name = normalizeName(name)
  return this.has(name) ? this.map[name] : null
}

Headers.prototype.has = function(name) {
  return this.map.hasOwnProperty(normalizeName(name))
}

Headers.prototype.set = function(name, value) {
  this.map[normalizeName(name)] = normalizeValue(value)
}

Headers.prototype.forEach = function(callback, thisArg) {
  for (var name in this.map) {
    if (this.map.hasOwnProperty(name)) {
      callback.call(thisArg, this.map[name], name, this)
    }
  }
}

Headers.prototype.keys = function() {
  var items = []
  this.forEach(function(value, name) {
    items.push(name)
  })
  return iteratorFor(items)
}

Headers.prototype.values = function() {
  var items = []
  this.forEach(function(value) {
    items.push(value)
  })
  return iteratorFor(items)
}

Headers.prototype.entries = function() {
  var items = []
  this.forEach(function(value, name) {
    items.push([name, value])
  })
  return iteratorFor(items)
}

if (support.iterable) {
  Headers.prototype[Symbol.iterator] = Headers.prototype.entries
}

function consumed(body) {
  if (body._noBody) return
  if (body.bodyUsed) {
    return Promise.reject(new TypeError('Already read'))
  }
  body.bodyUsed = true
}

function fileReaderReady(reader) {
  return new Promise(function(resolve, reject) {
    reader.onload = function() {
      resolve(reader.result)
    }
    reader.onerror = function() {
      reject(reader.error)
    }
  })
}

function readBlobAsArrayBuffer(blob) {
  var reader = new FileReader()
  var promise = fileReaderReady(reader)
  reader.readAsArrayBuffer(blob)
  return promise
}

function readBlobAsText(blob) {
  var reader = new FileReader()
  var promise = fileReaderReady(reader)
  var match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type)
  var encoding = match ? match[1] : 'utf-8'
  reader.readAsText(blob, encoding)
  return promise
}

function readArrayBufferAsText(buf) {
  var view = new Uint8Array(buf)
  var chars = new Array(view.length)

  for (var i = 0; i < view.length; i++) {
    chars[i] = String.fromCharCode(view[i])
  }
  return chars.join('')
}

function bufferClone(buf) {
  if (buf.slice) {
    return buf.slice(0)
  } else {
    var view = new Uint8Array(buf.byteLength)
    view.set(new Uint8Array(buf))
    return view.buffer
  }
}

function Body() {
  this.bodyUsed = false

  this._initBody = function(body) {
    /*
      fetch-mock wraps the Response object in an ES6 Proxy to
      provide useful test harness features such as flush. However, on
      ES5 browsers without fetch or Proxy support pollyfills must be used;
      the proxy-pollyfill is unable to proxy an attribute unless it exists
      on the object before the Proxy is created. This change ensures
      Response.bodyUsed exists on the instance, while maintaining the
      semantic of setting Request.bodyUsed in the constructor before
      _initBody is called.
    */
    // eslint-disable-next-line no-self-assign
    this.bodyUsed = this.bodyUsed
    this._bodyInit = body
    if (!body) {
      this._noBody = true;
      this._bodyText = ''
    } else if (typeof body === 'string') {
      this._bodyText = body
    } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
      this._bodyBlob = body
    } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
      this._bodyFormData = body
    } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
      this._bodyText = body.toString()
    } else if (support.arrayBuffer && support.blob && isDataView(body)) {
      this._bodyArrayBuffer = bufferClone(body.buffer)
      // IE 10-11 can't handle a DataView body.
      this._bodyInit = new Blob([this._bodyArrayBuffer])
    } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
      this._bodyArrayBuffer = bufferClone(body)
    } else {
      this._bodyText = body = Object.prototype.toString.call(body)
    }

    if (!this.headers.get('content-type')) {
      if (typeof body === 'string') {
        this.headers.set('content-type', 'text/plain;charset=UTF-8')
      } else if (this._bodyBlob && this._bodyBlob.type) {
        this.headers.set('content-type', this._bodyBlob.type)
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
      }
    }
  }

  if (support.blob) {
    this.blob = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return Promise.resolve(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(new Blob([this._bodyArrayBuffer]))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as blob')
      } else {
        return Promise.resolve(new Blob([this._bodyText]))
      }
    }
  }

  this.arrayBuffer = function() {
    if (this._bodyArrayBuffer) {
      var isConsumed = consumed(this)
      if (isConsumed) {
        return isConsumed
      } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
        return Promise.resolve(
          this._bodyArrayBuffer.buffer.slice(
            this._bodyArrayBuffer.byteOffset,
            this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
          )
        )
      } else {
        return Promise.resolve(this._bodyArrayBuffer)
      }
    } else if (support.blob) {
      return this.blob().then(readBlobAsArrayBuffer)
    } else {
      throw new Error('could not read as ArrayBuffer')
    }
  }

  this.text = function() {
    var rejected = consumed(this)
    if (rejected) {
      return rejected
    }

    if (this._bodyBlob) {
      return readBlobAsText(this._bodyBlob)
    } else if (this._bodyArrayBuffer) {
      return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
    } else if (this._bodyFormData) {
      throw new Error('could not read FormData body as text')
    } else {
      return Promise.resolve(this._bodyText)
    }
  }

  if (support.formData) {
    this.formData = function() {
      return this.text().then(decode)
    }
  }

  this.json = function() {
    return this.text().then(JSON.parse)
  }

  return this
}

// HTTP methods whose capitalization should be normalized
var methods = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']

function normalizeMethod(method) {
  var upcased = method.toUpperCase()
  return methods.indexOf(upcased) > -1 ? upcased : method
}

function Request(input, options) {
  if (!(this instanceof Request)) {
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
  }

  options = options || {}
  var body = options.body

  if (input instanceof Request) {
    if (input.bodyUsed) {
      throw new TypeError('Already read')
    }
    this.url = input.url
    this.credentials = input.credentials
    if (!options.headers) {
      this.headers = new Headers(input.headers)
    }
    this.method = input.method
    this.mode = input.mode
    this.signal = input.signal
    if (!body && input._bodyInit != null) {
      body = input._bodyInit
      input.bodyUsed = true
    }
  } else {
    this.url = String(input)
  }

  this.credentials = options.credentials || this.credentials || 'same-origin'
  if (options.headers || !this.headers) {
    this.headers = new Headers(options.headers)
  }
  this.method = normalizeMethod(options.method || this.method || 'GET')
  this.mode = options.mode || this.mode || null
  this.signal = options.signal || this.signal || (function () {
    if ('AbortController' in g) {
      var ctrl = new AbortController();
      return ctrl.signal;
    }
  }());
  this.referrer = null

  if ((this.method === 'GET' || this.method === 'HEAD') && body) {
    throw new TypeError('Body not allowed for GET or HEAD requests')
  }
  this._initBody(body)

  if (this.method === 'GET' || this.method === 'HEAD') {
    if (options.cache === 'no-store' || options.cache === 'no-cache') {
      // Search for a '_' parameter in the query string
      var reParamSearch = /([?&])_=[^&]*/
      if (reParamSearch.test(this.url)) {
        // If it already exists then set the value with the current time
        this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime())
      } else {
        // Otherwise add a new '_' parameter to the end with the current time
        var reQueryString = /\?/
        this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime()
      }
    }
  }
}

Request.prototype.clone = function() {
  return new Request(this, {body: this._bodyInit})
}

function decode(body) {
  var form = new FormData()
  body
    .trim()
    .split('&')
    .forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
  return form
}

function parseHeaders(rawHeaders) {
  var headers = new Headers()
  // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
  // https://tools.ietf.org/html/rfc7230#section-3.2
  var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ')
  // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
  // https://github.com/github/fetch/issues/748
  // https://github.com/zloirock/core-js/issues/751
  preProcessedHeaders
    .split('\r')
    .map(function(header) {
      return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
    })
    .forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        try {
          headers.append(key, value)
        } catch (error) {
          console.warn('Response ' + error.message)
        }
      }
    })
  return headers
}

Body.call(Request.prototype)

function Response(bodyInit, options) {
  if (!(this instanceof Response)) {
    throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
  }
  if (!options) {
    options = {}
  }

  this.type = 'default'
  this.status = options.status === undefined ? 200 : options.status
  if (this.status < 200 || this.status > 599) {
    throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].")
  }
  this.ok = this.status >= 200 && this.status < 300
  this.statusText = options.statusText === undefined ? '' : '' + options.statusText
  this.headers = new Headers(options.headers)
  this.url = options.url || ''
  this._initBody(bodyInit)
}

Body.call(Response.prototype)

Response.prototype.clone = function() {
  return new Response(this._bodyInit, {
    status: this.status,
    statusText: this.statusText,
    headers: new Headers(this.headers),
    url: this.url
  })
}

Response.error = function() {
  var response = new Response(null, {status: 200, statusText: ''})
  response.ok = false
  response.status = 0
  response.type = 'error'
  return response
}

var redirectStatuses = [301, 302, 303, 307, 308]

Response.redirect = function(url, status) {
  if (redirectStatuses.indexOf(status) === -1) {
    throw new RangeError('Invalid status code')
  }

  return new Response(null, {status: status, headers: {location: url}})
}

var DOMException = g.DOMException
try {
  new DOMException()
} catch (err) {
  DOMException = function(message, name) {
    this.message = message
    this.name = name
    var error = Error(message)
    this.stack = error.stack
  }
  DOMException.prototype = Object.create(Error.prototype)
  DOMException.prototype.constructor = DOMException
}

function fetch(input, init) {
  return new Promise(function(resolve, reject) {
    var request = new Request(input, init)

    if (request.signal && request.signal.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'))
    }

    var xhr = new XMLHttpRequest()

    function abortXhr() {
      xhr.abort()
    }

    xhr.onload = function() {
      var options = {
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
      }
      // This check if specifically for when a user fetches a file locally from the file system
      // Only if the status is out of a normal range
      if (request.url.indexOf('file://') === 0 && (xhr.status < 200 || xhr.status > 599)) {
        options.status = 200;
      } else {
        options.status = xhr.status;
      }
      options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
      var body = 'response' in xhr ? xhr.response : xhr.responseText
      setTimeout(function() {
        resolve(new Response(body, options))
      }, 0)
    }

    xhr.onerror = function() {
      setTimeout(function() {
        reject(new TypeError('Network request failed'))
      }, 0)
    }

    xhr.ontimeout = function() {
      setTimeout(function() {
        reject(new TypeError('Network request timed out'))
      }, 0)
    }

    xhr.onabort = function() {
      setTimeout(function() {
        reject(new DOMException('Aborted', 'AbortError'))
      }, 0)
    }

    function fixUrl(url) {
      try {
        return url === '' && g.location.href ? g.location.href : url
      } catch (e) {
        return url
      }
    }

    xhr.open(request.method, fixUrl(request.url), true)

    if (request.credentials === 'include') {
      xhr.withCredentials = true
    } else if (request.credentials === 'omit') {
      xhr.withCredentials = false
    }

    if ('responseType' in xhr) {
      if (support.blob) {
        xhr.responseType = 'blob'
      } else if (
        support.arrayBuffer
      ) {
        xhr.responseType = 'arraybuffer'
      }
    }

    if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers || (g.Headers && init.headers instanceof g.Headers))) {
      var names = [];
      Object.getOwnPropertyNames(init.headers).forEach(function(name) {
        names.push(normalizeName(name))
        xhr.setRequestHeader(name, normalizeValue(init.headers[name]))
      })
      request.headers.forEach(function(value, name) {
        if (names.indexOf(name) === -1) {
          xhr.setRequestHeader(name, value)
        }
      })
    } else {
      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })
    }

    if (request.signal) {
      request.signal.addEventListener('abort', abortXhr)

      xhr.onreadystatechange = function() {
        // DONE (success or failure)
        if (xhr.readyState === 4) {
          request.signal.removeEventListener('abort', abortXhr)
        }
      }
    }

    xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
  })
}

fetch.polyfill = true

if (!g.fetch) {
  g.fetch = fetch
  g.Headers = Headers
  g.Request = Request
  g.Response = Response
}


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map