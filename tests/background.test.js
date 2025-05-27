// tests/background.test.js

// Mock @google/generative-ai at the top level
const mockChatSession = {
  sendMessage: jest.fn(),
};
const mockGenerativeModel = {
  startChat: jest.fn().mockReturnValue(mockChatSession),
  // We also need to mock generateContent if it's called by the model directly,
  // though for chat it's usually sendMessage via a ChatSession.
  generateContent: jest.fn(), 
};
const mockGenAIInstance = {
  getGenerativeModel: jest.fn().mockReturnValue(mockGenerativeModel),
};
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => mockGenAIInstance),
}));

// Now require the module to be tested AFTER jest.mock
const {
  getApiKey,
  setApiKey,
  removeApiKey,
  callGeminiApi,
  handleMessage,
  handleActionClick
} = require('../background');

// Mocks from setupTests.js are automatically applied for chrome object.
// global.chrome is available.

describe('Background Script Tests', () => {
  // mockChatSession, mockGenerativeModel, mockGenAIInstance are defined above and are in scope.

  beforeEach(() => {
    // Clears mock usage data (e.g., call counts) before each test.
    jest.clearAllMocks(); 
    // Resets chrome.runtime.lastError before each test.
    delete global.chrome.runtime.lastError;

    // Reset the implementation and state of mocks to ensure clean slate for each test.
    // This is crucial if mocks are defined outside beforeEach and might retain state.
    mockChatSession.sendMessage.mockReset();
    mockGenerativeModel.startChat.mockReset().mockReturnValue(mockChatSession);
    mockGenerativeModel.generateContent.mockReset(); // Reset this as well if used
    mockGenAIInstance.getGenerativeModel.mockReset().mockReturnValue(mockGenerativeModel);
    
    // Ensure the GoogleGenerativeAI constructor mock is also reset for calls and returns the correct instance.
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    GoogleGenerativeAI.mockClear().mockImplementation(() => mockGenAIInstance);
    
    // Reset the internal chatSession state in background.js by sending a specific message.
    // This assumes handleMessage is correctly imported and background.js is structured to handle this.
    handleMessage({ type: 'NEW_CHAT_SESSION' }, {}, jest.fn());
  });

  describe('API Key Functions', () => {
      describe('getApiKey', () => {
        it('should call chrome.storage.local.get with "geminiApiKey" and resolve with the key', async () => {
          const mockKey = 'test_api_key';
          global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => {
            callback({ geminiApiKey: mockKey });
          });
  
          const key = await getApiKey();
          expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['geminiApiKey'], expect.any(Function));
          expect(key).toBe(mockKey);
        });
  
        it('should resolve with undefined if the key is not found', async () => {
          global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => {
            callback({}); // Simulate key not found
          });
  
          const key = await getApiKey();
          expect(key).toBeUndefined();
        });
      });
  
      describe('setApiKey', () => {
        it('should call chrome.storage.local.set with the provided key and resolve true', async () => {
          const mockKey = 'new_api_key';
          global.chrome.storage.local.set.mockImplementationOnce((items, callback) => {
            callback();
          });
  
          const result = await setApiKey(mockKey);
          expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ 'geminiApiKey': mockKey }, expect.any(Function));
          expect(result).toBe(true);
        });
      });
  
      describe('removeApiKey', () => {
        it('should call chrome.storage.local.remove with "geminiApiKey" and resolve true', async () => {
          global.chrome.storage.local.remove.mockImplementationOnce((keys, callback) => {
            callback();
          });
  
          const result = await removeApiKey();
          expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(['geminiApiKey'], expect.any(Function));
          expect(result).toBe(true);
        });
      });
    });
  
    describe('callGeminiApi Function', () => {
        const mockApiKey = 'test-gemini-api-key';
        const mockModelId = 'gemini-pro'; // or gemini-pro-vision if testing images
        const mockPromptText = 'Test prompt';
        const systemInstructionText = "Please format your entire response in Markdown. If you include code, use Markdown code blocks.";

        it('should initialize client, start chat and send message, then return text', async () => {
            const mockResponseText = 'Gemini response text';
            // Use the mockChatSession defined outside beforeEach
            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: {
                    candidates: [{ content: { parts: [{ text: mockResponseText }] }, finishReason: 'STOP' }],
                    // text: () => mockResponseText, // Simpler mock if only text() is used
                }
            });

            const payload = { model: mockModelId, prompt: mockPromptText };
            const result = await callGeminiApi(payload, mockApiKey);
            
            const { GoogleGenerativeAI } = require('@google/generative-ai'); // Get the mocked version
            expect(GoogleGenerativeAI).toHaveBeenCalledWith(mockApiKey);
            expect(mockGenAIInstance.getGenerativeModel).toHaveBeenCalledWith({
                model: mockModelId,
                systemInstruction: systemInstructionText
            });
            expect(mockGenerativeModel.startChat).toHaveBeenCalledWith({ history: [] });
            expect(mockChatSession.sendMessage).toHaveBeenCalledWith([{ text: mockPromptText }]);
            expect(result).toBe(mockResponseText);
        });

        it('should use existing chat session if available', async () => {
            const mockResponseText1 = 'First response';
            const mockResponseText2 = 'Second response';

            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: { candidates: [{ content: { parts: [{ text: mockResponseText1 }] } }] }
            });
            const payload1 = { model: mockModelId, prompt: "First prompt" };
            await callGeminiApi(payload1, mockApiKey);

            expect(mockGenerativeModel.startChat).toHaveBeenCalledTimes(1);
            // mockGenerativeModel.startChat.mockClear(); // Not needed due to mockReset in beforeEach

            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: { candidates: [{ content: { parts: [{ text: mockResponseText2 }] } }] }
            });
            const payload2 = { model: mockModelId, prompt: "Second prompt" };
            const result2 = await callGeminiApi(payload2, mockApiKey);

            expect(mockGenerativeModel.startChat).toHaveBeenCalledTimes(1); // Still 1, not called again
            expect(mockChatSession.sendMessage).toHaveBeenCalledWith([{ text: "Second prompt" }]);
            expect(result2).toBe(mockResponseText2);
        });


        it('should include screenshot data if provided (gemini-pro-vision)', async () => {
            const mockScreenshotDataUrlBase64 = 'somedata';
            const visionModelId = 'gemini-pro-vision';
            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: { candidates: [{ content: { parts: [{ text: "Response with image" }] } }] }
            });
            
            const payload = { model: visionModelId, prompt: mockPromptText, screenshotDataUrlBase64: mockScreenshotDataUrlBase64 };
            await callGeminiApi(payload, mockApiKey);

            expect(mockChatSession.sendMessage).toHaveBeenCalledWith([
                { text: mockPromptText },
                { inlineData: { mimeType: 'image/png', data: mockScreenshotDataUrlBase64 } }
            ]);
        });

        it('should return block reason if response is blocked', async () => {
            const blockReason = 'SAFETY';
            const blockMessage = 'This content is blocked.';
            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: {
                    promptFeedback: { blockReason: blockReason, blockReasonMessage: blockMessage },
                }
            });
            const payload = { model: mockModelId, prompt: mockPromptText };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe(`Response blocked: ${blockReason} - ${blockMessage}`);
        });
        
        it('should return finish reason if not STOP and no text parts', async () => {
            const finishReason = 'MAX_TOKENS';
            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: {
                    // Ensure candidates exists, but parts might be empty or not what's expected for text extraction
                    candidates: [{ finishReason: finishReason, content: { parts: [] } }],
                }
            });
            const payload = { model: mockModelId, prompt: mockPromptText };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe(`Model finished with reason: ${finishReason}. No text content available.`);
        });
         it('should return finish reason if not STOP and no text in part', async () => {
            const finishReason = 'OTHER';
            mockChatSession.sendMessage.mockResolvedValueOnce({
                response: {
                     candidates: [{ finishReason: finishReason, content: { parts: [{ someOtherProperty: 'value'}] } }],
                }
            });
            const payload = { model: mockModelId, prompt: mockPromptText };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe(`Model finished with reason: ${finishReason}. No text content available.`);
        });


        it('should throw API_KEY_INVALID for specific error messages', async () => {
            const errorMessages = ['api key not valid', 'permission_denied', 'api key is invalid'];
            for (const msg of errorMessages) {
                mockChatSession.sendMessage.mockReset().mockRejectedValueOnce(new Error(msg));
                const payload = { model: mockModelId, prompt: mockPromptText };
                handleMessage({ type: 'NEW_CHAT_SESSION' }, {}, jest.fn());
                await expect(callGeminiApi(payload, mockApiKey)).rejects.toThrow('API_KEY_INVALID');
            }
             const permDeniedError = new Error("Some error");
             permDeniedError.status = 'PERMISSION_DENIED';
             mockChatSession.sendMessage.mockReset().mockRejectedValueOnce(permDeniedError);
             handleMessage({ type: 'NEW_CHAT_SESSION' }, {}, jest.fn());
             const payloadForPermDenied = { model: mockModelId, prompt: mockPromptText };
             await expect(callGeminiApi(payloadForPermDenied, mockApiKey)).rejects.toThrow('API_KEY_INVALID');
        });

        it('should throw generic error for other client errors', async () => {
            const errorMessage = 'Some other client error';
            mockChatSession.sendMessage.mockReset().mockRejectedValueOnce(new Error(errorMessage));
            const payload = { model: mockModelId, prompt: mockPromptText };
            handleMessage({ type: 'NEW_CHAT_SESSION' }, {}, jest.fn());
            await expect(callGeminiApi(payload, mockApiKey))
                .rejects.toThrow(errorMessage);
        });
        
        it('should handle unexpected empty response (no candidates, no feedback)', async () => {
            mockChatSession.sendMessage.mockReset().mockResolvedValueOnce({ response: {} });
            const payload = { model: mockModelId, prompt: mockPromptText };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
        });

        it('should handle response with no candidates array', async () => {
            mockChatSession.sendMessage.mockReset().mockResolvedValueOnce({ response: { promptFeedback: null } }); // No candidates
            const payload = { model: mockModelId, prompt: mockPromptText };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
        });
    });

    describe('chrome.runtime.onMessage Listener (handleMessage)', () => {
        let mockSendResponse;
    
        beforeEach(() => {
          mockSendResponse = jest.fn();
        });
    
        describe("ANALYZE_CONTENT", () => {
            const analyzeRequest = {
                type: 'ANALYZE_CONTENT',
                payload: { model: 'gemini-pro', prompt: 'Analyze this' }
            };
             // Mock callGeminiApi for these tests as its unit tests are separate
             let callGeminiApiMock;

             beforeEach(() => {
                 // Ensure we have a fresh mock for each test in this suite
                 // callGeminiApi is in the same module, so we might need to spy on it
                 // or structure it for easier mocking. For now, let's assume it's implicitly tested
                 // by the mock client behavior or we could explicitly mock it if needed.
                 // The current structure of callGeminiApi using the client directly means
                 // mocking the client (GoogleGenerativeAI parts) is the primary way to test.
                 // So, we rely on the mockChatSession.sendMessage mocks.
             });
    
            it('should call getApiKey, then callGeminiApi (via client mocks), and sendResponse with success', async () => {
                const mockKey = 'fake_key';
                const mockApiResponse = 'Analysis result';
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                mockChatSession.sendMessage.mockResolvedValueOnce({ // Mocking the client's response
                    response: { candidates: [{ content: { parts: [{ text: mockApiResponse }] } }] }
                });
    
                await new Promise(resolve => {
                    handleMessage(analyzeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
    
                expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['geminiApiKey'], expect.any(Function));
                expect(mockChatSession.sendMessage).toHaveBeenCalled();
                expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: mockApiResponse });
            });
    
            it('should send API_KEY_MISSING if getApiKey resolves to undefined', async () => {
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({})); // No API key
                
                await new Promise(resolve => {
                    handleMessage(analyzeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
                
                expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'API_KEY_MISSING', message: 'Gemini API Key is not set.' });
                expect(mockChatSession.sendMessage).not.toHaveBeenCalled();
            });
    
            it('should send error from callGeminiApi if it throws API_KEY_INVALID', async () => {
                const mockKey = 'fake_key';
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                mockChatSession.sendMessage.mockRejectedValueOnce(new Error('API key not valid.')); // Mock client error
    
                await new Promise(resolve => {
                    handleMessage(analyzeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
    
                expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'API_KEY_INVALID' });
            });

            it('should send error from callGeminiApi for other errors', async () => {
                const mockKey = 'fake_key';
                const errorMessage = "Some other client error";
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                mockChatSession.sendMessage.mockRejectedValueOnce(new Error(errorMessage)); // Mock client error
    
                await new Promise(resolve => {
                    handleMessage(analyzeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
    
                expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: errorMessage });
            });
        });
        
        describe('NEW_CHAT_SESSION', () => {
            it('should reset chat session and send success response', async () => {
                // First, make a call to establish a session
                const mockKey = 'fake_key';
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                mockChatSession.sendMessage.mockResolvedValueOnce({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } });
                await new Promise(resolve => handleMessage({ type: 'ANALYZE_CONTENT', payload: {} }, {}, () => resolve()));

                expect(mockGenerativeModel.startChat).toHaveBeenCalledTimes(1); // Session was started

                // Now, send NEW_CHAT_SESSION
                await new Promise(resolve => {
                    handleMessage({ type: 'NEW_CHAT_SESSION' }, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
                expect(mockSendResponse).toHaveBeenCalledWith({ success: true, message: 'New chat session started.' });

                // Make another call to ensure a new session is started
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                mockChatSession.sendMessage.mockResolvedValueOnce({ response: { candidates: [{ content: { parts: [{ text: "Hello again" }] } }] } });
                await new Promise(resolve => handleMessage({ type: 'ANALYZE_CONTENT', payload: {} }, {}, () => resolve()));
                
                expect(mockGenerativeModel.startChat).toHaveBeenCalledTimes(2); // Start chat was called again
            });
        });

        describe('CAPTURE_SCREENSHOT', () => {
            const captureRequest = { type: 'CAPTURE_SCREENSHOT' };

            it('should call chrome.tabs.captureVisibleTab and send success with dataUrl', (done) => {
                const mockDataUrl = 'data:image/png;base64,mockscreenshot';
                global.chrome.tabs.captureVisibleTab.mockImplementationOnce((winId, options, callback) => {
                    callback(mockDataUrl);
                });

                handleMessage(captureRequest, {}, (response) => {
                    expect(global.chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(null, { format: 'png' }, expect.any(Function));
                    expect(response).toEqual({ success: true, screenshotDataUrl: mockDataUrl });
                    done();
                });
            });

            it('should send error if chrome.tabs.captureVisibleTab sets lastError', (done) => {
                const errorMessage = 'Failed to capture tab.';
                global.chrome.runtime.lastError = { message: errorMessage };
                global.chrome.tabs.captureVisibleTab.mockImplementationOnce((winId, options, callback) => {
                    callback(null); // dataUrl is null when error
                });

                handleMessage(captureRequest, {}, (response) => {
                    expect(response).toEqual({ success: false, error: errorMessage });
                    delete global.chrome.runtime.lastError; // Clean up
                    done();
                });
            });
        });

        describe('GET_API_KEY_STATUS', () => {
            const getStatusRequest = { type: 'GET_API_KEY_STATUS' };

            it('should return apiKeySet: true and lastChars if key exists', async () => {
                const mockKey = 'abcdef12345';
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                
                await new Promise(resolve => {
                    handleMessage(getStatusRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
                
                expect(mockSendResponse).toHaveBeenCalledWith({ success: true, apiKeySet: true, apiKeyLastChars: '12345' });
            });

            it('should return apiKeySet: false if key does not exist', async () => {
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({}));
                
                await new Promise(resolve => {
                    handleMessage(getStatusRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });

                expect(mockSendResponse).toHaveBeenCalledWith({ success: true, apiKeySet: false });
            });
        });

        describe('SET_API_KEY', () => {
            const newApiKey = 'newKey12345';
            const setRequest = { type: 'SET_API_KEY', apiKey: newApiKey };

            it('should call setApiKey and send success with lastChars', async () => {
                global.chrome.storage.local.set.mockImplementationOnce((items, callback) => callback()); // Mock setApiKey
                
                await new Promise(resolve => {
                    handleMessage(setRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });

                expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ 'geminiApiKey': newApiKey }, expect.any(Function));
                expect(mockSendResponse).toHaveBeenCalledWith({ success: true, apiKeyLastChars: '12345' });
            });
        });

        describe('REMOVE_API_KEY', () => {
            const removeRequest = { type: 'REMOVE_API_KEY' };

            it('should call removeApiKey and send success', async () => {
                global.chrome.storage.local.remove.mockImplementationOnce((keys, callback) => callback()); // Mock removeApiKey
                
                await new Promise(resolve => {
                    handleMessage(removeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });

                expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(['geminiApiKey'], expect.any(Function));
                expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
            });
        });

        it('should return false for unhandled message types', () => {
            const unknownRequest = { type: 'UNKNOWN_MESSAGE' };
            const result = handleMessage(unknownRequest, {}, mockSendResponse);
            expect(result).toBe(false);
            expect(mockSendResponse).not.toHaveBeenCalled();
        });
    });

    describe('chrome.action.onClicked Listener (handleActionClick)', () => {
        it('should open side panel on action click', async () => {
          const mockTab = { id: 1, windowId: 100 };
          // The listener itself is chrome.action.onClicked.addListener(handleActionClick);
          // We test handleActionClick directly.
          await handleActionClick(mockTab);
          expect(global.chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: mockTab.windowId });
        });
      });
  });
