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

    // API Key and Settings Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const apiKeyStatusDisplay = document.getElementById('api-key-status-display');
    const deleteApiKeyBtn = document.getElementById('delete-api-key-btn');
    const apiKeyInputSection = document.getElementById('api-key-input-section');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const chatSection = document.getElementById('chat-section');

    let currentScreenshotDataUrl = null;
    let apiKeyIsSet = false;

    // --- UI Management Functions ---
    function showApiKeyInputScreen() {
        apiKeyInputSection.style.display = 'block';
        chatSection.style.display = 'none';
        settingsPanel.style.display = 'none'; // Hide settings when asking for key
        settingsBtn.style.display = 'none'; // Hide settings button
        apiKeyStatusDisplay.style.display = 'none';
        apiKeyIsSet = false;
    }

    function showChatScreen(apiKeyLastChars = null) {
        apiKeyInputSection.style.display = 'none';
        chatSection.style.display = 'flex'; // Assuming chat section is a flex container
        settingsBtn.style.display = 'block'; // Show settings button
        if (apiKeyLastChars) {
            apiKeyStatusDisplay.textContent = `API Key: ****${apiKeyLastChars}`;
            apiKeyStatusDisplay.style.display = 'block';
            settingsPanel.style.display = 'none'; // Keep settings panel hidden by default
        } else {
            apiKeyStatusDisplay.style.display = 'none';
        }
        apiKeyIsSet = true;
    }

    function displayMaskedApiKey(lastKeyChars) {
        apiKeyStatusDisplay.textContent = `User entered API key: ****${lastKeyChars}`;
        apiKeyStatusDisplay.style.display = 'block';
    }

    // --- API Key Logic ---
    async function checkApiKeyStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY_STATUS' });
            if (response && response.success) {
                if (response.apiKeySet) {
                    apiKeyIsSet = true;
                    showChatScreen(response.apiKeyLastChars);
                } else {
                    apiKeyIsSet = false;
                    showApiKeyInputScreen();
                }
            } else {
                displayError('Could not verify API Key status.');
                showApiKeyInputScreen(); // Fallback
            }
        } catch (error) {
            console.error('Error checking API key status:', error);
            displayError(`Error checking API key: ${error.message}`);
            showApiKeyInputScreen(); // Fallback
        }
    }

    saveApiKeyBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            displayError('API Key cannot be empty.');
            return;
        }
        showLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: key });
            showLoading(false);
            if (response && response.success) {
                apiKeyInput.value = ''; // Clear the input
                apiKeyIsSet = true;
                showChatScreen(response.apiKeyLastChars);
                addMessageToChat('API Key saved successfully.', 'system');
            } else {
                displayError(response.error || 'Failed to save API Key.');
            }
        } catch (error) {
            showLoading(false);
            displayError(`Error saving API Key: ${error.message}`);
        }
    });

    deleteApiKeyBtn.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to delete the stored API Key?")) {
            return;
        }
        showLoading(true);
        try {
            const response = await chrome.runtime.sendMessage({ type: 'REMOVE_API_KEY' });
            showLoading(false);
            if (response && response.success) {
                apiKeyIsSet = false;
                addMessageToChat('API Key deleted.', 'system');
                showApiKeyInputScreen();
            } else {
                displayError(response.error || 'Failed to delete API Key.');
            }
        } catch (error) {
            showLoading(false);
            displayError(`Error deleting API Key: ${error.message}`);
        }
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
    });


    // Function to add a message to the chat window
    function addMessageToChat(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        if (sender === 'ai') {
            try {
                if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
                    console.error('Markdown parsing/sanitizing libraries not loaded.');
                    messageDiv.textContent = text;
                } else {
                    messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(text));
                }
            } catch (e) {
                console.error('Error parsing Markdown:', e);
                messageDiv.textContent = text;
            }
        } else {
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
        saveApiKeyBtn.disabled = isLoading;
        deleteApiKeyBtn.disabled = isLoading;
    }

    function displayError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        setTimeout(() => { errorMessageDiv.style.display = 'none'; }, 7000);
    }

    addScreenshotBtn.addEventListener('click', () => {
        if (!apiKeyIsSet) {
            displayError("Please set your API Key first in settings.");
            showApiKeyInputScreen();
            return;
        }
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
        if (!apiKeyIsSet) {
            displayError("API Key is not set. Please enter your API Key.");
            showApiKeyInputScreen();
            return;
        }

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
                const displayMsg = response && response.message ? response.message : errorMsg;

                if (errorMsg === 'API_KEY_MISSING' || errorMsg === 'API_KEY_INVALID') {
                    addMessageToChat(`Error: ${displayMsg}. Please check or re-enter your API Key.`, 'system');
                    showApiKeyInputScreen();
                } else {
                    displayError(displayMsg);
                    addMessageToChat(`Error: ${displayMsg}`, 'ai');
                }
                console.error('API call failed:', errorMsg);
            }
        } catch (error) {
            showLoading(false);
            const errorMessageText = error.message || 'An unexpected error occurred sending the message.';
            if (errorMessageText === 'API_KEY_MISSING' || errorMessageText === 'API_KEY_INVALID') {
                 addMessageToChat(`Error: ${errorMessageText}. Please check or re-enter your API Key.`, 'system');
                 showApiKeyInputScreen();
            } else {
                displayError(errorMessageText);
                addMessageToChat(`Error: ${errorMessageText}`, 'ai');
            }
            console.error('Error sending message:', error);
        }
    }

    // Initialize: Check API Key status on load
    checkApiKeyStatus().then(() => {
        // Only add welcome message if chat screen is shown
        if (apiKeyIsSet) {
            addMessageToChat('Welcome! Ask a question or add a screenshot. Responses in Markdown.', 'system');
        }
    });
});