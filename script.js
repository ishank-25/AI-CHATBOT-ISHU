// ========== JARVIS AI CORE v2.0 ==========
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const wikiBtn = document.getElementById('wiki-btn');
    const newChatBtn = document.getElementById('new-chat');

    // States
    let isVoiceMode = false;
    let isWikiMode = false;
    let isAwake = true;
    let silenceTimer;
    const SILENCE_TIMEOUT = 5000; // 5 seconds auto-off
    let conversationHistory = [];

    // Voice Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Text-to-Speech
    const synth = window.speechSynthesis;
    const notificationSound = document.getElementById('notification-sound');

    // ===== INITIALIZATION =====
    init();

    function init() {
        setupEventListeners();
        createStatusIndicators();
        loadConversationHistory();
        checkWakeWordSupport();
    }

    function setupEventListeners() {
        voiceBtn.addEventListener('click', toggleVoice);
        wikiBtn.addEventListener('click', toggleWiki);
        sendBtn.addEventListener('click', sendMessage);
        newChatBtn.addEventListener('click', startNewChat);
        
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        userInput.addEventListener('input', autoResizeTextarea);
    }

    // ===== CORE FEATURES =====
    function toggleVoice() {
        isVoiceMode = !isVoiceMode;
        voiceBtn.classList.toggle('active', isVoiceMode);
        
        if (isVoiceMode) {
            startVoiceRecognition();
            showSystemMessage("Voice Mode: ACTIVATED", "voice");
            playNotificationSound();
        } else {
            stopVoiceRecognition();
            showSystemMessage("Voice Mode: DEACTIVATED", "voice");
        }
        updateVoiceIndicator();
    }

    function toggleWiki() {
        isWikiMode = !isWikiMode;
        wikiBtn.classList.toggle('active', isWikiMode);
        updateWikiIndicator();
        
        showSystemMessage(
            `Wikipedia Mode: ${isWikiMode ? "ACTIVATED" : "DEACTIVATED"}`,
            "wiki"
        );
        
        if (isWikiMode) playNotificationSound();
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        conversationHistory.push({ role: 'user', content: message });
        saveConversation();
        
        userInput.value = '';
        autoResizeTextarea();
        showTypingIndicator();

        processUserMessage(message);
    }

    async function processUserMessage(message) {
        try {
            const response = await fetchResponse(message);
            addMessage(response, 'bot');
            conversationHistory.push({ role: 'assistant', content: response });
            saveConversation();
            
            if (isVoiceMode) speak(response);
        } catch (error) {
            addMessage("⚠️ Error processing your request", 'bot');
            console.error("API Error:", error);
        } finally {
            hideTypingIndicator();
        }
    }

    // ===== ENHANCED FEATURES =====
    function startNewChat() {
        if (conversationHistory.length > 0) {
            if (confirm("Start a new conversation? Current chat will be saved.")) {
                conversationHistory = [];
                saveConversation();
                chatMessages.innerHTML = `
                    <div class="welcome-message">
                        <div class="welcome-content">
                            <h3>New Conversation Started</h3>
                            <p>How can I assist you today?</p>
                        </div>
                    </div>
                `;
                playNotificationSound();
            }
        }
    }

    function fetchResponse(message) {
        return fetch('http://localhost:5000/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                wiki_mode: isWikiMode,
                history: conversationHistory.slice(-4) // Send last 4 messages for context
            })
        })
        .then(res => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        })
        .then(data => data.response);
    }

    // ===== VOICE CONTROL =====
    function startVoiceRecognition() {
        try {
            recognition.start();
            resetSilenceTimer();
        } catch (e) {
            console.error("Voice recognition error:", e);
            isVoiceMode = false;
            voiceBtn.classList.remove('active');
        }
    }

    function stopVoiceRecognition() {
        recognition.stop();
        clearTimeout(silenceTimer);
    }

    recognition.onresult = (e) => {
        resetSilenceTimer();
        const transcript = Array.from(e.results)
            .map(result => result[0].transcript)
            .join('');

        if (e.results[e.results.length-1].isFinal) {
            userInput.value = transcript;
            sendMessage();
        }
    };

    recognition.onerror = (e) => {
        console.error("Voice error:", e.error);
        if (isVoiceMode) toggleVoice();
    };

    // ===== VISUAL INDICATORS =====
    function createStatusIndicators() {
        // Voice status indicator
        const voiceStatus = document.createElement('div');
        voiceStatus.className = 'status-indicator voice-status';
        voiceStatus.innerHTML = `
            <div class="pulse-dot"></div>
            <span>Voice</span>
        `;
        document.querySelector('.header-actions').prepend(voiceStatus);

        // Wiki status indicator
        const wikiStatus = document.createElement('div');
        wikiStatus.className = 'status-indicator wiki-status';
        wikiStatus.innerHTML = `
            <div class="wiki-dot"></div>
            <span>Wikipedia</span>
        `;
        document.querySelector('.header-actions').prepend(wikiStatus);
        
        updateAllIndicators();
    }

    function updateAllIndicators() {
        updateVoiceIndicator();
        updateWikiIndicator();
    }

    function updateVoiceIndicator() {
        const dot = document.querySelector('.voice-status .pulse-dot');
        const text = document.querySelector('.voice-status span');
        
        if (isVoiceMode) {
            dot.style.backgroundColor = "#4CAF50";
            text.textContent = "Listening";
        } else {
            dot.style.backgroundColor = "#FF5722";
            text.textContent = "Voice";
        }
    }

    function updateWikiIndicator() {
        const dot = document.querySelector('.wiki-status .wiki-dot');
        const text = document.querySelector('.wiki-status span');
        
        if (isWikiMode) {
            dot.style.backgroundColor = "#4CAF50";
            text.textContent = "Wikipedia";
        } else {
            dot.style.backgroundColor = "#FF5722";
            text.textContent = "Standard";
        }
    }

    // ===== UTILITIES =====
    function speak(text) {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 0.8;
        synth.speak(utterance);
    }

    function playNotificationSound() {
        notificationSound.currentTime = 0;
        notificationSound.play();
    }

    function autoResizeTextarea() {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    }

    function showTypingIndicator() {
        const typing = document.createElement('div');
        typing.className = 'typing';
        typing.innerHTML = `
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        `;
        chatMessages.appendChild(typing);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        const typing = document.querySelector('.typing');
        if (typing) typing.remove();
    }

    function showSystemMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `system-message ${type}-message`;
        msg.textContent = text;
        chatMessages.appendChild(msg);
        scrollToBottom();
    }

    function addMessage(content, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        msgDiv.innerHTML = `<div class="content">${content}</div>`;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        chatMessages.appendChild(msgDiv);
        chatMessages.appendChild(timeDiv);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function resetSilenceTimer() {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (isVoiceMode) {
                toggleVoice();
                showSystemMessage("Voice mode turned off due to inactivity", "system");
            }
        }, SILENCE_TIMEOUT);
    }

    // ===== PERSISTENCE =====
    function saveConversation() {
        localStorage.setItem('ISHU_conversation', JSON.stringify(conversationHistory));
    }

    function loadConversationHistory() {
        const saved = localStorage.getItem('ISHU_conversation');
        if (saved) {
            conversationHistory = JSON.parse(saved);
            if (conversationHistory.length > 0) {
                conversationHistory.forEach(msg => {
                    addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
                });
            }
        }
    }

    // ===== WAKE WORD DETECTION =====
    function checkWakeWordSupport() {
        if (typeof webkitSpeechRecognition === 'undefined') {
            showSystemMessage("Note: Wake word detection requires Chrome browser", "system");
        }
    }
});