# LLM Extension

## Description

LLM Extension is a browser extension that allows you to interact with powerful Google Gemini language models directly within a side panel on your current browser tab. You can analyze webpage content by providing it as context (initially via screenshots) and ask questions, with the AI's responses rendered in Markdown for enhanced readability.

## Features

* **Side Panel Interface**: Opens conveniently on any browser tab.
* **Gemini AI Chat**: Engage in conversations with advanced AI models.
* **Model Selector**: Choose between different Gemini models:
    * `gemini-2.5-pro-exp-03-25` (Advanced capabilities)
    * `gemini-2.5-flash-preview-04-17` (Fast and efficient)
* **Screenshot Context**: Capture the visible part of the current webpage and add it as image context to your prompts.
* **Markdown Rendering**: AI responses are parsed and displayed as formatted Markdown, improving readability for lists, code blocks, emphasis, and more.
* **Secure**: Uses DOMPurify to sanitize HTML output from Markdown rendering.

## Tech Stack

* **Core**: JavaScript (ES6+), HTML5, CSS3
* **Browser Extension**: Chrome Extension Manifest V3
    * APIs: `sidePanel`, `activeTab`, `storage`, `runtime`, `action`
* **AI Integration**: Google Gemini API (via `Workspace`)
* **Markdown Processing**:
    * `marked.js`: For parsing Markdown to HTML.
    * `DOMPurify`: For sanitizing the HTML output.

## Prerequisites

* A modern Chromium-based browser that supports Manifest V3 extensions (e.g., Google Chrome, Microsoft Edge).
* A valid Google Gemini API Key.

## Setup and Installation

1.  **Get the Code**:
    * Clone this repository or download the source files into a directory named `llm-extension`.

2.  **Configure API Key**:
    * Open the `background.js` file.
    * Replace the placeholder `'YOUR_GEMINI_API_KEY'` with your actual Google Gemini API key:
        ```javascript
        const GEMINI_API_KEY = 'YOUR_ACTUAL_GEMINI_API_KEY_HERE';
        ```
    * Save the file.

3.  **Install Libraries**:
    * Ensure you have `marked.min.js` and `purify.min.js` (DOMPurify) in the `llm-extension/sidepanel/` directory. If not, download them from their official sources/CDNs.

4.  **Load the Extension in your Browser**:
    * Open your browser and navigate to the extensions page:
        * Chrome: `chrome://extensions`
        * Edge: `edge://extensions`
    * Enable "Developer mode" (usually a toggle switch in the top right corner).
    * Click on "Load unpacked".
    * Select the `llm-extension` directory that contains the `manifest.json` file.
    * The extension icon should now appear in your browser's toolbar.

## Usage

1.  **Open the Side Panel**: Click on the LLM Extension icon in your browser's toolbar while on any webpage. The side panel will open.
2.  **Select a Model**: Use the dropdown menu at the top of the side panel to choose between the available Gemini models.
3.  **Add Screenshot (Optional)**: Click the "Add Page Screenshot to Context" button. A screenshot of the current visible tab will be captured and prepared as context for your next prompt. A preview/confirmation will appear in the side panel.
4.  **Chat**: Type your question or prompt into the text area at the bottom of the side panel and click "Send" or press Enter.
5.  **View Response**: The AI's response will appear in the chat window, formatted as Markdown.

## Future Improvements

* **Text Extraction**: Implement functionality to extract and use textual content from the webpage as context, in addition to screenshots.
* **User-Friendly API Key Management**: Allow users to enter and save their API key via the extension's options page instead of hardcoding.
* **Chat History**: Persist chat history across sessions or tabs.
* **Advanced Styling**: Implement syntax highlighting for code blocks within Markdown.
* **Streaming Responses**: Display AI responses token by token for a more interactive feel.
* **Error Handling**: More granular and user-friendly error messages.