(function () {
  'use strict';

  console.log('Parlant widget initializing...');

  // Configuration
  const CONFIG = {
    serverAddress: ' https://petiolular-sabra-unhesitatively.ngrok-free.dev',
    agentId: 'B6Tepz5r5h',
  };

  // State
  let sessionId = null;
  let lastOffset = 0;
  let isPolling = false;

  // DOM elements (will be set after creation)
  let chatMessages, messageInput, sendButton, chatStatus;

  // Update chat status
  function updateStatus(message) {
    if (chatStatus) {
      chatStatus.textContent = message;
    }
  }

  // Add message to chat UI
  function addMessageToUI(message, source) {
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    if (source === 'customer') {
      messageDiv.classList.add('customer-message');
    } else {
      messageDiv.classList.add('agent-message');
    }

    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);

    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Send message function
  async function sendMessage() {
    if (!messageInput || !sessionId) return;

    const message = messageInput.value.trim();
    if (!message) return;

    try {
      // Disable input while sending
      messageInput.disabled = true;
      if (sendButton) sendButton.disabled = true;

      // Add message to UI immediately
      addMessageToUI(message, 'customer');

      // Send to Parlant
      const response = await fetch(`${CONFIG.serverAddress}/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'message',
          message: message,
          source: 'customer'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Clear input
      messageInput.value = '';

    } catch (error) {
      console.error('Failed to send message:', error);
      updateStatus('Failed to send message');
    } finally {
      // Re-enable input
      if (messageInput) messageInput.disabled = false;
      if (sendButton) sendButton.disabled = false;
      if (messageInput) messageInput.focus();
    }
  }

  // Long polling for new events
  async function pollForEvents() {
    if (!sessionId || isPolling) return;

    isPolling = true;

    try {
      const response = await fetch(
        `${CONFIG.serverAddress}/sessions/${sessionId}/events?wait_for_data=60&min_offset=${lastOffset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const events = await response.json();

      if (events && events.length > 0) {
        // Process new events
        events.forEach(event => {
          if (event.kind === 'message' && event.source !== 'customer') {
            addMessageToUI(event.data.message, event.source);
          }
        });

        // Update offset for next call
        const lastEvent = events[events.length - 1];
        lastOffset = lastEvent.offset + 1;

        updateStatus('');
      }

    } catch (error) {
      console.error('Polling error:', error);
      updateStatus('Connection error - retrying...');
    } finally {
      isPolling = false;

      // Continue polling
      if (sessionId) {
        setTimeout(pollForEvents, 100);
      }
    }
  }

  // Initialize chat session
  async function initializeChat() {
    try {
      updateStatus('Starting chat session...');

      const response = await fetch(`${CONFIG.serverAddress}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: CONFIG.agentId,
          title: `New Session - ${new Date().toLocaleString()}`,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const session = await response.json();
      sessionId = session.id;

      console.log('Session created:', sessionId);
      updateStatus('Chat ready!');

      // Enable input
      if (messageInput) {
        messageInput.disabled = false;
        messageInput.focus();
      }
      if (sendButton) {
        sendButton.disabled = false;
      }

      // Start polling for events
      pollForEvents();

    } catch (error) {
      console.error('Failed to initialize chat:', error);
      updateStatus('Failed to start chat. Please refresh the page.');
    }
  }

  // Create the widget UI
  function createWidget() {
    const container = document.createElement('div');
    container.className = 'chat-container';
    container.innerHTML = `
      <style>
        .chat-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .chat-bubble {
          width: 60px;
          height: 60px;
          background: #0066FF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-size: 28px;
          transition: transform 0.2s;
        }
        .chat-bubble:hover {
          transform: scale(1.1);
        }
        .chat-window {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          display: none;
          flex-direction: column;
        }
        .chat-window.open {
          display: flex;
        }
        .chat-header {
          background: #0066FF;
          color: white;
          padding: 15px;
          border-radius: 12px 12px 0 0;
        }
        .chat-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        #chat-status {
          font-style: italic;
          color: #fff;
          padding: 5px 0;
          font-size: 12px;
          min-height: 18px;
        }
        #chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          background: #f8f9fa;
        }
        .message {
          margin: 10px 0;
          padding: 10px;
          border-radius: 18px;
          max-width: 80%;
        }
        .customer-message {
          background: #0066FF;
          color: white;
          margin-left: auto;
          text-align: right;
        }
        .agent-message {
          background: white;
          border: 1px solid #ddd;
        }
        .chat-input {
          display: flex;
          padding: 15px;
          background: white;
          border-radius: 0 0 12px 12px;
        }
        .chat-input input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 20px;
          margin-right: 10px;
          font-size: 14px;
          outline: none;
        }
        .chat-input input:focus {
          border-color: #0066FF;
        }
        .chat-input button {
          padding: 10px 20px;
          background: #0066FF;
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
        }
        .chat-input button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      </style>
      
      <div class="chat-bubble" id="chat-bubble">💬</div>
      <div class="chat-window" id="chat-window">
        <div class="chat-header">
          <h3>Customer Support</h3>
          <div id="chat-status">Initializing...</div>
        </div>
        <div id="chat-messages"></div>
        <div class="chat-input">
          <input
            type="text"
            id="message-input"
            placeholder="Type your message..."
            disabled
          />
          <button id="send-button" disabled>Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Get DOM references
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    sendButton = document.getElementById('send-button');
    chatStatus = document.getElementById('chat-status');

    const chatBubble = document.getElementById('chat-bubble');
    const chatWindow = document.getElementById('chat-window');

    // Event listeners
    chatBubble.addEventListener('click', () => {
      const isOpen = chatWindow.classList.toggle('open');
      if (isOpen && !sessionId) {
        initializeChat();
      }
    });

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        sendMessage();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }

  console.log('Parlant widget loaded successfully');

})();
