// ── Chat room management ────────────────────────────────────────────────
// Join a support chat session room
socket.on('chat:join', ({ sessionId }) => {
    if (sessionId) {
        socket.join(`chat:${sessionId}`);
    }
});

// Leave a chat room
socket.on('chat:leave', ({ sessionId }) => {
    if (sessionId) {
        socket.leave(`chat:${sessionId}`);
    }
});

// Join department channel (staff only)
socket.on('chat:joinDept', ({ department }) => {
    if (department && user?.role !== 'CUSTOMER') {
        socket.join(`dept:${department}`);
    }
});

// Typing indicator
socket.on('chat:typing', ({ sessionId, isTyping }) => {
    if (sessionId) {
        socket.to(`chat:${sessionId}`).emit('chat:typing', {
            sessionId,
            userId: user?._id,
            userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            isTyping,
        });
    }
});