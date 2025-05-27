// tests/sidepanel.test.js
const fs = require('fs');
const path = require('path');

const loadHTML = () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../sidepanel/sidepanel.html'), 'utf8');
  document.body.innerHTML = html;
};

const initializeSidepanelScript = async () => {
  let sidepanelModule;
  jest.isolateModules(() => {
    sidepanelModule = require('../sidepanel/sidepanel.js');
  });
  if (sidepanelModule && typeof sidepanelModule.initializeSidepanel === 'function') {
    await sidepanelModule.initializeSidepanel();
  } else {
    console.warn('initializeSidepanel not found or not a function during test init.');
  }
  await new Promise(resolve => setTimeout(resolve, 0)); // Ensure DOM updates
};

describe('Sidepanel Tests', () => {
  beforeEach(() => {
    jest.resetModules(); 
    jest.clearAllMocks();
    loadHTML(); // Load HTML once before each test in the main describe

    // Default global mock - tests should override this with more specific behavior.
    global.chrome.runtime.sendMessage = jest.fn(async (message) => {
        // This default is for promise-style calls if not overridden
        if (message.type === 'GET_API_KEY_STATUS') {
             return { success: true, apiKeySet: true, apiKeyLastChars: 'MOCK' };
        }
        // For CAPTURE_SCREENSHOT, which uses a callback in sidepanel.js
        if (message.type === 'CAPTURE_SCREENSHOT') {
            const cb = arguments[1];
            if (typeof cb === 'function') {
                // Delay to simulate async
                setTimeout(() => cb({ success: true, screenshotDataUrl: 'data:image/png;base64,defaultscreenshotdata' }), 0);
            }
            return true; // Indicate callback will be used for Chrome MV3 compatibility
        }
        return { success: true, defaultMockResponse: true, type: message.type };
    });
  });

  describe('Initial State & checkApiKeyStatus', () => {
    it('should show chat screen if API key is set', async () => {
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
        if (message.type === 'GET_API_KEY_STATUS') {
          return { success: true, apiKeySet: true, apiKeyLastChars: '12345' };
        }
        return { success: true, defaultMockResponse: true };
      });
      await initializeSidepanelScript();

      const chatSection = document.getElementById('chat-section'); 
      const apiKeyInputSection = document.getElementById('api-key-input-section'); 
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_API_KEY_STATUS' });
      expect(chatSection.style.display).toBe('flex'); 
      expect(apiKeyInputSection.style.display).toBe('none');
      const apiKeyStatusDiv = document.getElementById('api-key-status-display'); 
      expect(apiKeyStatusDiv.textContent).toContain('12345');
    });

    it('should show API key input screen if API key is NOT set', async () => {
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
        if (message.type === 'GET_API_KEY_STATUS') {
          return { success: true, apiKeySet: false };
        }
        return { success: true, defaultMockResponse: true };
      });
      await initializeSidepanelScript();

      const chatSection = document.getElementById('chat-section'); 
      const apiKeyInputSection = document.getElementById('api-key-input-section'); 
      expect(chatSection.style.display).toBe('none');
      expect(apiKeyInputSection.style.display).toBe('block'); 
    });

    it('should show API key input screen and display error if checkApiKeyStatus fails (network error)', async () => {
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
        if (message.type === 'GET_API_KEY_STATUS') {
          throw new Error('Network Failure'); 
        }
        return { success: true, defaultMockResponse: true };
      });
      await initializeSidepanelScript();
      
      const errorMessageDiv = document.getElementById('error-message'); 
      expect(errorMessageDiv.textContent).toBe('Error checking API key: Network Failure'); 
    });
  });

  describe('API Key Management', () => {
    let apiKeyInput, saveApiKeyBtn;
    beforeEach(async () => {
      // Ensure API key input screen is shown for these tests
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
          if (message.type === 'GET_API_KEY_STATUS') { 
              return { success: true, apiKeySet: false };
          }
          return {success: true, defaultMockResponse: true};
      });
      await initializeSidepanelScript();
      apiKeyInput = document.getElementById('api-key-input');
      saveApiKeyBtn = document.getElementById('save-api-key-btn');
    });

    it('should save API key and show chat screen on success', async () => {
      apiKeyInput.value = 'testkey123';
      // This specific mock for the SET_API_KEY action
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => { 
        if (message.type === 'SET_API_KEY' && message.apiKey === 'testkey123') {
          return { success: true, apiKeyLastChars: 'y123' };
        }
        // If checkApiKeyStatus is called again by showChatScreen
        if (message.type === 'GET_API_KEY_STATUS') { 
            return { success: true, apiKeySet: true, apiKeyLastChars: 'y123'};
        }
        return {success: true, defaultMockResponse: true};
      });
      
      saveApiKeyBtn.click(); 
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'SET_API_KEY', apiKey: 'testkey123' });
      const chatSection = document.getElementById('chat-section');
      expect(chatSection.style.display).toBe('flex');
      expect(document.getElementById('api-key-status-display').textContent).toContain('y123');
    });
  });

  describe('Delete API Key', () => {
    let deleteApiKeyBtnElement;
    beforeEach(async () => {
        global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
            if (message.type === 'GET_API_KEY_STATUS') {
                return { success: true, apiKeySet: true, apiKeyLastChars: 'DELKEY' };
            }
            return {success: true, defaultMockResponse: true};
        });
         await initializeSidepanelScript();
        deleteApiKeyBtnElement = document.getElementById('delete-api-key-btn');
    });

    it('should remove API key and show input screen', async () => {
        global.window.confirm = jest.fn(() => true);
        global.chrome.runtime.sendMessage.mockImplementation(async (message) => { 
          if (message.type === 'REMOVE_API_KEY') {
            return { success: true };
          }
          if (message.type === 'GET_API_KEY_STATUS') { 
            return { success: true, apiKeySet: false }; // After deletion
          }
          return {success: true, defaultMockResponse: true};
        });
        
        deleteApiKeyBtnElement.click(); 
        await new Promise(resolve => setTimeout(resolve, 0));
    
        const removeCall = global.chrome.runtime.sendMessage.mock.calls.find(c => c[0].type === 'REMOVE_API_KEY');
        expect(removeCall).toBeDefined();
        expect(document.getElementById('api-key-input-section').style.display).toBe('block');
      });
  });
  
  describe('Settings Panel Toggle', () => {
    it('should toggle settings panel display', async () => {
      // Start with API key set to see settings button
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
        if (message.type === 'GET_API_KEY_STATUS') 
            return { success: true, apiKeySet: true, apiKeyLastChars: 'SETTINGS' };
        return {success: true, defaultMockResponse: true};
      });
      await initializeSidepanelScript();

      const settingsBtn = document.getElementById('settings-btn');
      const settingsPanel = document.getElementById('settings-panel');
      expect(settingsPanel.style.display).toBe('none'); 
      settingsBtn.click();
      expect(settingsPanel.style.display).toBe('block');
      settingsBtn.click();
      expect(settingsPanel.style.display).toBe('none');
    });
  });

  describe('Sending a Message', () => {
    let chatInputElement, sendBtnElement;
    beforeEach(async () => {
      global.chrome.runtime.sendMessage.mockImplementation(async (message) => {
        if (message.type === 'GET_API_KEY_STATUS') {
          return { success: true, apiKeySet: true, apiKeyLastChars: 'SENDMSG' };
        } else if (message.type === 'ANALYZE_CONTENT') {
          return { success: true, data: "AI reply for: " + message.payload.prompt };
        }
        return {success: true, defaultMockResponse: true};
      });
      await initializeSidepanelScript();
      chatInputElement = document.getElementById('chat-input');
      sendBtnElement = document.getElementById('send-btn');
    });

    it('should send message and display user/AI responses', async () => {
      chatInputElement.value = 'Hello AI';
      sendBtnElement.click(); 
      await new Promise(resolve => setTimeout(resolve, 0));

      const chatMessages = document.getElementById('chat-messages');
      // Welcome, User, AI
      expect(chatMessages.children.length).toBe(3); 
      expect(chatMessages.children[1].textContent).toBe('Hello AI'); 
      expect(chatMessages.children[2].innerHTML).toContain("AI reply for: Hello AI");
      expect(global.marked.parse).toHaveBeenCalledWith("AI reply for: Hello AI");
    });
  });
  
  describe('Screenshot Handling', () => { 
    let addScreenshotBtn, removeScreenshotBtn, screenshotPreview;

    beforeEach(async () => {
        global.chrome.runtime.sendMessage.mockImplementation((message, callbackOrPromise) => {
            if (message.type === 'GET_API_KEY_STATUS') {
              return Promise.resolve({ success: true, apiKeySet: true, apiKeyLastChars: 'SCREEN' });
            } else if (message.type === 'CAPTURE_SCREENSHOT') {
              // This specific handler in sidepanel.js uses a callback.
              const callback = callbackOrPromise; // It's the second argument
              if (typeof callback === 'function') {
                setTimeout(() => callback({ success: true, screenshotDataUrl: 'data:image/png;base64,screenshotdata' }),0);
              }
              return true; // Indicate callback will be used
            }
            // Default for other promise-based calls that might occur
            return Promise.resolve({success: true, defaultMockResponse: true});
          });
        await initializeSidepanelScript();
        addScreenshotBtn = document.getElementById('add-screenshot-btn');
        removeScreenshotBtn = document.getElementById('remove-screenshot-btn');
        screenshotPreview = document.getElementById('screenshot-preview');
    });

    it('Add Screenshot: should display preview', async () => {
      addScreenshotBtn.click();
      await new Promise(resolve => setTimeout(resolve, 0)); 
      
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CAPTURE_SCREENSHOT' }, expect.any(Function));
      expect(screenshotPreview.src).toBe('data:image/png;base64,screenshotdata');
      expect(document.getElementById('screenshot-preview-container').style.display).toBe('block'); 
    });

    it('Remove Screenshot: should clear preview', async () => {
        // First, add a screenshot
        addScreenshotBtn.click();
        await new Promise(resolve => setTimeout(resolve, 0)); 
        expect(screenshotPreview.src).toBe('data:image/png;base64,screenshotdata'); // Ensure it's there
  
        // Then, remove it
        removeScreenshotBtn.click(); // This is synchronous DOM manipulation
        expect(screenshotPreview.src).toMatch(/#$|undefined$|http:\/\/localhost\/$/); // src becomes "#" or empty
        expect(document.getElementById('screenshot-preview-container').style.display).toBe('none');
      });
  });
});
