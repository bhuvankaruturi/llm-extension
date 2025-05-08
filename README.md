# LLM Extension

## Description

LLM Extension is a browser extension that allows you to interact with powerful Google Gemini language models directly within a side panel on your current browser tab. You can analyze webpage content by providing it as context (initially via screenshots) and ask questions, with the AI's responses rendered in Markdown for enhanced readability. The extension now features runtime API key configuration, storing your key securely in your browser's local storage.

## Features

* **Side Panel Interface**: Opens conveniently on any browser tab.
* **Runtime API Key Configuration**: Enter your Gemini API key directly in the extension side panel. The extension will prompt you on first use or if no key is found.
* **Secure API Key Storage**: Your Gemini API key is stored securely in the browser's local storage, so you don't have to enter it every time.
* **API Key Management**: A settings icon in the side panel allows you to view the status of your API key (masked) and delete the stored key if needed.
* **Gemini AI Chat**: Engage in conversations with advanced AI models.
* **Model Selector**: Choose between different Gemini models:
    * `gemini-2.5-pro-exp-03-25` (Advanced capabilities)
    * `gemini-2.5-flash-preview-04-17` (Fast and efficient)
* **Screenshot Context**: Capture the visible part of the current webpage and add it as image context to your prompts.
* **Markdown Rendering**: AI responses are parsed and displayed as formatted Markdown, improving readability for lists, code blocks, emphasis, and more.
* **Secure**: Uses DOMPurify to sanitize HTML output from Markdown rendering.

## Prerequisites

* A modern Chromium-based browser that supports Manifest V3 extensions (e.g., Google Chrome, Microsoft Edge).
* You will need a valid Google Gemini API Key to use the extension's AI features. You can obtain one from Google AI Studio.

## Setup and Installation

1.  **Get the Code**:
    * Clone this repository or download the source files into a directory named `llm-extension`.

2.  **Install Libraries (if not already present)**:
    * Ensure you have `marked.min.js` and `purify.min.js` (DOMPurify) in the `llm-extension/sidepanel/` directory. If not, download them from their official sources/CDNs. (These are included in the provided files).

3.  **Load the Extension in your Browser**:
    * Open your browser and navigate to the extensions page:
        * Chrome: `chrome://extensions`
        * Edge: `edge://extensions`
    * Enable "Developer mode" (usually a toggle switch in the top right corner).
    * Click on "Load unpacked".
    * Select the `llm-extension` directory that contains the `manifest.json` file.
    * The extension icon should now appear in your browser's toolbar.

## Usage

1.  **Open the Side Panel & Configure API Key**:
    * Click on the LLM Extension icon in your browser's toolbar while on any webpage. The side panel will open.
    * On first use, or if an API key has not been previously saved, you will be prompted to enter your Gemini API Key.
    * Enter your API key in the provided field and click "Save Key". The key will be stored in your browser's local storage. A masked version of the key will be displayed (e.g., `User entered API key: ****<last 5 character>`) in the settings panel once saved.

2.  **Select a Model**:
    * Use the dropdown menu at the top of the side panel to choose between the available Gemini models.

3.  **Add Screenshot (Optional)**:
    * Click the "Add Page Screenshot to Context" button. A screenshot of the current visible tab will be captured. A preview will appear in the side panel.

4.  **Chat**:
    * Type your question or prompt into the text area at the bottom of the side panel and click "Send" or press Enter (without Shift).

5.  **View Response**:
    * The AI's response will appear in the chat window, formatted as Markdown.

6.  **Managing Your API Key**:
    * Click the settings icon (⚙️) located at the top-right of the side panel.
    * This will open a small panel displaying the status of your currently stored API key (masked).
    * Here, you will find a "Delete Stored API Key" button. Clicking this will remove your API key from the browser's storage.
    * If the API key is deleted, the extension will prompt you to enter it again the next time you try to send a message.

## Future Improvements

* **Text Extraction**: Implement functionality to extract and use textual content from the webpage as context.
* **Advanced API Key Management**: More feedback during API key validation; potentially move management to a dedicated options page.
* **Chat History**: Persist chat history across sessions or tabs.
* **Advanced Styling**: Implement syntax highlighting for code blocks within Markdown.
* **Streaming Responses**: Display AI responses token by token for a more interactive feel.
* **Error Handling**: More granular and user-friendly error messages for various API and network issues.