import React, { useState, useEffect } from "react";
import { useSocket } from "../socket/socket";

export default function ChatPage() {
  const [username, setUsername] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [authToken, setAuthToken] = useState(localStorage.getItem('chatToken') || '');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageStatuses, setMessageStatuses] = useState({});
  const [isReconnecting, setIsReconnecting] = useState(false);

  const {
    connect,
    disconnect,
    isConnected,
    messages,
    users,
    typingUsers,
    sendMessage,
    setTyping,
  } = useSocket();

  // Join the chat with JWT auth
  const handleJoin = () => {
    if (username.trim()) {
      connect(username, authToken);
      setJoined(true);
    }
  };

  // Send message
  const handleSend = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput("");
      setTyping(false);
    }
  };

  // Typing handler
  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    setTyping(true);
    setTimeout(() => setTyping(false), 1500);
  };

  // Load initial messages and handle reconnection
  useEffect(() => {
    if (joined) {
      loadMessages(currentPage);
    }
  }, [joined, currentPage]);

  // Handle reconnection
  useEffect(() => {
    const handleReconnect = () => {
      setIsReconnecting(true);
      if (username && authToken) {
        connect(username, authToken);
      }
      setTimeout(() => setIsReconnecting(false), 2000);
    };

    const socket = useSocket().socket;
    socket.on('connect', () => setIsReconnecting(false));
    socket.on('disconnect', () => setIsReconnecting(true));
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      disconnect();
    };
  }, [username, authToken]);

  // Handle auth success and message acks
  useEffect(() => {
    const socket = useSocket().socket;
    socket.on('auth_success', (data) => {
      setAuthToken(data.token);
      localStorage.setItem('chatToken', data.token);
    });

    socket.on('auth_error', (error) => {
      alert(`Authentication error: ${error}`);
      setJoined(false);
    });

    socket.on('message_ack', (ack) => {
      setMessageStatuses(prev => ({
        ...prev,
        [ack.messageId]: ack.status
      }));
    });

    return () => {
      socket.off('auth_success');
      socket.off('auth_error');
      socket.off('message_ack');
    };
  }, []);

  // Load messages from API
  const loadMessages = async (page = 1) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages?page=${page}&limit=20`);
      const data = await response.json();
      if (page === 1) {
        setMessages(data.messages);
      } else {
        setMessages(prev => [...data.messages, ...prev]);
      }
      setHasMoreMessages(data.hasMore);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Load more messages
  const loadMoreMessages = () => {
    if (hasMoreMessages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Search messages
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`http://localhost:5000/api/messages/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.messages);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- UI ---

  if (!joined)
    return (
      <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
        <h2>Enter your name to join the chat:</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
        />
        <button onClick={handleJoin} style={{ width: '100%', padding: '10px' }}>Join</button>
        {authToken && <small style={{ color: '#666' }}>Returning user - auto-authenticated</small>}
      </div>
    );

  const displayMessages = isSearching ? searchResults : messages;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto", fontFamily: 'Arial, sans-serif' }}>
      <h2>Welcome, {username}!</h2>
      <p>
        {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
        {isReconnecting && " (Reconnecting...)"}
      </p>

      {/* Search Bar */}
      <div style={{ marginBottom: '10px' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search messages..."
          style={{ width: '70%', padding: '8px', marginRight: '10px' }}
        />
        <button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
        {isSearching && <button onClick={() => { setSearchQuery(''); setSearchResults([]); setIsSearching(false); }}>Clear</button>}
      </div>

      {/* Messages Container */}
      <div
        style={{
          border: "1px solid #ccc",
          height: "400px",
          overflowY: "auto",
          marginBottom: "10px",
          padding: "10px",
          background: "#fafafa",
        }}
      >
        {hasMoreMessages && !isSearching && (
          <button onClick={loadMoreMessages} style={{ width: '100%', marginBottom: '10px' }}>
            Load Older Messages
          </button>
        )}

        {displayMessages.map((m, i) =>
          m.system ? (
            <div key={i} style={{ fontStyle: "italic", color: "#888", marginBottom: '5px' }}>
              {m.message}
            </div>
          ) : (
            <div key={m.id || i} style={{ marginBottom: '10px', padding: '5px', borderRadius: '5px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{m.sender}:</strong>
                <small style={{ color: '#666' }}>{formatTime(m.timestamp)}</small>
              </div>
              <div>{m.message}</div>
              {messageStatuses[m.id] && (
                <small style={{ color: '#28a745' }}>✓ {messageStatuses[m.id]}</small>
              )}
            </div>
          )
        )}

        {displayMessages.length === 0 && isSearching && (
          <div style={{ textAlign: 'center', color: '#666' }}>No messages found</div>
        )}
      </div>

      {typingUsers.length > 0 && (
        <p style={{ fontStyle: "italic", color: "#555" }}>
          {typingUsers.join(", ")} typing...
        </p>
      )}

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
        <input
          value={messageInput}
          onChange={handleTyping}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '10px' }}
        />
        <button type="submit" style={{ padding: '10px 20px' }}>Send</button>
      </form>

      <h3>Online Users ({users.length}):</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {users.map((u) => (
          <div key={u.id} style={{ padding: '5px 10px', background: '#e9ecef', borderRadius: '15px' }}>
            {u.username}
          </div>
        ))}
      </div>
    </div>
  );
}
