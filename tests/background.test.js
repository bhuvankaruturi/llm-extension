// tests/background.test.js
const {
    getApiKey,
    setApiKey,
    removeApiKey,
    callGeminiApi,
    handleMessage, // Now imported
    handleActionClick // Now imported
  } = require('../background'); // Adjust path as necessary
  
  // Mocks from setupTests.js are automatically applied.
  // global.chrome is available.
  
  describe('Background Script Tests', () => {
    beforeEach(() => {
      // Clears mock usage data before each test.
      // jest.clearAllMocks() is automatically called if clearMocks: true in jest.config.js
      // but explicit call here for clarity and safety.
      jest.clearAllMocks();
      // Reset lastError before each test that might use it
      delete global.chrome.runtime.lastError;
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
        const mockModel = 'gemini-pro';
        const mockPrompt = 'Test prompt';
        const systemInstructionText = "Please format your entire response in Markdown. If you include code, use Markdown code blocks.";

        beforeEach(() => {
            global.fetch.mockClear(); // Clear fetch mock specifically for this block
        });

        it('should form request correctly and return text for standard response', async () => {
            const mockResponseText = 'Gemini response text';
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: mockResponseText }] }, finishReason: 'STOP' }],
                }),
                status: 200,
            });

            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);

            expect(global.fetch).toHaveBeenCalledWith(
                `https://generativelanguage.googleapis.com/v1beta/models/${mockModel}:generateContent?key=${mockApiKey}`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: mockPrompt }] }],
                        systemInstruction: { parts: [{ text: systemInstructionText }] },
                        // generationConfig and safetySettings are not in the provided background.js callGeminiApi
                    }),
                })
            );
            expect(result).toBe(mockResponseText);
        });

        it('should include screenshot data if provided', async () => {
            const mockScreenshotDataUrlBase64 = 'somedata';
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: "Response with image" }] }, finishReason: 'STOP' }],
                }),
                status: 200,
            });
            
            const payload = { model: mockModel, prompt: mockPrompt, screenshotDataUrlBase64: mockScreenshotDataUrlBase64 };
            await callGeminiApi(payload, mockApiKey);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.anything(), // URL
                expect.objectContaining({
                    body: JSON.stringify({
                        contents: [{ parts: [
                            { text: mockPrompt },
                            { inline_data: { mime_type: 'image/png', data: mockScreenshotDataUrlBase64 } }
                        ]}],
                        systemInstruction: { parts: [{ text: systemInstructionText }] },
                    }),
                })
            );
        });

        it('should return block reason if response is blocked', async () => {
            const blockReason = 'SAFETY';
            const blockMessage = 'This content is blocked due to safety reasons.';
            global.fetch.mockResolvedValueOnce({
                ok: true, 
                json: async () => ({
                    promptFeedback: { blockReason: blockReason, blockReasonMessage: blockMessage },
                }),
                status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe(`Response blocked: ${blockReason} - ${blockMessage}`);
        });
        
        it('should return finish reason if not STOP and no text', async () => {
            const finishReason = 'MAX_TOKENS';
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{ finishReason: finishReason, content: { parts: [{text: ""}] } }], 
                }),
                status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            // Based on background.js logic, if parts[0].text is empty, it might fall through to "No content response..."
            // Let's adjust to match the exact logic in background.js:
            // It checks for data.candidates[0].content.parts[0].text first. If that's present (even if empty string), it returns it.
            // If text is missing/null, then it checks finishReason.
            // Let's refine test case for when parts[0].text is NOT there.
            global.fetch.mockClear();
             global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{ finishReason: finishReason /* no content or parts */ }],
                }),
                status: 200,
            });
            const result2 = await callGeminiApi(payload, mockApiKey);
            expect(result2).toBe(`Model finished with reason: ${finishReason}. No text content available.`);
        });


        it('should throw error for invalid API key (400 specifically handled)', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            await expect(callGeminiApi(payload, mockApiKey))
                .rejects.toThrow('API_KEY_INVALID');
        });

        it('should throw generic error message for other HTTP errors (e.g. 500)', async () => {
            const errorMessage = 'Internal Server Error';
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: errorMessage } }),
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            await expect(callGeminiApi(payload, mockApiKey))
                .rejects.toThrow(errorMessage);
        });
        
        it('should throw error for network issues (fetch rejects)', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            const payload = { model: mockModel, prompt: mockPrompt };
            await expect(callGeminiApi(payload, mockApiKey))
                .rejects.toThrow('Network error');
        });

        it('should handle unexpected or empty response structure gracefully', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}), // Empty object
                status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
        });
        
        it('should handle response with no candidates', async () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ someOtherProperty: 'value' }), // No candidates array
              status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
          });
    
          it('should handle response with empty candidates array', async () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({ candidates: [] }), // Empty candidates array
              status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
          });
    
          it('should handle response with no content in candidate', async () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                candidates: [{ finishReason: 'STOP' /* No content object */ }],
              }),
              status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
          });
    
          it('should handle response with no parts in content', async () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                candidates: [{ content: { /* No parts array */ }, finishReason: 'STOP' }],
              }),
              status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
          });
    
          it('should handle response with empty parts array', async () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
              }),
              status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            expect(result).toBe('No content response from API or unexpected format.');
          });

          it('should handle response with no text in part', async () => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                candidates: [{ content: { parts: [{ /* no text property */ }] }, finishReason: 'STOP' }],
              }),
              status: 200,
            });
            const payload = { model: mockModel, prompt: mockPrompt };
            const result = await callGeminiApi(payload, mockApiKey);
            // This case, based on background.js, will return undefined, which then becomes 'No content response from API or unexpected format.'
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
    
            it('should call getApiKey, callGeminiApi, and sendResponse with success if API key exists and API call succeeds', async () => {
                const mockKey = 'fake_key';
                const mockApiResponse = 'Analysis result';
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey })); // Mocks getApiKey
                global.fetch.mockResolvedValueOnce({ // Mocks callGeminiApi
                    ok: true,
                    json: async () => ({ candidates: [{ content: { parts: [{ text: mockApiResponse }] } }] }),
                    status: 200,
                });
    
                // Need to ensure the promise chain in handleMessage completes
                // Wrap in a Promise that resolves when sendResponse is called
                await new Promise(resolve => {
                    handleMessage(analyzeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
    
                expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['geminiApiKey'], expect.any(Function));
                expect(global.fetch).toHaveBeenCalled(); // Check that callGeminiApi's fetch was called
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
                expect(global.fetch).not.toHaveBeenCalled();
            });
    
            it('should send error from callGeminiApi if it throws API_KEY_INVALID', async () => {
                const mockKey = 'fake_key';
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                global.fetch.mockResolvedValueOnce({ // Mocks callGeminiApi throwing API_KEY_INVALID
                    ok: false,
                    status: 400,
                    json: async () => ({ error: { message: 'API key not valid.' } }),
                });
    
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
                const errorMessage = "Some other API error";
                global.chrome.storage.local.get.mockImplementationOnce((keys, callback) => callback({ geminiApiKey: mockKey }));
                global.fetch.mockResolvedValueOnce({ // Mocks callGeminiApi throwing other error
                    ok: false,
                    status: 500,
                    json: async () => ({ error: { message: errorMessage } }),
                });
    
                await new Promise(resolve => {
                    handleMessage(analyzeRequest, {}, (response) => {
                        mockSendResponse(response);
                        resolve();
                    });
                });
    
                expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: errorMessage });
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
