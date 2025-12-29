import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useLocation, Link } from "wouter";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user && !loading) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a12]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const handleLogin = () => {
    // Redireciona para o OAuth do Manus
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-900/30 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[150px] translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-purple-800/10 rounded-full blur-[100px]" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/5 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <img src="/logo.png" alt="ZEAL" className="h-12 w-auto" />
            <span className="text-3xl font-bold text-white tracking-tight">Zeal</span>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Email Field */}
            <div className="relative">
              <Input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-[#252538] border-0 rounded-xl text-white placeholder:text-gray-500 px-5 text-base focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-[#252538] border-0 rounded-xl text-white placeholder:text-gray-500 px-5 pr-12 text-base focus:ring-2 focus:ring-purple-500/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Login Button */}
            <Button 
              className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-lg rounded-xl mt-8 transition-all duration-200 shadow-lg shadow-purple-500/25"
              onClick={handleLogin}
            >
              Entrar
            </Button>

            {/* Register Link */}
            <div className="text-center mt-6">
              <span className="text-gray-400">Não tem conta? </span>
              <Link href="/register" className="text-gray-300 hover:text-white underline underline-offset-2 transition-colors">
                Cadastre-se
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
