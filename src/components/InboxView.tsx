import React, { useState, useEffect, useRef } from 'react';
import { EventItem, Message, User } from '../types';
import { fetchMessages, createMessage } from '../services/api';
import { Send, Users, Shield, MessageSquare, Hash, Radio, Sparkles, Search, CheckCircle, Lock, AtSign, Smile } from 'lucide-react';

interface InboxViewProps {
  currentEvent: EventItem | null;
  currentUser: User;
}

export const InboxView: React.FC<InboxViewProps> = ({ currentEvent, currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientType, setRecipientType] = useState<'all' | 'team' | 'support'>('all');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentEvent) {
      loadMessages();
      const interval = setInterval(loadMessages, 4000);
      return () => clearInterval(interval);
    }
  }, [currentEvent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recipientType]);

  const loadMessages = async () => {
    if (!currentEvent) return;
    try {
      const data = await fetchMessages(currentEvent.id);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !content.trim()) return;

    const text = content.trim();
    setContent('');

    try {
      await createMessage(currentEvent.id, {
        senderId: currentUser.id,
        senderName: currentUser.name,
        recipientType,
        recipientId: recipientType === 'team' ? 'team-alpha' : undefined,
        content: text
      });
      loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (recipientType === 'all') return m.recipientType === 'all' || !m.recipientType;
    if (recipientType === 'team') return m.recipientType === 'team';
    if (recipientType === 'support') return m.recipientType === 'support';
    return true;
  });

  const getChannelInfo = () => {
    switch (recipientType) {
      case 'team':
        return {
          title: 'team-alpha',
          description: 'Private encrypted team channel for Alpha Geofence Innovators',
          count: '4 members'
        };
      case 'support':
        return {
          title: 'staff-helpdesk',
          description: 'Direct inquiry channel with event staff and Dr. Priya Nair',
          count: 'Staff & Organizers'
        };
      default:
        return {
          title: 'general-broadcast',
          description: 'Venue-wide stream for all verified participants in IIT Delhi Zone',
          count: '248 attendees'
        };
    }
  };

  const info = getChannelInfo();

  const quickReplies = [
    "At Table 4 in Hall A",
    "Does anyone have a spare USB-C cable?",
    "Need feedback on our architecture diagram",
    "Heading to the hardware desk"
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-5.5rem)] flex flex-col space-y-3">
      {/* Main Dual-Pane Chat Card */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-xs flex overflow-hidden">
        {/* Left Sidebar: Channels & Teams */}
        <div className="w-64 sm:w-72 border-r border-slate-200/80 bg-slate-50/70 flex flex-col shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900 tracking-tight">Channels & Chat</div>
              <div className="text-[11px] text-slate-500">{currentEvent?.name || 'SAMARTHA 2026'}</div>
            </div>
            <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold px-2 py-0.5 rounded-md">
              In-Zone
            </div>
          </div>

          {/* Channel Navigation */}
          <div className="p-2 space-y-4 overflow-y-auto flex-1">
            {/* Public Channels Group */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Public Channels
              </div>
              <button
                type="button"
                onClick={() => setRecipientType('all')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  recipientType === 'all'
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Hash className={`w-4 h-4 shrink-0 ${recipientType === 'all' ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="text-xs truncate">general-broadcast</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  recipientType === 'all' ? 'bg-slate-800 text-slate-300' : 'text-slate-400'
                }`}>
                  Public
                </span>
              </button>
            </div>

            {/* Team Channels Group */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Private Team Channels
              </div>
              <button
                type="button"
                onClick={() => setRecipientType('team')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  recipientType === 'team'
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Lock className={`w-4 h-4 shrink-0 ${recipientType === 'team' ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="text-xs truncate">team-alpha</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  recipientType === 'team' ? 'bg-slate-800 text-slate-300' : 'text-slate-400'
                }`}>
                  Team
                </span>
              </button>
            </div>

            {/* Support Desk Group */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Support & Helpdesk
              </div>
              <button
                type="button"
                onClick={() => setRecipientType('support')}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all cursor-pointer ${
                  recipientType === 'support'
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Shield className={`w-4 h-4 shrink-0 ${recipientType === 'support' ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="text-xs truncate">staff-helpdesk</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  recipientType === 'support' ? 'bg-slate-800 text-slate-300' : 'text-slate-400'
                }`}>
                  Desk
                </span>
              </button>
            </div>

            {/* Team Roster Widget */}
            <div className="pt-3 border-t border-slate-200">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Alpha Team Members
              </div>
              <div className="space-y-1.5 px-2">
                {[
                  { name: 'Aarav Sharma', role: 'You (Hardware / ML)' },
                  { name: 'Rohan Verma', role: 'Backend Lead' },
                  { name: 'Neha Gupta', role: 'UI / UX' },
                  { name: 'Karan Singh', role: 'IoT Firmware' }
                ].map((member, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium text-slate-800 truncate">{member.name}</span>
                    <span className="text-[10px] text-slate-400">{member.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Footer */}
          <div className="p-3 border-t border-slate-200/80 bg-white text-[11px] text-slate-500 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Zero raw GPS logged to database</span>
          </div>
        </div>

        {/* Right Pane: Chat Window & Composer */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Channel Header Bar */}
          <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white shrink-0">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span className="text-slate-400">#</span>
                  <span>{info.title}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500 font-medium">{info.count}</span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">{info.description}</p>
            </div>

            <div className="text-[11px] text-slate-400 hidden sm:block">
              Auto-purges in 24h
            </div>
          </div>

          {/* Messages Stream Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
            {filteredMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-12">
                <MessageSquare className="w-8 h-8 text-slate-300" />
                <div className="text-xs font-bold text-slate-700">No messages in #{info.title} yet</div>
                <p className="text-xs text-slate-400 text-center max-w-sm">
                  Start the conversation with your team or broadcast an update to the venue.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe = msg.senderId === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <img
                      src={`https://images.unsplash.com/photo-${1534528741775 + msg.senderName.length}?w=100`}
                      alt={msg.senderName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
                    />

                    <div className={`space-y-1 max-w-lg ${isMe ? 'items-end text-right' : ''}`}>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-slate-800">{msg.senderName}</span>
                        <span className="text-slate-400 tabular-nums">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-xl text-xs leading-relaxed text-left whitespace-pre-wrap ${
                          isMe
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200/90 text-slate-800 shadow-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Pills */}
          <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[11px] text-slate-400 font-medium shrink-0">Quick reply:</span>
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setContent(reply)}
                className="text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Message Input Composer */}
          <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-slate-200/80 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Message #${info.title}... (Press Enter to send)`}
                className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!content.trim()}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
