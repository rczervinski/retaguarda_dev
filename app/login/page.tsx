"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setIsLoading(true)
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, senha }),
        credentials: 'include'
      })

      if (res.ok) {
        // Login bem-sucedido, iniciar animação de saída
        setIsExiting(true)
        
        // Aguardar um pouco mais para garantir que o cookie foi setado
        setTimeout(() => {
          // Forçar reload completo ao invés de router.push para garantir que o middleware leia o cookie
          window.location.href = '/'
        }, 1000)
      } else {
        const data = await res.json().catch(() => ({}))
        setErro(data?.error === 'invalid' ? 'Usuário ou senha inválidos' : 'Erro ao fazer login')
        setIsLoading(false)
      }
    } catch (err) {
      console.error('[LOGIN] erro:', err)
      setErro('Erro de conexão')
      setIsLoading(false)
    }
  }

  return (
    <div className={`min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 transition-all duration-700 ${isExiting ? 'opacity-0 translate-y-12' : 'opacity-100 translate-y-0'}`}>
      {/* Animated floating elements background */}
      <div className={`absolute inset-0 overflow-hidden pointer-events-none transition-all duration-700 ${isExiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}>
        {/* Maquininhas de cartão */}
        <div className="floating-item" style={{ top: '10%', left: '10%', animationDelay: '0s', animationDuration: '25s' }}>
          💳
        </div>
        <div className="floating-item" style={{ top: '60%', left: '5%', animationDelay: '3s', animationDuration: '30s' }}>
          💳
        </div>
        <div className="floating-item" style={{ top: '30%', left: '85%', animationDelay: '5s', animationDuration: '28s' }}>
          💳
        </div>
        
        {/* Computadores */}
        <div className="floating-item" style={{ top: '20%', left: '75%', animationDelay: '1s', animationDuration: '32s' }}>
          💻
        </div>
        <div className="floating-item" style={{ top: '70%', left: '80%', animationDelay: '4s', animationDuration: '27s' }}>
          💻
        </div>
        <div className="floating-item" style={{ top: '50%', left: '15%', animationDelay: '6s', animationDuration: '29s' }}>
          💻
        </div>
        
        {/* Bebidas */}
        <div className="floating-item" style={{ top: '15%', left: '40%', animationDelay: '2s', animationDuration: '26s' }}>
          🥤
        </div>
        <div className="floating-item" style={{ top: '65%', left: '60%', animationDelay: '7s', animationDuration: '31s' }}>
          🥤
        </div>
        <div className="floating-item" style={{ top: '80%', left: '25%', animationDelay: '4.5s', animationDuration: '28s' }}>
          🥤
        </div>
        
        {/* Roupas */}
        <div className="floating-item" style={{ top: '40%', left: '90%', animationDelay: '3.5s', animationDuration: '33s' }}>
          👕
        </div>
        <div className="floating-item" style={{ top: '25%', left: '20%', animationDelay: '5.5s', animationDuration: '30s' }}>
          👕
        </div>
        <div className="floating-item" style={{ top: '75%', left: '70%', animationDelay: '2.5s', animationDuration: '29s' }}>
          👕
        </div>
        
        {/* Sacolas de compras */}
        <div className="floating-item" style={{ top: '35%', left: '5%', animationDelay: '6.5s', animationDuration: '27s' }}>
          🛍️
        </div>
        <div className="floating-item" style={{ top: '55%', left: '88%', animationDelay: '1.5s', animationDuration: '31s' }}>
          🛍️
        </div>
        <div className="floating-item" style={{ top: '85%', left: '45%', animationDelay: '4s', animationDuration: '28s' }}>
          🛍️
        </div>
        
        {/* Dinheiro */}
        <div className="floating-item" style={{ top: '45%', left: '50%', animationDelay: '7.5s', animationDuration: '30s' }}>
          💰
        </div>
        <div className="floating-item" style={{ top: '5%', left: '60%', animationDelay: '2s', animationDuration: '26s' }}>
          💰
        </div>
        
        {/* Carrinhos de compras */}
        <div className="floating-item" style={{ top: '90%', left: '10%', animationDelay: '5s', animationDuration: '32s' }}>
          🛒
        </div>
        <div className="floating-item" style={{ top: '10%', left: '95%', animationDelay: '3s', animationDuration: '29s' }}>
          🛒
        </div>
      </div>

      {/* Login Card */}
      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${isExiting ? 'opacity-0 scale-95 translate-y-8' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10 space-y-8">
          {/* Logo GUTTY */}
          <div className="text-center">
            <h1 className="text-7xl font-black tracking-tight">
              <span className="text-blue-600">GUT</span>
              <span className="text-yellow-400">TY</span>
            </h1>
            <p className="text-gray-600 mt-3 text-lg font-medium">Sistema de Retaguarda</p>
          </div>

          {/* Login Form */}
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Usuário
              </label>
              <input 
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-lg font-medium shadow-sm"
                placeholder="Digite seu nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Senha
              </label>
              <input 
                type="password"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all text-lg font-medium shadow-sm"
                placeholder="Digite sua senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {erro && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                {erro}
              </div>
            )}

            <button 
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              type="submit"
              disabled={isLoading || !nome.trim() || !senha.trim()}
            >
              {isLoading ? (
                isExiting ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Sucesso!
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Entrando...
                  </div>
                )
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Sistema de Gestão Empresarial
            </p>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.4;
          }
          25% {
            transform: translate(20px, -30px) rotate(5deg);
            opacity: 0.6;
          }
          50% {
            transform: translate(-20px, -60px) rotate(-5deg);
            opacity: 0.8;
          }
          75% {
            transform: translate(30px, -90px) rotate(3deg);
            opacity: 0.5;
          }
        }

        .floating-item {
          position: absolute;
          font-size: 3rem;
          animation: float infinite ease-in-out;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
          opacity: 0.5;
        }

        /* Animação de saída suave */
        :global(.login-exit) {
          animation: exitAnimation 0.7s ease-out forwards;
        }

        @keyframes exitAnimation {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
          50% {
            opacity: 0.5;
            transform: translateY(20px) scale(0.98);
            filter: blur(2px);
          }
          100% {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
            filter: blur(4px);
          }
        }

        @media (max-width: 768px) {
          .floating-item {
            font-size: 2rem;
          }
        }
      `}</style>
    </div>
  )
}

