import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PageContext {
  route: string;
  title: string;
  extra?: Record<string, unknown>;
}

interface ChatContextValue {
  pageContext: PageContext;
  setPageContext: (ctx: Partial<PageContext>) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const defaultContext: PageContext = {
  route: "/",
  title: "Foyer Dashboard",
};

const ChatContext = createContext<ChatContextValue>({
  pageContext: defaultContext,
  setPageContext: () => {},
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextState] = useState<PageContext>(defaultContext);
  const [isOpen, setIsOpen] = useState(false);

  const setPageContext = useCallback((ctx: Partial<PageContext>) => {
    setPageContextState((prev) => ({ ...prev, ...ctx }));
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ChatContext value={{ pageContext, setPageContext, isOpen, open, close }}>
      {children}
    </ChatContext>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
