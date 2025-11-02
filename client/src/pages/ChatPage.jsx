import React, { useState, useEffect } from "react";
import { useSocket } from "../socket/socket";
import "./ChatPage.css";

export default function ChatPage() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [isRegistering, setIsRegistering] = useState(true);
  const [chatMode, setChatMode] = useState(null); // 'global' or 'private'
  const [privatePhone, setPrivatePhone] = useState("");
  const [privateChatPartner, setPrivateChatPartner] = useState(null);
  const [privateChatJoined, setPrivateChatJoined] = useState(false);
  const [privateChatError, setPrivateChatError] = useState(null);

  const {
    socket,
    connect,
    disconnect,
    isConnected,
    messages,
    users,
    typingUsers,
    sendMessage,
    setTyping,
    register,
    login,
    registrationError,
    loginError,
    isAuthenticated,
    currentUsername,
    joinPrivateChat,
    sendPrivateMessage,
    privateTypingUsers,
    privateMessages,
  } = useSocket();

  // Handle registration
  const handleRegister = () => {
    if (phone.trim() && username.trim()) {
      register(phone, username);
    }
  };

  // Handle login
  const handleLogin = () => {
    if (phone.trim()) {
      login(phone);
    }
  };

  // Join the global chat (after authentication)
  const handleJoinGlobal = () => {
    if (isAuthenticated && (username.trim() || currentUsername)) {
      setChatMode('global');
      connect(username || currentUsername);
      setJoined(true);
    }
  };

  // Join private chat
  const handleJoinPrivate = () => {
    console.log('handleJoinPrivate called', { isAuthenticated, privatePhone, username, currentUsername });
    if (isAuthenticated && privatePhone.trim()) {
      console.log('Calling joinPrivateChat with', privatePhone, username || currentUsername);
      joinPrivateChat(privatePhone, username || currentUsername);
      // Don't set joined here - wait for server confirmation
    } else {
      console.log('Cannot join private chat: not authenticated or no phone number');
      alert('Please enter a phone number to join private chat');
    }
  };

  // Send message
  const handleSend = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      if (chatMode === 'private') {
        sendPrivateMessage(messageInput);
      } else {
        sendMessage(messageInput);
      }
      setMessageInput("");
      setTyping(false);
    }
  };

  // Handle input blur to stop typing
  const handleInputBlur = () => {
    setTyping(false);
  };

  // Typing handler
  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    if (e.target.value.trim()) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  };

  // Listen for private chat joined event
  useEffect(() => {
    const handlePrivateChatJoined = (data) => {
      console.log('Private chat joined event received:', data);
      setPrivateChatPartner(data.partnerUsername);
      setChatMode('private');
      setJoined(true);
      alert(`Private chat started with ${data.partnerUsername}`);
    };

    const handlePrivateChatError = (error) => {
      console.log('Private chat error:', error);
      setPrivateChatError(error);
      alert(`Private chat error: ${error}`);
    };

    socket.on('private_chat_joined', handlePrivateChatJoined);
    socket.on('private_chat_error', handlePrivateChatError);

    return () => {
      socket.off('private_chat_joined', handlePrivateChatJoined);
      socket.off('private_chat_error', handlePrivateChatError);
    };
  }, [socket]);

  // Clean up on unmount
  useEffect(() => {
    return () => disconnect();
  }, []);

  // --- UI ---

  if (!isAuthenticated)
    return (
      <div className="chat-container">
        <form className="auth-form">
          <h2>{isRegistering ? "Register" : "Login"} to join the chat</h2>

          {isRegistering ? (
            <>
              <div className="input-group">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="input-group">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <button type="button" onClick={handleRegister}>
                Register
              </button>
              {registrationError && (
                <div className="error">{registrationError}</div>
              )}
            </>
          ) : (
            <>
              <div className="input-group">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <button type="button" onClick={handleLogin}>
                Login
              </button>
              {loginError && (
                <div className="error">{loginError}</div>
              )}
            </>
          )}

          <button
            className="toggle-link"
            onClick={() => setIsRegistering(!isRegistering)}
            type="button"
          >
            {isRegistering ? "Already registered? Login instead" : "Need to register? Register instead"}
          </button>
        </form>
      </div>
    );

  if (!joined)
    return (
      <div className="chat-container">
        <div className="chat-selection">
          <h2>Welcome, {username}!</h2>
          <p>You are authenticated. Choose your chat mode:</p>
          <div style={{ marginBottom: 20 }}>
            <button type="button" onClick={handleJoinGlobal}>
              Join Global Chat
            </button>
          </div>
          <div>
            <h3>Or join a private chat:</h3>
            <div className="input-group">
              <input
                value={privatePhone}
                onChange={(e) => setPrivatePhone(e.target.value)}
                placeholder="Enter phone number to chat with"
              />
            </div>
            <button type="button" onClick={handleJoinPrivate}>
              Join Private Chat
            </button>
            {privateChatError && (
              <div className="error">{privateChatError}</div>
            )}
          </div>
        </div>
      </div>
    );

  const displayMessages = chatMode === 'private' ? privateMessages : messages;
  const displayTypingUsers = chatMode === 'private' ? privateTypingUsers : typingUsers;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Welcome, {username}!</h2>
        <div className="status">
          <span className={`status-dot ${!isConnected ? 'disconnected' : ''}`}></span>
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>
      <p>Chat Mode: {chatMode === 'private' ? `Private with ${privateChatPartner || 'Unknown'}` : 'Global'}</p>

      <div className="chat-messages">
        {displayMessages.map((m, i) =>
          m.system ? (
            <div key={i} className="message system">
              {m.message}
            </div>
          ) : (
            <div key={i} className={`message ${m.sender === username ? 'own' : 'other'}`}>
              <strong>{m.sender}:</strong> {m.message}
            </div>
          )
        )}
      </div>

      {displayTypingUsers.length > 0 && (
        <div className="typing-indicator">
          {displayTypingUsers.join(", ")} typing...
        </div>
      )}

      <form onSubmit={handleSend} className="message-form">
        <input
          className="message-input"
          value={messageInput}
          onChange={handleTyping}
          onBlur={handleInputBlur}
          placeholder="Type a message..."
        />
        <button type="submit" className="send-button">➤</button>
      </form>

      {chatMode === 'global' && (
        <div className="users-list">
          <h3>Online Users:</h3>
          <ul>
            {users.map((u) => (
              <li key={u.id}>{u.username}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
