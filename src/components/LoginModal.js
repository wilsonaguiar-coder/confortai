"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isLogin) {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        onClose();
      }
    } else {
      // Registrar
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Se registrou com sucesso, faz o login automaticamente
        await signIn("credentials", { redirect: false, email, password });
        onClose();
      } catch (err) {
        setError(err.message || "Erro ao registrar.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel modal-content animate-fade-in">
        <h2>{isLogin ? "Bem-vindo de volta" : "Criar sua conta"}</h2>
        <p className="subtitle">
          {isLogin 
            ? "Acesse seu espaço para continuar de onde parou." 
            : "Crie uma conta para que possamos lembrar da sua história."}
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Como prefere ser chamado?" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          )}
          <input 
            type="email" 
            placeholder="Seu email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="Sua senha" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button type="submit" disabled={loading}>
            {loading ? "Aguarde..." : (isLogin ? "Entrar" : "Criar Conta")}
          </button>
        </form>

        <button className="switch-btn" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Ainda não tem conta? Crie aqui." : "Já tem conta? Entre aqui."}
        </button>
        <button className="close-btn" onClick={onClose}>Continuar como anônimo</button>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(255,255,255,0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          padding: 2.5rem;
          width: 90%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          text-align: center;
        }
        h2 { color: var(--text-main); font-weight: 400; }
        .subtitle { color: var(--text-light); font-size: 0.95rem; line-height: 1.4; }
        .error-msg { color: #d9534f; font-size: 0.9rem; background: #fdf2f2; padding: 0.5rem; border-radius: 8px; }
        form { display: flex; flex-direction: column; gap: 1rem; }
        input {
          padding: 0.8rem 1rem;
          border: 1px solid rgba(163, 196, 188, 0.5);
          border-radius: 12px;
          outline: none;
          background: rgba(255,255,255,0.8);
          color: var(--text-main);
          font-family: inherit;
        }
        input:focus { border-color: var(--accent); }
        button[type="submit"] {
          background: var(--accent);
          color: white;
          padding: 0.8rem;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 500;
          margin-top: 0.5rem;
          font-family: inherit;
        }
        button[type="submit"]:hover { background: #8bb3aa; }
        .switch-btn, .close-btn {
          background: none;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          font-size: 0.9rem;
          text-decoration: underline;
          font-family: inherit;
        }
        .close-btn { color: var(--text-main); font-weight: 500; margin-top: -0.5rem; text-decoration: none; }
      `}</style>
    </div>
  );
}
