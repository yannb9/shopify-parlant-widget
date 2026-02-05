(function () {
  'use strict';

  console.log('Parlant widget loading...');

  // Configuration
  const CONFIG = {
    parlantServer: 'https://petiolular-sabra-unhesitatively.ngrok-free.app',
    agentId: 'B6Tepz5r5h'
  };

  let sessionId = null;
  let lastOffset = 0;
  let isPolling = false;
  let parlantClient = null;

  // Load Parlant client
  function loadParlantClient() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import { ParlantClient } from 'https://cdn.jsdelivr.net/npm/parlant-client@latest/+esm';
        window.__ParlantClient = ParlantClient;
        window.dispatchEvent(new Event('parlant-ready'));
      `;

      window.addEventListener('parlant-ready', () => {
        parlantClient = new window.__ParlantClient({
          environment: CONFIG.parlantServer
        });
        resolve();
      }, { once: true });

      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Create widget UI
  function createWidget() {
    const container = document.createElement('div');
    container.id = 'parlant-chat-widget';
    container.innerHTML = `
      <style>
        #parlant-chat-bubble {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 60px;
          height: 60px;
          background: #0066FF;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 999999;
          font-size: 28px;
          transition: transform 0.2s;
        }
        #parlant-chat-bubble:hover {
          transform: scale(1.1);
        }
        #parlant-chat-window {
          position: fixed;
          bottom: 90px;
          right: 20px;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          z-index: 999998;
          display: none;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #parlant-chat-window.open {
          display: flex;
        }
        .parlant-header {
          padding: 20px;
          background: #0066FF;
          color: white;
          border-radius: 12px 12px 0 0;
        }
        .parlant-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        #parlant-messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          background: #f8f9fa;
        }
        .parlant-message {
          margin: 8px 0;
          padding: 10px 14px;
          border-radius: 18px;
          max-width: 80%;
          word-wrap: break-word;
        }
        .parlant-message.customer {
          background: #0066FF;
          color: white;
          margin-left: auto;
          text-align: right;
        }
        .parlant-message.agent {
          background: white;
          color: #333;
          border: 1px solid #e0e0e0;
        }
        .parlant-input-area {
          padding: 15px;
          border-top: 1px solid #e0e0e0;
          background: white;
          border-radius: 0 0 12px 12px;
        }
        #parlant-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 14px;
          outline: none;
        }
        #parlant-input:focus {
          border-color: #0066FF;
        }
        .parlant-status {
          font-size: 12px;
          color: #666;
          font-style: italic;
          padding: 5px 15px;
        }
      </style>
      
      <div id="parlant-chat-bubble">💬</div>
      <div id="parlant-chat-window">
        <div class="parlant-header">
          <h3>Chat with us</h3>
        </div>
        <div class="parlant-status" id="parlant-status"></div>
        <div id="parlant-messages"></div>
        <div class="parlant-input-area">
          <input 
            type="text" 
            id="parlant-input" 
            placeholder="Type a message..." 
            disabled
          />
        </div>
      </div>
    `;

    document.body.appendChild(container);
    setupEventHandlers();
  }

  function setupEventHandlers() {
    const bubble = document.getElementById('parlant-chat-bubble');
    const chatWindow = document.getElementById('parlant-chat-window');
    const input = document.getElementById('parlant-input');

    bubble.addEventListener('click', async () => {
      chatWindow.classList.toggle('open');

      if (!sessionId && chatWindow.classList.contains('open')) {
        await initSession();
      }
    });

    input.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        await sendMessage(e.target.value);
        e.target.value = '';
      }
    });
  }

  function updateStatus(message) {
    const statusEl = document.getElementById('parlant-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  function addMessage(text, source) {
    const messagesDiv = document.getElementById('parlant-messages');
    const msgEl = document.createElement('div');
    msgEl.className = 'parlant-message ' + source;
    msgEl.textContent = text;
    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function initSession() {
    try {
      updateStatus('Starting chat...');

      const session = await parlantClient.sessions.create({
        agentId: CONFIG.agentId,
        title: 'Customer Chat - ' + new Date().toLocaleString()
      });

      sessionId = session.id;
      console.log('Session created:', sessionId);

      updateStatus('');

      const input = document.getElementById('parlant-input');
      input.disabled = false;
      input.focus();

      pollForEvents();

    } catch (error) {
      console.error('Failed to create session:', error);
      updateStatus('Failed to start chat');
    }
  }

  async function sendMessage(message) {
    if (!sessionId) return;

    try {
      addMessage(message, 'customer');

      await parlantClient.sessions.createEvent(sessionId, {
        kind: 'message',
        source: 'customer',
        message: message
      });

      updateStatus('Agent is thinking...');

    } catch (error) {
      console.error('Failed to send message:', error);
      updateStatus('Failed to send message');
    }
  }

  async function pollForEvents() {
    if (!sessionId || isPolling) return;

    isPolling = true;

    while (sessionId) {
      try {
        const events = await parlantClient.sessions.listEvents(sessionId, {
          minOffset: lastOffset,
          waitForData: 30
        });

        if (events && events.length > 0) {
          events.forEach(event => {
            if (event.kind === 'message' && event.source !== 'customer') {
              addMessage(event.data.message, 'agent');
              updateStatus('');
            }
            lastOffset = Math.max(lastOffset, event.offset + 1);
          });
        }

      } catch (error) {
        console.error('Polling error:', error);
        updateStatus('Connection error - retrying...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    isPolling = false;
  }

  // Initialize
  async function init() {
    try {
      await loadParlantClient();
      createWidget();
      console.log('Parlant widget ready!');
    } catch (error) {
      console.error('Failed to initialize widget:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();