import React, { useState } from 'react';
import { X, Mail, Lock, User, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        if (!username.trim()) {
          throw new Error('Por favor, ingresa un nombre de usuario.');
        }

        // 1. Registrar usuario en Auth
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { username: username.trim() }
          }
        });
        if (error) throw error;

        if (data?.user) {
          // 2. Guardar el username en la tabla profiles
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: data.user.id, username: username.trim() }]);

          if (profileError) {
            console.warn('Error al guardar perfil (puede que ya exista):', profileError.message);
          }
        }

        alert('¡Cuenta creada con éxito! Ya puedes iniciar sesión.');
        setIsSignUp(false);
      } else {
        // Iniciar sesión
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Ocurrió un error en la autenticación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-purple-600/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-purple-500/30">
            {isSignUp ? <UserPlus size={24} /> : <LogIn size={24} />}
          </div>
          <h3 className="text-xl font-black text-white">
            {isSignUp ? 'Crear Cuenta en AnimeCanon' : 'Iniciar Sesión'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp ? 'Elige tu nombre de usuario y contraseña.' : 'Accede a tu historial guardado en la nube.'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* CAMPO NOMBRE DE USUARIO (SOLO EN REGISTRO) */}
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Nombre de Usuario</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  required={isSignUp}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="TuApodoOtaku"
                  className="w-full bg-slate-950 text-white placeholder-slate-600 pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full bg-slate-950 text-white placeholder-slate-600 pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 text-white placeholder-slate-600 pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-950/60 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            {isSignUp ? 'Registrarse' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
            className="text-xs text-purple-400 font-bold hover:underline"
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}