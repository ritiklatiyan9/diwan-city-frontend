import React, { useState, useEffect, useRef } from 'react';
import api from '../../src/api/api.js';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { Search, Send, Paperclip, MoreVertical, X, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';

// Create socket instance outside component to prevent multiple connections on re-renders,
// but we'll manage the connection inside useEffect based on auth token
let socket;

export default function Chat() {
    const { user, token } = useAuth();
    const [users, setUsers] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const lastActiveConvRef = useRef(null);

    const { id: urlConvId } = useParams();
    const navigate = useNavigate();

    const activeConversationRef = useRef(activeConversation);
    const userRef = useRef(user);

    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Initialize Socket.io
    useEffect(() => {
        if (token) {
            socket = io(import.meta.env.VITE_API_URL || 'http://localhost:80000', {
                auth: { token },
            });

            // Handle incoming messages
            socket.on('new_message', (message) => {
                const currentActiveConv = activeConversationRef.current;
                const currentUser = userRef.current;

                setMessages((prev) => {
                    // Check if message belongs to active conversation
                    if (currentActiveConv && message.conversation_id === currentActiveConv.id) {
                        // Prevent duplicates
                        if (prev.some(m => m.id === message.id)) return prev;
                        return [...prev, message];
                    }
                    return prev;
                });

                // Update conversation list with new last message
                setConversations((prev) =>
                    prev.map((c) => {
                        if (c.conversation_id === message.conversation_id) {
                            return {
                                ...c,
                                last_message: message.message_text,
                                last_message_time: message.created_at,
                                // Increment unread count if we are not the sender and the conversation is not active
                                unread_count:
                                    (message.sender_id !== currentUser?.id && (!currentActiveConv || currentActiveConv.id !== message.conversation_id))
                                        ? Number(c.unread_count || 0) + 1
                                        : c.unread_count
                            };
                        }
                        return c;
                    }).sort((a, b) => new Date(b.last_message_time || b.conversation_created_at) - new Date(a.last_message_time || a.conversation_created_at))
                );
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [token]);

    // Join conversation when active changes
    useEffect(() => {
        if (socket && activeConversation) {
            socket.emit('join_conversation', activeConversation.id);

            return () => {
                socket.emit('leave_conversation', activeConversation.id);
            };
        }
    }, [activeConversation]);

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersRes, convsRes] = await Promise.all([
                    api.get('/chat/users'),
                    api.get('/chat/conversations')
                ]);
                setUsers(usersRes.data.users);
                setConversations(convsRes.data.conversations);
            } catch (error) {
                console.error('Error fetching chat data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Fetch messages when conversation selected
    useEffect(() => {
        if (activeConversation) {
            const fetchMessages = async () => {
                try {
                    const res = await api.get(`/chat/messages/${activeConversation.id}`);
                    setMessages(res.data.messages);

                    // Clear unread count locally
                    setConversations(prev => {
                        const hasUnread = prev.some(c => c.conversation_id === activeConversation.id && c.unread_count > 0);
                        if (!hasUnread) return prev;
                        return prev.map(c =>
                            c.conversation_id === activeConversation.id
                                ? { ...c, unread_count: 0 }
                                : c
                        );
                    });
                } catch (error) {
                    console.error('Error fetching messages', error);
                }
            };
            fetchMessages();
        }
    }, [activeConversation]);

    // Sync active conversation with URL
    useEffect(() => {
        if (urlConvId) {
            const parsedId = parseInt(urlConvId);
            if (!activeConversation || activeConversation.id !== parsedId) {
                if (conversations.length > 0) {
                    const conv = conversations.find(c => c.conversation_id === parsedId);
                    if (conv) {
                        setActiveConversation({
                            id: conv.conversation_id,
                            user_name: conv.user_name,
                            user_photo: conv.user_photo,
                            user_id: conv.user_id
                        });
                    }
                }
            }
        } else if (!urlConvId && activeConversation) {
            setActiveConversation(null);
        }
    }, [urlConvId, conversations, activeConversation]);

    // Scroll to latest message
    const scrollToBottom = (smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    };

    useEffect(() => {
        if (!activeConversation) return;

        const isNewConv = lastActiveConvRef.current !== activeConversation.id;
        if (isNewConv) {
            lastActiveConvRef.current = activeConversation.id;
            setTimeout(() => scrollToBottom(false), 50); // instant jump on initial load
            return;
        }

        if (messagesContainerRef.current) {
            const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 350;
            if (isNearBottom) {
                setTimeout(() => scrollToBottom(true), 50);
            }
        }
    }, [messages, activeConversation]);

    // Handle starting a chat from the user list
    const startChat = async (selectedUserId) => {
        try {
            const res = await api.get(`/chat/conversations/${selectedUserId}`);
            const conv = res.data.conversation;

            // Find the user details
            const otherUser = users.find(u => u.id === selectedUserId);

            const newActiveConv = {
                id: conv.id,
                user_name: otherUser.name,
                user_photo: otherUser.photo,
                user_id: otherUser.id
            };

            setActiveConversation(newActiveConv);

            // Add to conversations list if not present
            setConversations(prev => {
                if (!prev.find(c => c.conversation_id === conv.id)) {
                    return [{
                        conversation_id: conv.id,
                        user_id: otherUser.id,
                        user_name: otherUser.name,
                        user_photo: otherUser.photo,
                        last_message: '',
                        last_message_time: new Date().toISOString(),
                        unread_count: 0
                    }, ...prev];
                }
                return prev;
            });

            navigate(`/chat/${conv.id}`);
        } catch (error) {
            console.error('Error starting chat', error);
        }
    };

    // Select an existing conversation
    const selectConversation = (conv) => {
        navigate(`/chat/${conv.conversation_id}`);
    };

    // Send a message
    const sendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() && !attachment) return;

        try {
            const res = await api.post('/chat/messages', {
                conversationId: activeConversation.id,
                text: messageInput,
                attachmentUrl: attachment?.url || null
            });

            // Immediately append to our local chat window
            const newMessage = res.data.message;
            if (newMessage) {
                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });

                // Also update the recent conversation list immediately
                setConversations(prev =>
                    prev.map((c) => {
                        if (c.conversation_id === newMessage.conversation_id) {
                            return {
                                ...c,
                                last_message: newMessage.message_text,
                                last_message_time: newMessage.created_at
                            };
                        }
                        return c;
                    }).sort((a, b) => new Date(b.last_message_time || b.conversation_created_at) - new Date(a.last_message_time || a.conversation_created_at))
                );
            }

            setMessageInput('');
            setAttachment(null);
            setTimeout(() => scrollToBottom(true), 50);
        } catch (error) {
            console.error('Error sending message', error);
        }
    };

    const fileInputRef = useRef(null);
    const [attachment, setAttachment] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/upload/single?provider=cloudinary', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAttachment({ url: res.data.fileUrl || res.data.url, name: file.name });
        } catch (error) {
            console.error('Error uploading file', error);
            alert('Failed to upload file');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (loading) return <div className="p-8 flex justify-center text-gray-500">Loading chat...</div>;

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Left Sidebar */}
            <div className={`w-full md:w-1/3 md:min-w-[300px] border-r border-gray-100 flex-col bg-gray-50/50 ${activeConversation ? 'hidden' : 'flex'}`}>
                <div className="p-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3">Messages</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {searchQuery ? (
                        <div className="p-2">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Users</h3>
                            {filteredUsers.map(u => (
                                <div
                                    key={u.id}
                                    onClick={() => startChat(u.id)}
                                    className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold relative overflow-hidden">
                                        {u.photo ? <img src={u.photo} alt={u.name} className="object-cover w-full h-full" /> : u.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-800">{u.name}</h4>
                                        <p className="text-xs text-gray-500">{u.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-2">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Recent Convs</h3>
                            {conversations.map(conv => (
                                <div
                                    key={conv.conversation_id}
                                    onClick={() => selectConversation(conv)}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${activeConversation?.id === conv.conversation_id ? 'bg-indigo-50' : 'hover:bg-white'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold relative overflow-hidden">
                                        {conv.user_photo ? <img src={conv.user_photo} alt={conv.user_name} className="object-cover w-full h-full" /> : conv.user_name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <h4 className="text-sm font-medium text-gray-800 truncate">{conv.user_name}</h4>
                                            {conv.last_message_time && (
                                                <span className="text-[10px] text-gray-400">
                                                    {format(new Date(conv.last_message_time), 'PPp')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{conv.last_message}</p>
                                    </div>
                                    {conv.unread_count > 0 && (
                                        <div className="w-5 h-5 bg-indigo-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                                            {conv.unread_count}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {conversations.length === 0 && (
                                <p className="text-sm text-center text-gray-400 mt-4">No recent conversations. Search a user to start.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Chat Window */}
            <div className={`flex-1 flex-col bg-white overflow-hidden relative ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
                {activeConversation ? (
                    <>
                        {/* Chat header */}
                        <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between bg-white z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate('/chat')} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold overflow-hidden border border-indigo-200">
                                    {activeConversation.user_photo ? <img src={activeConversation.user_photo} alt="" className="object-cover w-full h-full" /> : activeConversation.user_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">{activeConversation.user_name}</h3>
                                </div>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30" ref={messagesContainerRef}>
                            <div className="space-y-6">
                                {messages.map((msg, i) => {
                                    const isMe = msg.sender_id === user.id;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!isMe && (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs mr-2 flex-shrink-0 mt-auto shadow-sm">
                                                    {msg.sender_photo ? <img src={msg.sender_photo} alt="" className="object-cover w-full h-full rounded-full" /> : msg.sender_name?.charAt(0)}
                                                </div>
                                            )}

                                            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div
                                                    className={`px-4 py-2.5 rounded-2xl shadow-sm ${isMe
                                                        ? 'bg-indigo-600 text-white rounded-br-sm'
                                                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                                                        }`}
                                                >
                                                    {msg.message_text && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message_text}</p>}
                                                    {msg.attachment_url && (
                                                        <div className="mt-2 text-xs opacity-80 underline hover:opacity-100">
                                                            {msg.attachment_url.match(/\.(jpeg|jpg|gif|png)$/) ? (
                                                                <img src={msg.attachment_url} alt="attachment" className="mt-2 rounded-lg max-w-full h-auto max-h-60 object-contain block border border-white/20" />
                                                            ) : (
                                                                <div className="flex items-center gap-1 mt-1 p-2 bg-black/10 rounded-md">
                                                                    <Paperclip className="w-3 h-3" />
                                                                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="truncate">View Document</a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] text-gray-400 mt-1.5 px-1 block ${isMe ? 'text-right' : 'text-left'}`}>
                                                    {format(new Date(msg.created_at), 'p')} • {isMe ? (msg.is_read ? 'Read' : 'Delivered') : ''}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-gray-100 flex flex-col relative">
                            {attachment && (
                                <div className="mb-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 truncate text-indigo-700">
                                        <Paperclip className="w-4 h-4 shrink-0" />
                                        <span className="truncate">{attachment.name}</span>
                                    </div>
                                    <button onClick={() => setAttachment(null)} className="text-indigo-400 hover:text-indigo-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <form onSubmit={sendMessage} className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-2.5 rounded-xl transition-colors ${uploading ? 'text-indigo-300 animate-pulse' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    disabled={uploading}
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-1 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm transition-all outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={(!messageInput.trim() && !attachment) || uploading}
                                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform active:scale-95"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                            <div className="text-3xl">💬</div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">Internal Chat</h3>
                        <p className="text-gray-500 max-w-sm">Select a colleague from the sidebar or search for a user to start a conversation.</p>
                    </div>
                )}
            </div>

        </div>
    );
}
