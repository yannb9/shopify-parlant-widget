// widget.js
(function () {
    // Get query params 
    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agentId') || 'default-agent';
    const serverAddress = urlParams.get('server') || 'https://prod.parlant.ai';

    // Create chat container
    const container = document.createElement('div');
    container.className = 'chat-container';
    container.innerHTML = `
    <div class="chat-header"><h3>Customer Support Chat</h3></div>
    <div id="chat-status">Initializing chat...</div>
    <div id="chat-messages" class="chat-messages"></div>
    <div class="chat-input">
      <input type="text" id="message-input" placeholder="Type your message..." disabled/>
      <button id="send-button" disabled>Send</button>
    </div>
  `;
    document.body.appendChild(container);

    // Load CSS dynamically
    const style = document.createElement('style');
    style.innerHTML = `
    .chat-container { position: fixed; bottom: 20px; right: 20px; width: 350px; border: 1px solid #ddd; border-radius: 8px; font-family: Arial; background: white; z-index: 10000; }
    .chat-header { background: #007bff; color: white; padding: 10px; text-align: center; }
    .chat-messages { height: 300px; overflow-y: auto; padding: 10px; background: #f8f9fa; }
    .message { margin: 10px 0; padding: 8px; border-radius: 8px; max-width: 80%; }
    .customer-message { background: #007bff; color: white; margin-left: auto; text-align: right; }
    .agent-message { background: #eee; border: 1px solid #ddd; }
    .chat-input { display: flex; padding: 10px; }
    .chat-input input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-right: 5px; }
    .chat-input button { padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .chat-input button:disabled { background: #ccc; cursor: not-allowed; }
  `;
    document.head.appendChild(style);

    // Import ParlantClient dynamically
    const importScript = document.createElement('script');
    importScript.type = 'module';
    importScript.textContent = `
    import { ParlantClient } from 'https://esm.sh/parlant-client';

    const client = new ParlantClient({ environment: '${serverAddress}' });
    let sessionId = null;
    let lastOffset = 0;

    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatStatus = document.getElementById('chat-status');

    function addMessage(msg, source) {
      const div = document.createElement('div');
      div.className = 'message ' + (source === 'customer' ? 'customer-message' : 'agent-message');
      div.textContent = msg;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendMessage() {
      const msg = messageInput.value.trim();
      if (!msg || !sessionId) return;
      messageInput.disabled = true;
      sendButton.disabled = true;
      addMessage(msg, 'customer');
      await client.sessions.createEvent(sessionId, { kind: 'message', message: msg, source: 'customer' });
      messageInput.value = '';
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
    }

    async function poll() {
      if (!sessionId) return;
      const events = await client.sessions.listEvents(sessionId, { waitForData: 60, minOffset: lastOffset });
      if (events.length > 0) {
        events.forEach(e => { if (e.kind === 'message' && e.source !== 'customer') addMessage(e.data.message, e.source); });
        lastOffset = events[events.length - 1].offset + 1;
        chatStatus.textContent = 'Connected';
      }
      setTimeout(poll, 100);
    }

    async function init() {
      chatStatus.textContent = 'Starting chat...';
      const session = await client.sessions.create({ agentId: '${agentId}', title: 'New Session' });
      sessionId = session.id;
      chatStatus.textContent = 'Chat ready!';
      messageInput.disabled = false;
      sendButton.disabled = false;
      sendButton.addEventListener('click', sendMessage);
      messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
      poll();
    }

    init();
  `;
    document.body.appendChild(importScript);
})();
