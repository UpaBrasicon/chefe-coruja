"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import { ImageSlider } from "@/components/ui/image-slider";

// Imagens do painel de apresentação (SVG locais — sem dependência de rede).
const images = [
  "/login-img-1.svg",
  "/login-img-2.svg",
  "/login-img-3.svg",
  "/login-img-4.svg",
];

const prompts = [
  "Gestão de leitos em tempo real, com ocupação por setor e alerta de superlotação.",
  "Prontuário eletrônico com trilha de auditoria e conformidade CFM e LGPD.",
  "Escala médica fixa e mensal, com trocas e justificativas pelo app.",
  "Prescrição digital com medicamentos padronizados e diluição revisada.",
];

const termosText = (
  <>
    Ao entrar, você concorda com nossos{" "}
    <a
      href="/privacidade"
      className="font-medium text-black/45 underline underline-offset-2 dark:text-white/45"
    >
      Termos de Uso
    </a>{" "}
    e{" "}
    <a
      href="/privacidade"
      className="font-medium text-black/45 underline underline-offset-2 dark:text-white/45"
    >
      Política de Privacidade
    </a>
  </>
);

export default function AuthSectionTwo({
  onSubmit,
  erro,
  carregando,
}: {
  onSubmit: (email: string, senha: string) => void;
  erro?: string | null;
  carregando?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="min-h-screen bg-white p-3 text-black antialiased [font-synthesis:none] dark:bg-[#050505] dark:text-white">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="flex min-h-[760px] justify-center overflow-hidden rounded-md bg-[#0d9488] px-7 py-12 text-white sm:px-10 lg:min-h-0 lg:py-20 xl:py-24">
          <div className="flex w-full max-w-[500px] flex-col items-center">
            <div className="flex items-center gap-3 text-lg text-white">
              <span className="grid size-8 place-items-center rounded-lg bg-white/15 text-xl">
                🦉
              </span>
              Chefe Coruja
            </div>

            <div className="relative mt-8 w-full overflow-hidden rounded-md">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-[#0d9488] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#0d9488] to-transparent" />
              <div className="h-[500px] w-full">
                <ImageSlider images={images} interval={2600} />
              </div>
            </div>

            <div className="mt-6 w-full rounded-[10px] border border-dashed border-white/25 px-5 py-4">
              <div className="flex items-end gap-4">
                <motion.p
                  key={activeIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="line-clamp-4 flex-1 text-xs leading-4 text-white/70"
                >
                  <span className="font-semibold text-white">/chefe</span>{" "}
                  {prompts[activeIndex]}
                </motion.p>
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
                  aria-label="Próximo destaque"
                  onClick={() => setActiveIndex((c) => (c + 1) % prompts.length)}
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>

            <p className="mt-7 max-w-[300px] text-center text-xl leading-tight text-white">
              Gestão hospitalar com conformidade CFM e LGPD
            </p>

            <div className="mt-auto flex gap-2 pb-8 pt-8">
              {prompts.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={
                    activeIndex === index
                      ? "h-1 w-10 rounded-full bg-white"
                      : "h-1 w-4 rounded-full bg-white/35"
                  }
                  aria-label={`Mostrar destaque ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-h-[760px] items-center justify-center px-6 py-12 sm:px-10 lg:min-h-0 lg:px-14 xl:px-20">
          <AuthForm onSubmit={onSubmit} erro={erro} carregando={carregando} />
        </div>
      </div>
    </section>
  );
}

function AuthForm({
  onSubmit,
  erro,
  carregando,
}: {
  onSubmit: (email: string, senha: string) => void;
  erro?: string | null;
  carregando?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(email, senha)
  }

  return (
    <motion.div
      className="w-full max-w-[500px] text-center"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <h1 className="whitespace-nowrap text-3xl font-medium tracking-[-0.04em] sm:text-4xl lg:text-[42px] lg:leading-[1.05]">
        Entrar na plataforma
      </h1>

      <div className="my-8 flex items-center gap-4 text-sm text-black/60 dark:text-white/50">
        <div className="h-px flex-1 bg-black/15 dark:bg-white/15" />
        Acesso restrito à equipe
        <div className="h-px flex-1 bg-black/15 dark:bg-white/15" />
      </div>

      <form className="space-y-5 text-left" onSubmit={handleSubmit}>
        <FieldBox
          label="E-mail"
          value={email}
          type="email"
          autoComplete="email"
          onChange={setEmail}
        />
        <FieldBox
          label="Senha"
          value={senha}
          type="password"
          autoComplete="current-password"
          onChange={setSenha}
        />

        {erro && (
          <p className="rounded-[8px] border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {erro}
          </p>
        )}

        <div className="space-y-3 pt-2 text-xs leading-4 text-black/30 dark:text-white/35 sm:text-[13px]">
          <CheckboxLine>{termosText}</CheckboxLine>
        </div>

        <button
          type="submit"
          disabled={carregando || !email || !senha}
          className="mt-9 flex h-12 w-full items-center justify-center rounded-[10px] border border-black/40 bg-[#0d9488] text-lg font-medium text-white transition-colors hover:bg-[#0f766e] disabled:opacity-60 dark:border-white/40 dark:bg-white dark:text-black dark:hover:bg-white/85"
        >
          {carregando ? <Loader2 className="size-5 animate-spin" /> : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-sm text-black/45 dark:text-white/45">
        Ainda não tem conta?{" "}
        <Link
          to="/cadastro"
          className="font-medium underline underline-offset-2 hover:text-black/70 dark:hover:text-white/70"
        >
          Cadastre-se
        </Link>
      </p>
    </motion.div>
  );
}

function FieldBox({
  label,
  value,
  type = "text",
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  autoComplete?: string;
  onChange: (v: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <label className="flex h-11 items-center justify-between gap-4 rounded-[8px] border border-black/20 bg-white px-4 text-base leading-none dark:border-white/15 dark:bg-white/5">
      <input
        type={type}
        value={value}
        aria-label={label}
        autoComplete={autoComplete}
        onFocus={() => {
          if (!isEditing) {
            setIsEditing(true);
          }
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsEditing(true);
        }}
        className="min-w-0 flex-1 truncate bg-transparent text-black/75 outline-none placeholder:text-black/35 dark:text-white/75 dark:placeholder:text-white/35"
      />
      {!isEditing && !value && (
        <span className="shrink-0 text-black/45 dark:text-white/45">{label}</span>
      )}
    </label>
  );
}

function CheckboxLine({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3">
      <span className="relative mt-0.5 size-3 shrink-0">
        <input
          type="checkbox"
          defaultChecked
          className="peer size-full appearance-none rounded-[2px] border border-black/25 bg-white checked:border-black checked:bg-black dark:border-white/30 dark:bg-white/5 dark:checked:border-white dark:checked:bg-white"
        />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 hidden size-full p-px text-white peer-checked:block dark:text-black"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 6.2 5 8.1 9 3.9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}
