// sidepanel/sidepanel.js
document.addEventListener('DOMContentLoaded', () => {
    const modelSelector = document.getElementById('model-selector');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const addScreenshotBtn = document.getElementById('add-screenshot-btn');
    const screenshotPreviewContainer = document.getElementById('screenshot-preview-container');
    const screenshotPreview = document.getElementById('screenshot-preview');
    const removeScreenshotBtn = document.getElementById('remove-screenshot-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageDiv = document.getElementById('error-message');

    let currentScreenshotDataUrl = null;

    // Function to add a message to the chat window
    function addMessageToChat(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        if (sender === 'ai') {
            // Parse Markdown to HTML for AI messages
            // IMPORTANT: For production, sanitize this HTML before injecting.
            // Example with a hypothetical DOMPurify (you'd need to include and use it):
            // messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
            try {
                if (typeof marked === 'undefined') {
                    console.error('marked.js library is not loaded.');
                    messageDiv.textContent = text; // Fallback to text content
                } else {
                    messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(text)); // Use marked.js
                }
            } catch (e) {
                console.error('Error parsing Markdown:', e);
                messageDiv.textContent = text; // Fallback to text if parsing fails
            }
        } else {
            // For user messages and system messages, just use textContent
            messageDiv.textContent = text;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showLoading(isLoading) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
        sendBtn.disabled = isLoading;
        chatInput.disabled = isLoading;
        addScreenshotBtn.disabled = isLoading;
    }

    function displayError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        setTimeout(() => { errorMessageDiv.style.display = 'none'; }, 7000); // Increased timeout for errors
    }

    addScreenshotBtn.addEventListener('click', () => {
        showLoading(true);
        displayError('');
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
            showLoading(false);
            if (response && response.success && response.screenshotDataUrl) {
                currentScreenshotDataUrl = response.screenshotDataUrl;
                screenshotPreview.src = currentScreenshotDataUrl;
                screenshotPreviewContainer.style.display = 'block';
                addMessageToChat('Screenshot added to context.', 'system');
            } else {
                const errorMsg = response && response.error ? response.error : 'Failed to capture screenshot.';
                displayError(errorMsg);
                console.error('Screenshot capture failed:', errorMsg);
            }
        });
    });

    removeScreenshotBtn.addEventListener('click', () => {
        currentScreenshotDataUrl = null;
        screenshotPreview.src = "#";
        screenshotPreviewContainer.style.display = 'none';
        addMessageToChat('Screenshot removed from context.', 'system');
    });

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const prompt = chatInput.value.trim();
        const selectedModel = modelSelector.value;

        if (!prompt) return;

        addMessageToChat(prompt, 'user');
        chatInput.value = '';
        showLoading(true);
        displayError('');

        let screenshotBase64 = null;
        if (currentScreenshotDataUrl) {
            screenshotBase64 = currentScreenshotDataUrl.split(',')[1];
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_CONTENT',
                payload: {
                    model: selectedModel,
                    prompt: prompt,
                    screenshotDataUrlBase64: screenshotBase64
                }
            });

            showLoading(false);
            if (response && response.success) {
                addMessageToChat(response.data, 'ai');
            } else {
                const errorMsg = response && response.error ? response.error : 'Failed to get response from AI.';
                displayError(errorMsg);
                addMessageToChat(`Error: ${errorMsg}`, 'ai'); // Display error as AI message for consistency
                console.error('API call failed:', errorMsg);
            }
        } catch (error) {
            showLoading(false);
            const errorMessageText = error.message || 'An unexpected error occurred sending the message.';
            displayError(errorMessageText);
            addMessageToChat(`Error: ${errorMessageText}`, 'ai'); // Display error as AI message
            console.error('Error sending message:', error);
        }
    }

    addMessageToChat('Welcome! Ask a question or add a screenshot for context. Responses will be in Markdown.', 'system');
});