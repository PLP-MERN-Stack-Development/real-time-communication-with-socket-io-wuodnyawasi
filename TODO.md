# TODO: Implement Advanced Chat Features

## 1. User Authentication (JWT)
- [x] Install jsonwebtoken on server
- [x] Server: Add JWT generation on user_join, require token for socket auth
- [x] Client: Store JWT in localStorage, send in socket auth
- [x] Update App.jsx to use JWT auth and integrate with ChatPage

## 2. Message Pagination
- [x] Server: Add /api/messages?page=1&limit=20 endpoint
- [x] Client: Add "Load Older Messages" button in ChatPage
- [x] Client: Fetch and prepend older messages

## 3. Reconnection Logic
- [x] Server: Already has basic reconnection, enhance with custom events
- [x] Client: Listen for connect/disconnect, show status
- [x] Client: Auto-rejoin on reconnect

## 4. Message Delivery Acknowledgment
- [x] Server: Emit 'message_ack' after storing message
- [x] Client: Show delivery status on messages

## 5. Message Search
- [x] Server: Add /api/messages/search?q=query endpoint
- [x] Client: Add search input in ChatPage
- [x] Client: Fetch and display filtered results

## Testing
- [ ] Test auth flow
- [ ] Test pagination
- [ ] Test search
- [ ] Test reconnection
- [ ] Ensure responsive design
