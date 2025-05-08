// background.js

// IMPORTANT: Replace 'YOUR_GEMINI_API_KEY' with your actual Gemini API key.
// Consider using chrome.storage.local for a more secure way for users to set their API key.
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';

// Listener for the extension icon click to open the side panel if not already open,
// or to toggle it if the browser supports that behavior.
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_CONTENT') {
        callGeminiApi(request.payload, GEMINI_API_KEY)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => {
                console.error('Gemini API Error:', error);
                sendResponse({ success: false, error: error.message || 'Unknown error calling Gemini API' });
            });
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
    }
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
        // Add system instruction to request Markdown output
        systemInstruction: {
            parts: [
                { text: "Please format your entire response in Markdown. If you include code, use Markdown code blocks." }
            ]
        }
        // Optional: Add generationConfig if needed
        // generationConfig: {
        //   temperature: 0.7,
        //   topK: 32,
        //   topP: 1,
        //   maxOutputTokens: 8192, // Increased for potentially longer Markdown
        // }
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
        return `Model finished with reason: ${data.candidates[0].finishReason}. No text content available. (This might also be a Markdown response if the model only returned structured data, check console).`;
    }

    console.warn('Unexpected API response structure:', data);
    return 'No content response from API or unexpected format. The response might be in a part that is not text.';
}