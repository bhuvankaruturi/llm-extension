// background.js

// --- API Key Management ---
async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey);
        });
    });
}

async function setApiKey(apiKey) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ 'geminiApiKey': apiKey }, () => {
            resolve(true);
        });
    });
}

async function removeApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['geminiApiKey'], () => {
            resolve(true);
        });
    });
}

// Listener for the extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_CONTENT') {
        getApiKey().then(apiKey => {
            if (!apiKey) {
                sendResponse({ success: false, error: 'API_KEY_MISSING', message: 'Gemini API Key is not set.' });
                return;
            }
            callGeminiApi(request.payload, apiKey)
                .then(response => sendResponse({ success: true, data: response }))
                .catch(error => {
                    console.error('Gemini API Error:', error);
                    // Check if the error is due to an invalid key, although the API might not return a specific code for this.
                    // For now, we'll rely on the user re-entering if it fails.
                    sendResponse({ success: false, error: error.message || 'Unknown error calling Gemini API' });
                });
        });
        return true; // Indicates that the response is sent asynchronously
    } else if (request.type === 'CAPTURE_SCREENSHOT') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            sendResponse({ success: true, screenshotDataUrl: dataUrl });
        });
        return true;
    } else if (request.type === 'GET_API_KEY_STATUS') {
        getApiKey().then(apiKey => {
            if (apiKey) {
                sendResponse({ success: true, apiKeySet: true, apiKeyLastChars: apiKey.slice(-5) });
            } else {
                sendResponse({ success: true, apiKeySet: false });
            }
        });
        return true;
    } else if (request.type === 'SET_API_KEY') {
        setApiKey(request.apiKey).then(() => {
            sendResponse({ success: true, apiKeyLastChars: request.apiKey.slice(-5) });
        });
        return true;
    } else if (request.type === 'REMOVE_API_KEY') {
        removeApiKey().then(() => {
            sendResponse({ success: true });
        });
        return true;
    }
    return false; // For synchronous messages or if the type is not handled
});

async function callGeminiApi(payload, apiKey) {
    const { model, prompt, screenshotDataUrlBase64 } = payload;
    let apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [{ text: prompt }];

    if (screenshotDataUrlBase64) {
        parts.push({
            inline_data: {
                mime_type: 'image/png',
                data: screenshotDataUrlBase64
            }
        });
    }

    const requestBody = {
        contents: [{ parts: parts }],
        systemInstruction: {
            parts: [
                { text: "Please format your entire response in Markdown. If you include code, use Markdown code blocks." }
            ]
        }
    };

    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error Response:', errorData);
        // Distinguish API key errors if possible, e.g. by status code or error message content
        if (response.status === 400 && errorData.error?.message.toLowerCase().includes('api key not valid')) {
             throw new Error('API_KEY_INVALID');
        }
        const detailedMessage = errorData.error?.details?.[0]?.reason || errorData.error?.message;
        const errorMessage = detailedMessage || `API request failed with status ${response.status}`;
        throw new Error(errorMessage);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0 &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length > 0 &&
        data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
    } else if (data.promptFeedback && data.promptFeedback.blockReason) {
        return `Response blocked: ${data.promptFeedback.blockReason}${data.promptFeedback.blockReasonMessage ? ' - ' + data.promptFeedback.blockReasonMessage : ''}`;
    } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason && data.candidates[0].finishReason !== "STOP") {
        return `Model finished with reason: ${data.candidates[0].finishReason}. No text content available.`;
    }

    console.warn('Unexpected API response structure:', data);
    return 'No content response from API or unexpected format.';
}