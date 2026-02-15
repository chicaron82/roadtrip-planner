import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minimize2, Settings, Loader2 } from 'lucide-react';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { getAIConfig, isAIEnabled } from '../../lib/ai-config';
import { sendChatMessage, type ChatMessage, type TripContext } from '../../lib/ai-service';
import { cn } from '../../lib/utils';

interface ChatWidgetProps {
  context?: TripContext;
  onOpenSettings: () => void;
}

export function ChatWidget({ context, onOpenSettings }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your AI trip assistant. Ask me anything about your road trip!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const aiEnabled = isAIEnabled();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const config = getAIConfig();
      if (!config) {
        throw new Error('AI not configured');
      }

      const response = await sendChatMessage(
        config,
        [...messages, userMessage],
        context
      );

      if (response.success) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.message },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `⚠️ Error: ${response.error || 'Failed to get response'}` },
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!aiEnabled) {
    return (
      <button
        onClick={onOpenSettings}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-50"
        title="Enable AI Assistant"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[10px] font-bold animate-pulse">
          !
        </span>
      </button>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-50"
        title="Open AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300",
        isMinimized ? "w-80" : "w-96"
      )}
    >
      <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">AI Trip Assistant</div>
              <div className="text-xs opacity-90">Powered by your API</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="AI Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96 min-h-[300px]">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                    )}
                  >
                    {message.role === 'user' ? (
                      <span className="text-xs font-bold">You</span>
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl p-3 text-sm",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-2xl p-3 text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-muted/30">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground text-center">
                AI responses may not always be accurate. Verify important details.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
