// socket.js - Socket.io client setup

import { io } from "socket.io-client";
import { useEffect, useState } from "react";

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

  // Connect and identify user with JWT auth
  const connect = (username, token = null) => {
    socket.connect();
    if (username) socket.emit("user_join", { username, token });
  };

  // Disconnect
  const disconnect = () => socket.disconnect();

  // Send public message
  const sendMessage = (message) => {
    socket.emit("send_message", { message });
  };

  // Set typing state
  const setTyping = (isTyping) => {
    socket.emit("typing", isTyping);
  };

  // Listen for socket events
  useEffect(() => {
    const onConnect = () => setIsConnected(true);
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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("receive_message", onReceiveMessage);
    socket.on("user_list", onUserList);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("typing_users", onTypingUsers);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("receive_message", onReceiveMessage);
      socket.off("user_list", onUserList);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("typing_users", onTypingUsers);
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
  };
};

export default socket;
