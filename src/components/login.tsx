"use client";

import { FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../components/lib/supabase";
import "./Login.css";

type LoginProps = {
  onLogin: (usuario: User) => void;
};

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensaje("");
    setCargando(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMensaje("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }

    if (!data.user) {
      setMensaje("No fue posible obtener la información del usuario.");
      setCargando(false);
      return;
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from("profiles")
      .select("activo")
      .eq("id", data.user.id)
      .single();

    if (errorPerfil || !perfil) {
      await supabase.auth.signOut();
      setMensaje("No se encontró el perfil del usuario.");
      setCargando(false);
      return;
    }

    if (!perfil.activo) {
      await supabase.auth.signOut();
      setMensaje("Este usuario se encuentra desactivado.");
      setCargando(false);
      return;
    }

    onLogin(data.user);
    setCargando(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">N</div>

          <div>
            <span>NOVENTIA</span>
            <small>Sistema de inventario</small>
          </div>
        </div>

        <div className="login-heading">
          <p>BIENVENIDO</p>
          <h1>Iniciar sesión</h1>
          <span>Ingresa tus credenciales para acceder al inventario.</span>
        </div>

        <form onSubmit={iniciarSesion}>
          <label>
            Correo electrónico

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@noventia.com.mx"
              autoComplete="email"
              required
              disabled={cargando}
            />
          </label>

          <label>
            Contraseña

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={cargando}
            />
          </label>

          {mensaje && <div className="login-error">{mensaje}</div>}

          <button type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar al sistema"}
          </button>
        </form>

        <small className="login-footer">
          Acceso exclusivo para personal autorizado
        </small>
      </section>
    </main>
  );
}