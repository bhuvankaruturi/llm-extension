// background.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Stores the current chat session
let chatSession = null;

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

// Named function for handling action clicks to allow export for testing
async function handleActionClick(tab) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
}

// Listener for the extension icon click
chrome.action.onClicked.addListener(handleActionClick);

// Named function for handling messages to allow export for testing
function handleMessage(request, sender, sendResponse) {
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
                    sendResponse({ success: false, error: error.message || 'Unknown error calling Gemini API' });
                });
        });
        return true; // Indicates that the response is sent asynchronously
    } else if (request.type === 'NEW_CHAT_SESSION') {
        chatSession = null;
        sendResponse({ success: true, message: 'New chat session started.' });
        return true;
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
}

chrome.runtime.onMessage.addListener(handleMessage);

async function callGeminiApi(payload, apiKey) {
    const { model, prompt, screenshotDataUrlBase64 } = payload;
    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({
        model: model,
        systemInstruction: "Please format your entire response in Markdown. If you include code, use Markdown code blocks."
    });

    try {
        const parts = [{ text: prompt }];
        if (screenshotDataUrlBase64) {
            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: screenshotDataUrlBase64
                }
            });
        }

        if (!chatSession) {
            chatSession = generativeModel.startChat({
                history: [], // We can enhance history management later
            });
        }

        const result = await chatSession.sendMessage(parts);
        const response = result.response;

        if (response.promptFeedback && response.promptFeedback.blockReason) {
            return `Response blocked: ${response.promptFeedback.blockReason}${response.promptFeedback.blockReasonMessage ? ' - ' + response.promptFeedback.blockReasonMessage : ''}`;
        }

        if (response.candidates && response.candidates.length > 0 &&
            response.candidates[0].content && response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0 &&
            response.candidates[0].content.parts[0].text) {
            return response.candidates[0].content.parts[0].text;
        } else if (response.candidates && response.candidates.length > 0 && response.candidates[0].finishReason && response.candidates[0].finishReason !== "STOP") {
            return `Model finished with reason: ${response.candidates[0].finishReason}. No text content available.`;
        }

        console.warn('Unexpected API response structure:', response);
        return 'No content response from API or unexpected format.';

    } catch (error) {
        console.error('Gemini API Client Error:', error);
        const errorMessage = error.message ? error.message.toLowerCase() : "";
        const errorStatus = error.status ? error.status.toLowerCase() : "";
        const errorToString = error.toString ? error.toString().toLowerCase() : "";

        if (errorMessage.includes('api key') && (errorMessage.includes('invalid') || errorMessage.includes('valid'))) {
            throw new Error('API_KEY_INVALID');
        }
        if (errorMessage.includes('permission_denied') || errorStatus.includes('permission_denied')) {
            throw new Error('API_KEY_INVALID');
        }
        if (errorToString.includes('api key not valid')) { // Keep specific check for toString if necessary
            throw new Error('API_KEY_INVALID');
        }
        throw new Error(error.message || 'Error calling Gemini API with client');
    }
}

module.exports = {
    getApiKey,
    setApiKey,
    removeApiKey,
    callGeminiApi,
    handleMessage,
    handleActionClick
};