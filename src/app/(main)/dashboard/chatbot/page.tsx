"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth } from "@/lib/api"; // Import the centralized API helper

interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  data?: any;
}

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

interface QueryResult {
  type: "customers" | "employees" | "quotes" | "jobs" | "general";
  data: any[];
  summary: string;
}

export default function BusinessAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("chatHistory");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        const historyWithDates = parsed.map((chat: any) => ({
          ...chat,
          lastUpdated: new Date(chat.lastUpdated),
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
        setChatHistory(historyWithDates);
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const parseQuery = (query: string): { intent: string; entities: string[] } => {
    const lowerQuery = query.toLowerCase();

    let intent = "general";
    if (lowerQuery.includes("customer") || lowerQuery.includes("client")) {
      intent = "customers";
    } else if (lowerQuery.includes("employee") || lowerQuery.includes("staff") || lowerQuery.includes("team")) {
      intent = "employees";
    } else if (lowerQuery.includes("quote") || lowerQuery.includes("quotation")) {
      intent = "quotes";
    } else if (lowerQuery.includes("job") || lowerQuery.includes("project")) {
      intent = "jobs";
    }

    const entities: string[] = [];
    const stageKeywords = ["lead", "quote", "survey", "measure", "design", "production", "installation", "complete"];
    stageKeywords.forEach((stage) => {
      if (lowerQuery.includes(stage)) {
        entities.push(stage);
      }
    });

    if (lowerQuery.includes("free") || lowerQuery.includes("available")) {
      entities.push("available");
    }
    if (lowerQuery.includes("busy") || lowerQuery.includes("occupied")) {
      entities.push("busy");
    }
    if (lowerQuery.includes("need")) {
      entities.push("need");
    }

    return { intent, entities };
  };

  const fetchData = async (intent: string, entities: string[]): Promise<QueryResult> => {
    try {
      let apiPath = "";
      let queryParams = new URLSearchParams();

      switch (intent) {
        case "customers":
          apiPath = "customers";
          if (entities.includes("need") && entities.some((e) => ["quote", "quotation"].includes(e))) {
            queryParams.append("stage", "Quote");
          } else if (
            entities.find((e) =>
              ["lead", "survey", "measure", "design", "production", "installation", "complete"].includes(e),
            )
          ) {
            const stage = entities.find((e) =>
              ["lead", "survey", "measure", "design", "production", "installation", "complete"].includes(e),
            );
            queryParams.append("stage", stage!.charAt(0).toUpperCase() + stage!.slice(1));
          }
          break;

        case "jobs":
          apiPath = "jobs";
          break;

        case "employees":
          return {
            type: "employees",
            data: [
              { id: 1, name: "John Smith", role: "Installer", status: "Available", current_job: null },
              {
                id: 2,
                name: "Sarah Johnson",
                role: "Designer",
                status: "Busy",
                current_job: "Kitchen Design - JOB001",
              },
              { id: 3, name: "Mike Wilson", role: "Sales", status: "Available", current_job: null },
              { id: 4, name: "Emma Davis", role: "Installer", status: "Available", current_job: null },
              {
                id: 5,
                name: "Chris Brown",
                role: "Project Manager",
                status: "Busy",
                current_job: "Bedroom Install - JOB003",
              },
            ].filter((emp) => {
              if (entities.includes("available")) return emp.status === "Available";
              if (entities.includes("busy")) return emp.status === "Busy";
              return true;
            }),
            summary: entities.includes("available")
              ? "Here are your available employees"
              : entities.includes("busy")
                ? "Here are your busy employees"
                : "Here are all your employees",
          };

        default:
          apiPath = "customers";
      }

      const fullPath = queryParams.toString() ? `${apiPath}?${queryParams}` : apiPath;

      // Use centralized fetchWithAuth
      const response = await fetchWithAuth(fullPath);

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await response.json();

      return {
        type: intent as any,
        data: data || [],
        summary: generateSummary(intent, entities, data?.length || 0),
      };
    } catch (error) {
      console.error("API Error:", error);
      return {
        type: "general",
        data: [],
        summary: "I'm having trouble accessing the data right now. Please try again.",
      };
    }
  };

  const generateSummary = (intent: string, entities: string[], count: number): string => {
    switch (intent) {
      case "customers":
        if (entities.includes("need") && entities.some((e) => ["quote", "quotation"].includes(e))) {
          return `I found ${count} customers who need quotes`;
        }
        if (entities.find((e) => ["survey", "measure", "design"].includes(e))) {
          const stage = entities.find((e) => ["survey", "measure", "design"].includes(e));
          return `I found ${count} customers in ${stage!.charAt(0).toUpperCase() + stage!.slice(1)} stage`;
        }
        return `I found ${count} customers`;

      case "jobs":
        return `I found ${count} jobs`;

      default:
        return `I found ${count} results`;
    }
  };

  const formatResponse = (result: QueryResult): string => {
    if (result.data.length === 0) {
      return result.summary + ", but there are currently no results matching your criteria.";
    }

    let response = result.summary + ":\n\n";

    result.data.slice(0, 8).forEach((item, index) => {
      switch (result.type) {
        case "customers":
          response += `**${item.name}**\n`;
          response += `• Stage: ${item.stage || "Unknown"}\n`;
          response += `• Phone: ${item.phone || "Not provided"}\n`;
          response += `• Address: ${item.address || "Not provided"}\n`;
          if (item.salesperson) response += `• Salesperson: ${item.salesperson}\n`;
          response += "\n";
          break;

        case "employees":
          response += `**${item.name}** - ${item.role}\n`;
          response += `• Status: ${item.status}\n`;
          if (item.current_job) response += `• Current Job: ${item.current_job}\n`;
          response += "\n";
          break;

        case "jobs":
          response += `**Job #${item.job_reference || item.id}**\n`;
          response += `• Customer: ${item.customer_name || "Unknown"}\n`;
          response += `• Type: ${item.job_type || "Unknown"}\n`;
          response += `• Stage: ${item.stage || "Unknown"}\n`;
          if (item.quote_price) response += `• Quote: £${item.quote_price.toLocaleString()}\n`;
          response += "\n";
          break;
      }
    });

    if (result.data.length > 8) {
      response += `...and ${result.data.length - 8} more results. Would you like me to show more details or filter the results further?`;
    }

    return response;
  };

  const saveCurrentChat = () => {
    if (messages.length === 0) return;

    const chatTitle = messages[0]?.content.substring(0, 50) + (messages[0]?.content.length > 50 ? "..." : "");

    if (currentChatId) {
      // Update existing chat
      setChatHistory((prev) =>
        prev.map((chat) => (chat.id === currentChatId ? { ...chat, messages, lastUpdated: new Date() } : chat)),
      );
    } else {
      // Create new chat
      const newChatId = Date.now().toString();
      const newChat: ChatHistory = {
        id: newChatId,
        title: chatTitle,
        messages,
        lastUpdated: new Date(),
      };
      setChatHistory((prev) => [newChat, ...prev.slice(0, 9)]); // Keep only 10 chats
      setCurrentChatId(newChatId);
    }
  };

  const typeText = async (text: string, callback: (fullText: string) => void) => {
    setIsTyping(true);
    setTypingText("");

    const words = text.split(" ");
    let currentText = "";

    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? " " : "") + words[i];
      setTypingText(currentText);

      // Variable typing speed - faster for short words, slower for longer ones
      const delay = words[i].length > 6 ? 80 : words[i].length > 3 ? 60 : 40;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    setIsTyping(false);
    setTypingText("");
    callback(text);
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading || isThinking || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");

    // Start thinking phase
    setIsThinking(true);

    // Simulate thinking time (1-3 seconds)
    const thinkingTime = Math.random() * 2000 + 1000;
    await new Promise((resolve) => setTimeout(resolve, thinkingTime));

    setIsThinking(false);

    try {
      const { intent, entities } = parseQuery(userMessage.content);
      const result = await fetchData(intent, entities);
      const response = formatResponse(result);

      // Start typing effect
      await typeText(response, (fullText) => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: fullText,
          timestamp: new Date(),
          data: result.data,
        };

        setMessages((prev) => [...prev, botMessage]);

        // Save to history after bot responds
        setTimeout(() => saveCurrentChat(), 100);
      });
    } catch (error) {
      const errorText = "I encountered an error while processing your request. Please try again.";

      await typeText(errorText, (fullText) => {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: fullText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const newChat = () => {
    if (messages.length > 0) {
      saveCurrentChat();
    }
    setMessages([]);
    setInputValue("");
    setCurrentChatId(null);
  };

  const loadChat = (chatId: string) => {
    if (messages.length > 0 && currentChatId !== chatId) {
      saveCurrentChat();
    }

    const chat = chatHistory.find((c) => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentChatId(chatId);
    }
  };

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory((prev) => prev.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const clearAllHistory = () => {
    setChatHistory([]);
    localStorage.removeItem("chatHistory");
    setMessages([]);
    setCurrentChatId(null);
  };

  const suggestedQuestions = [
    "Which customers need quotes?",
    "Show me available employees",
    "What jobs are in production?",
    "Find customers in survey stage",
    "Who's working on installations?",
    "Show me completed projects",
  ];

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">AzTech Bot</h1>
            <p className="mt-1 text-gray-600">Ask me anything about your business data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={newChat} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Chat Area - Takes up 3/4 of the width */}
        <div className="lg:col-span-3">
          <Card className="flex h-[calc(100vh-200px)] flex-col">
            {/* Messages Area */}
            <CardContent className="flex-1 overflow-hidden p-0">
              <div ref={scrollAreaRef} className="h-full overflow-y-auto p-6">
                {messages.length === 0 ? (
                  /* Welcome Screen */
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                      <Bot className="h-8 w-8 text-blue-600" />
                    </div>
                    <h2 className="mb-4 text-2xl font-bold text-gray-800">How can I help you today?</h2>
                    <p className="mb-8 max-w-md text-gray-600">
                      I can help you find information about customers, employees, jobs, and more from your business
                      database.
                    </p>

                    {/* Suggested Questions */}
                    <div className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
                      {suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => setInputValue(question)}
                          className="rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                        >
                          <p className="text-sm text-gray-700">{question}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Chat Messages */
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div key={message.id} className="group">
                        <div className={`flex gap-4 ${message.type === "user" ? "justify-end" : ""}`}>
                          {message.type === "bot" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                              <Bot className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                          <div className={`flex-1 ${message.type === "user" ? "max-w-2xl" : ""}`}>
                            <div
                              className={`rounded-lg p-4 ${
                                message.type === "user" ? "ml-auto bg-blue-600 text-white" : "bg-gray-50 text-gray-900"
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                            </div>
                            <div className="mt-1 px-4 text-xs text-gray-500">
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                          {message.type === "user" && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {(isThinking || isTyping) && (
                      <div className="group">
                        <div className="flex gap-4">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                            <Bot className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="rounded-lg bg-gray-50 p-4">
                              {isThinking ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex space-x-1">
                                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                                    <div
                                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                                      style={{ animationDelay: "0.1s" }}
                                    ></div>
                                    <div
                                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                                      style={{ animationDelay: "0.2s" }}
                                    ></div>
                                  </div>
                                  <span className="ml-2 text-sm text-gray-600">Thinking...</span>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-900">
                                  <span className="whitespace-pre-wrap">{typingText}</span>
                                  <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-gray-400"></span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me about customers, employees, jobs, quotes..."
                  disabled={isThinking || isTyping}
                  className="flex-1"
                />
                <Button onClick={handleSubmit} disabled={isThinking || isTyping || !inputValue.trim()} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </Card>
        </div>

        {/* Sidebar - Chat History */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5" />
                  Chat History
                </CardTitle>
                {chatHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllHistory}
                    className="p-1 text-gray-500 hover:text-red-600"
                    title="Clear all chat history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {chatHistory.length > 0 ? (
                <div className="space-y-2">
                  {chatHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className={`group cursor-pointer rounded-lg border p-3 transition-colors hover:bg-gray-50 ${
                        currentChatId === chat.id ? "border-blue-200 bg-blue-50" : "border-gray-200"
                      }`}
                      onClick={() => loadChat(chat.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{chat.title}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {chat.lastUpdated.toLocaleDateString()}{" "}
                            {chat.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => deleteChat(chat.id, e)}
                          className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-gray-500">
                  No chat history yet. Start a conversation to see your chats here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
