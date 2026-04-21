const socket = io();
let username = '';
let isConnected = false;
let typingTimeout = null;
let isTyping = false;

// Join chat
function joinChat() {
  const usernameInput = document.getElementById('usernameInput');
  const inputUsername = usernameInput.value.trim();

  if (inputUsername === '') {
    alert('Please enter a username');
    return;
  }

  if (inputUsername.length > 20) {
    alert('Username cannot exceed 20 characters');
    return;
  }

  username = inputUsername;
  socket.emit('join', username);
  isConnected = true;

  // Hide welcome section and show chat section
  document.getElementById('welcomeSection').style.display = 'none';
  document.getElementById('chatSection').style.display = 'flex';

  // Focus on message input
  document.getElementById('messageInput').focus();
}

// Send message
function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();

  if (message === '') return;

  socket.emit('sendMessage', { message: message });
  messageInput.value = '';
  messageInput.focus();

  // Clear typing status
  if (isTyping) {
    socket.emit('stopTyping');
    isTyping = false;
  }
}

// Handle file upload
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Show uploading indicator
  displaySystemMessage(`📤 Uploading ${file.name}...`);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      // Emit file message through socket
      socket.emit('sendFile', {
        filename: data.filename,
        fileUrl: data.url,
        fileSize: data.size
      });
      
      // Clear the file input
      event.target.value = '';
    } else {
      displaySystemMessage('❌ File upload failed: ' + data.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
    displaySystemMessage('❌ Error uploading file: ' + error.message);
  }
}

// Handle key press
function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// Typing indicator
function handleTyping() {
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing');
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('stopTyping');
  }, 2000);
}

// Leave chat
function leaveChat() {
  if (confirm('Are you sure you want to leave the chat?')) {
    socket.disconnect();
    location.reload();
  }
}

// Display message
function displayMessage(username, message, timestamp, isOwn) {
  const messagesContainer = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  const messageContent = document.createElement('div');
  messageContent.className = `chat-message ${isOwn ? 'own' : ''}`;

  const header = document.createElement('div');
  header.className = 'message-header';
  header.textContent = username;

  const text = document.createElement('div');
  text.className = 'message-text';
  text.textContent = message;

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = timestamp;

  messageContent.appendChild(header);
  messageContent.appendChild(text);
  messageContent.appendChild(time);
  messageDiv.appendChild(messageContent);

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display file message
function displayFileMessage(username, filename, fileUrl, fileSize, timestamp, isOwn) {
  const messagesContainer = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  const messageContent = document.createElement('div');
  messageContent.className = `chat-message ${isOwn ? 'own' : ''}`;

  const header = document.createElement('div');
  header.className = 'message-header';
  header.textContent = username;

  const fileMessageDiv = document.createElement('div');
  fileMessageDiv.className = 'message-text file-message';

  // Check if file is an image
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const fileExtension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const isImage = imageExtensions.includes(fileExtension);

  // If it's an image, display it
  if (isImage) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';

    const img = document.createElement('img');
    img.src = fileUrl;
    img.alt = filename;
    img.className = 'chat-image';
    img.onerror = function() {
      this.style.display = 'none';
      console.error('Failed to load image:', filename);
    };

    imageContainer.appendChild(img);
    fileMessageDiv.appendChild(imageContainer);
  }

  // Add file link
  const fileLink = document.createElement('a');
  fileLink.href = fileUrl;
  fileLink.download = filename;
  fileLink.className = 'file-link';
  fileLink.textContent = `📎 ${filename}`;
  
  const fileSizeSpan = document.createElement('span');
  fileSizeSpan.className = 'file-size';
  fileSizeSpan.textContent = ` (${formatFileSize(fileSize)})`;

  fileMessageDiv.appendChild(fileLink);
  fileMessageDiv.appendChild(fileSizeSpan);

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = timestamp;

  messageContent.appendChild(header);
  messageContent.appendChild(fileMessageDiv);
  messageContent.appendChild(time);
  messageDiv.appendChild(messageContent);

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Display AI response as chat message
function displayAIResponse(data) {
  const messagesContainer = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  const messageContent = document.createElement('div');
  messageContent.className = 'chat-message ai-message';

  const header = document.createElement('div');
  header.className = 'message-header';
  header.textContent = 'Bot';

  const question = document.createElement('div');
  question.className = 'message-text ai-question';
  question.textContent = 'Q: ' + data.question;

  const answer = document.createElement('div');
  answer.className = 'message-text ai-answer';
  answer.textContent = data.answer;

  const source = document.createElement('div');
  source.className = 'message-time ai-source';
  source.textContent = `via ${data.source || 'AI'}`;

  messageContent.appendChild(header);
  messageContent.appendChild(question);
  messageContent.appendChild(answer);
  messageContent.appendChild(source);
  messageDiv.appendChild(messageContent);

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display system message
function displaySystemMessage(message) {
  const messagesContainer = document.getElementById('messagesContainer');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  const systemContent = document.createElement('div');
  systemContent.className = 'system-message';
  systemContent.textContent = message;

  messageDiv.appendChild(systemContent);
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update users list
function updateUsersList(users) {
  const usersList = document.getElementById('usersList');
  usersList.innerHTML = '';

  users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = user;
    if (user === username) {
      li.textContent += ' (You)';
      li.style.background = '#e3f2fd';
      li.style.fontWeight = 'bold';
    }
    usersList.appendChild(li);
  });

  document.getElementById('userCount').textContent = users.length;
}

// Update typing indicator
let typingUsers = new Set();


socket.on('receiveFile', (data) => {
  if (isConnected) {
    const isOwn = data.username === username;
    displayFileMessage(data.username, data.filename, data.fileUrl, data.fileSize, data.timestamp, isOwn);
  }
});
function updateTypingIndicator() {
  const typingDiv = document.getElementById('typingIndicator');
  if (typingUsers.size > 0) {
    const usersList = Array.from(typingUsers).join(', ');
    typingDiv.innerHTML = `<span class="typing-text">${usersList} ${typingUsers.size === 1 ? 'is' : 'are'} typing<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>`;
  } else {
    typingDiv.innerHTML = '';
  }
}

// Socket events
socket.on('userJoined', (data) => {
  if (isConnected) {
    displaySystemMessage(data.message);
    updateUsersList(data.users);
  }
});

socket.on('receiveMessage', (data) => {
  if (isConnected) {
    const isOwn = data.username === username;
    displayMessage(data.username, data.message, data.timestamp, isOwn);
  }
});

socket.on('userLeft', (data) => {
  displaySystemMessage(data.message);
  updateUsersList(data.users);
});

socket.on('userTyping', (data) => {
  if (data.username !== username && isConnected) {
    typingUsers.add(data.username);
    updateTypingIndicator();
  }
});

socket.on('userStoppedTyping', (data) => {
  if (isConnected) {
    typingUsers.delete(data.username);
    updateTypingIndicator();
  }
});

socket.on('disconnect', () => {
  isConnected = false;
});

socket.on('aiResponse', (data) => {
  displayAIResponse(data);
});

// Allow Enter key to join on welcome screen
document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('usernameInput');
  usernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      joinChat();
    }
  });
});
