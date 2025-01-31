# DeepSeek Chat for VS Code

A VS Code extension that integrates DeepSeek AI chat directly into your development environment. Powered by Ollama, this extension provides local AI assistance without sending your data to the cloud.

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
