// socket.js - Socket.io client setup

import { io } from "socket.io-client";
import { useEffect, useState, useRef } from "react";

// Socket.io server URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom React hook for using Socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [pendingUsername, setPendingUsername] = useState(null);
  const usernameRef = useRef(null);

  // Registration and login states
  const [registrationError, setRegistrationError] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Private chat states
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateTypingUsers, setPrivateTypingUsers] = useState([]);
  const [privateChatPartner, setPrivateChatPartner] = useState(null);
  const [privateChatError, setPrivateChatError] = useState(null);

  // Register user
  const register = (phone, username) => {
    socket.connect();
    socket.emit('register', { phone, username });
  };

  // Login user
  const login = (phone) => {
    socket.connect();
    socket.emit('login', { phone });
  };

  // Connect and identify user (after authentication)
  const connect = (username) => {
    if (username) {
      setCurrentUsername(username);
      usernameRef.current = username;
      socket.emit("user_join", { username });
      setIsAuthenticated(true);
    }
  };

  // Disconnect
  const disconnect = () => socket.disconnect();

  // Send public message
  const sendMessage = (message) => {
    socket.emit("send_message", { message, sender: usernameRef.current || currentUsername });
  };

  // Set typing state
  const setTyping = (isTyping) => {
    socket.emit("typing", { isTyping, username: usernameRef.current || currentUsername });
  };

  // Join private chat
  const joinPrivateChat = (partnerPhone, username) => {
    console.log('joinPrivateChat called with', { partnerPhone, username });
    socket.emit('join_private_chat', { partnerPhone, username });
    setPrivateChatPartner(null); // Reset partner until server confirms
  };

  // Send private message
  const sendPrivateMessage = (message) => {
    socket.emit("send_private_message", { message, sender: usernameRef.current || currentUsername });
  };

  // Listen for socket events
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
    };
    const onDisconnect = () => setIsConnected(false);

    const onReceiveMessage = (msg) =>
      setMessages((prev) => [...prev, msg]);

    const onUserList = (list) => setUsers(list);

    const onUserJoined = (user) =>
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), system: true, message: `${user.username} joined the chat` },
      ]);

    const onUserLeft = (user) =>
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), system: true, message: `${user.username} left the chat` },
      ]);

    const onTypingUsers = (list) => setTypingUsers(list);

    // Registration and login events
    const onRegistrationSuccess = (data) => {
      setRegistrationError(null);
      setCurrentUsername(data.username);
      setIsAuthenticated(true);
    };

    const onRegistrationError = (error) => {
      setRegistrationError(error);
      socket.disconnect();
    };

    const onLoginSuccess = (data) => {
      setLoginError(null);
      setCurrentUsername(data.username);
      setIsAuthenticated(true);
    };

    const onLoginError = (error) => {
      setLoginError(error);
      socket.disconnect();
    };

    // Private chat events
    const onPrivateChatJoined = (data) => {
      setPrivateChatPartner(data.partnerUsername);
      setPrivateMessages([]);
      setPrivateChatError(null);
      // Emit a custom event to notify the component
      socket.emit('private_chat_ready');
    };

    const onPrivateMessage = (msg) => {
      setPrivateMessages((prev) => [...prev, msg]);
    };

    const onPrivateTypingUsers = (list) => setPrivateTypingUsers(list);

    const onPrivateChatError = (error) => {
      setPrivateChatError(error);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("user_list", onUserList);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("typing_users", onTypingUsers);
    socket.on("registration_success", onRegistrationSuccess);
    socket.on("registration_error", onRegistrationError);
    socket.on("login_success", onLoginSuccess);
    socket.on("login_error", onLoginError);
    socket.on("private_chat_ready", () => {
      // This is handled in the component
    });
    socket.on("private_chat_joined", onPrivateChatJoined);
    socket.on("private_message", onPrivateMessage);
    socket.on("private_typing_users", onPrivateTypingUsers);
    socket.on("private_chat_error", onPrivateChatError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("user_list", onUserList);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("typing_users", onTypingUsers);
      socket.off("registration_success", onRegistrationSuccess);
      socket.off("registration_error", onRegistrationError);
      socket.off("login_success", onLoginSuccess);
      socket.off("login_error", onLoginError);
      socket.off("private_chat_joined", onPrivateChatJoined);
      socket.off("private_message", onPrivateMessage);
      socket.off("private_typing_users", onPrivateTypingUsers);
      socket.off("private_chat_error", onPrivateChatError);
    };
  }, []);

  return {
    socket,
    isConnected,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    setTyping,
    currentUsername,
    register,
    login,
    registrationError,
    loginError,
    isAuthenticated,
    joinPrivateChat,
    sendPrivateMessage,
    privateMessages,
    privateTypingUsers,
    privateChatPartner,
    privateChatError,
  };
};

export default socket;
