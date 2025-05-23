// Mock the global chrome object
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback()),
      remove: jest.fn((keys, callback) => callback()),
    },
  },
  runtime: {
    sendMessage: jest.fn((message, callback) => {
        // Default mock implementation for both promise and callback styles.
        // Can be overridden in specific tests.
        if (typeof callback === 'function') {
            // Simulate async callback execution
            setTimeout(() => callback({ success: true, defaultMockResponse: true }), 0);
            return true; // Indicates callback will be called
        }
        // For promise-based calls
        return Promise.resolve({ success: true, defaultMockResponse: true });
    }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    lastError: null, // or undefined, depending on how it's typically accessed
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
    },
  },
  sidePanel: {
    open: jest.fn(async () => {}),
  },
  tabs: {
    captureVisibleTab: jest.fn((windowId, options, callback) => {
        // Default mock: success with a dummy data URL
        if (callback) callback('data:image/png;base64,dummydata');
        // Or handle chrome.runtime.lastError for error simulation
    }),
  },
};

// Mock global fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}), // Default to a successful empty JSON response
    text: () => Promise.resolve(''), // Default to a successful empty text response
    status: 200,
  })
);

// Mock for libraries used in sidepanel.js if they are not imported via modules
global.marked = {
    parse: jest.fn(text => text) // Simple mock, returns text as is
};
global.DOMPurify = {
    sanitize: jest.fn(html => html) // Simple mock, returns html as is
};

// Mock for alert and confirm
global.alert = jest.fn();
global.confirm = jest.fn(() => true); // Default to user "confirming"
