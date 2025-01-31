# DeepSeek Chat for VS Code

This repository contains:
1. 🔧 Source code for the VS Code extension
2. 📦 Pre-built extension (.vsix) available in [Releases](link-to-releases)

## Quick Install

### Option 1: Install from VSIX
1. Download `deepseek-0.0.1.vsix` from [Releases](link-to-releases)
2. In VS Code: `Ctrl+Shift+P` → "Install from VSIX"
3. Select the downloaded .vsix file

### Option 2: Build from Source
git clone https://github.com/yourusername/vscode-deepseek-chat.git
cd vscode-deepseek-chat
npm install
npm run package

## Install local DeepSeek model Windows
1. First, download and install Ollama from the official <a href="https://ollama.com/download">website</a>
2. Pick a DeepSeekmodel to download and run locally here: <a href="https://ollama.com/library/deepseek-r1">https://ollama.com/library/deepseek-r1</a>
-- i'm using deepseek-r1:8b in this extension. Pick a model your hardware can handle to run locally.
3. From the Ollama website copy the command to download the model and run it in your terminal. 
```console
ollama run deepseek-r1:8b
```
4. Now you should be able to use deepseek chat in the terminal if intallation was successful.


## Repository Structure
/
├── src/              # Extension source code
├── .vscode/          # VS Code settings
├── package.json      # Extension manifest
└── README.md         # This file

<img src="https://github.com/user-attachments/assets/3ff4bc2f-24d1-40b7-95c3-ef037481d6f4" width="300">


## Features

- 🤖 Local AI processing using Ollama
- 💻 Seamless VS Code integration
- 🔒 Privacy-focused: All processing happens on your machine
- 📝 Real-time streaming responses
- 🎨 Clean, modern interface

## Prerequisites

Before using this extension, make sure you have:

1. [Ollama](https://ollama.ai/) installed on your system
2. DeepSeek model pulled locally:

ollama pull deepseek-r1:8b

## Installation

1. Install the extension from VS Code Marketplace (or provide .vsix installation instructions)
2. Restart VS Code
3. Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac) to open DeepSeek Chat

## Usage

1. Open DeepSeek Chat using:
   - Keyboard shortcut: `Ctrl+Shift+D` / `Cmd+Shift+D`
   - Command Palette: `Ctrl+Shift+P` then type "DeepSeek Chat"
2. Type your question in the text area
3. Click "Ask" or press Enter to get a response

## Commands

- `deepseek.start`: Start DeepSeek Chat

## Keyboard Shortcuts

- Open DeepSeek Chat: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

## Configuration

Currently, the extension uses the following default settings:
- Model: deepseek-r1:8b
- Local Ollama instance on default port

## Known Issues

- Extension requires Ollama to be running locally
- First response might take a few seconds as the model loads

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Development

# Clone the repository
git clone https://github.com/yourusername/vscode-deepseek-chat.git

# Install dependencies
npm install

# Run the extension in development mode
F5 in VS Code

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter)

Project Link: [https://github.com/yourusername/vscode-deepseek-chat](https://github.com/yourusername/vscode-deepseek-chat)

## Acknowledgments

- [Ollama](https://ollama.ai/)
- [DeepSeek AI](https://deepseek.ai/)
- [VS Code Extension API](https://code.visualstudio.com/api)
