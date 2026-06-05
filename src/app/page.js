"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import LoginModal from "@/components/LoginModal";
import styles from "./page.module.css";

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mensagem inicial de boas vindas, baseada no login
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user?.name) {
      setMessages([
        {
          role: "ai",
          content: `Olá de novo, ${session.user.name}. Que bom ter você de volta aqui. Respire fundo. Como você está se sentindo hoje?`,
        },
      ]);
    } else {
      setMessages([
        {
          role: "ai",
          content: "Olá. Que bom que você está aqui. Respire fundo e sinta a leveza deste momento. Como você está se sentindo hoje?",
        },
      ]);
    }
  }, [session, status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role === "ai" ? "model" : "user",
            parts: [{ text: m.content }]
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na comunicação");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: data.text },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Sinto muito, parece que houve uma pequena falha na nossa conexão. Podemos tentar novamente?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      <main className={styles.container}>
      {/* Top Navbar */}
      <div className={styles.navBar}>
        {status === "loading" ? null : session ? (
          <div className={styles.userInfo}>
            <span className={styles.userGreeting}>Bem-vindo(a), {session.user.name}</span>
            <button className={styles.navBtn} onClick={() => signOut()}>Sair</button>
          </div>
        ) : (
          <button className={styles.navBtn} onClick={() => setIsLoginModalOpen(true)}>
            Salvar meu progresso / Entrar
          </button>
        )}
      </div>

      <header className={`${styles.header} animate-fade-in`}>
        <Image src="/logo.png" alt="ConfortAI" width={100} height={100} priority className={styles.logo} />
        <h1 className={styles.title}>ConfortAI</h1>
        <p className={styles.motto}>
          "Não podemos voltar e fazer um novo começo, mas podemos recomeçar e fazer um novo fim."
        </p>
      </header>

      <div className={`glass-panel ${styles.chatContainer} animate-fade-in`}>
        <div className={styles.messagesArea}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.message} ${
                msg.role === "user" ? styles.user : styles.ai
              }`}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.typingIndicator} animate-fade-in-up`}>
              Refletindo <span></span><span></span><span></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className={styles.inputArea}>
          <input
            type="text"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Compartilhe seus pensamentos aqui..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className={styles.button}
            disabled={isLoading || !input.trim()}
            aria-label="Enviar"
          >
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className={styles.privacyNotice}>
          Suas conversas são processadas por IA para melhorar seu acolhimento e criar uma experiência mais fraterna.
        </p>
      </div>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </main>
    </>
  );
}
