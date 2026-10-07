"use client";

import { useState } from "react";
import { readableOn } from "@/lib/color";

// Demo de la app del alumno en un celular. Cada color cambia el estudio de
// ejemplo: así se ve que la app toma la marca de cada uno.
const DEMOS = [
  {
    color: "#6b1f2e",
    label: "Borgoña",
    studio: "Tango del Sur",
    classes: [
      { time: "19:00", title: "Tango inicial", detail: "Lucía y Martín", spots: "Quedan 3 lugares", hint: "Faltan seguidores/as" },
      { time: "20:30", title: "Tango intermedio", detail: "Carla y Diego", spots: "Quedan 6 lugares", hint: null },
      { time: "22:00", title: "Práctica guiada", detail: "Todos los niveles", spots: "Quedan 18 lugares", hint: null },
    ],
  },
  {
    color: "#5f7a61",
    label: "Salvia",
    studio: "Casa Prana Yoga",
    classes: [
      { time: "08:00", title: "Vinyasa", detail: "Sofía Rinaldi", spots: "Quedan 2 lugares", hint: null },
      { time: "18:30", title: "Hatha suave", detail: "Paula Méndez", spots: "Quedan 5 lugares", hint: null },
      { time: "20:00", title: "Yin & meditación", detail: "Sofía Rinaldi", spots: "Completa", hint: "Lista de espera" },
    ],
  },
  {
    color: "#1f5a6b",
    label: "Petróleo",
    studio: "Núcleo Pilates",
    classes: [
      { time: "07:30", title: "Reformer", detail: "6 máquinas", spots: "Queda 1 máquina", hint: null },
      { time: "12:00", title: "Mat pilates", detail: "Valen Ríos", spots: "Quedan 4 lugares", hint: null },
      { time: "19:00", title: "Reformer", detail: "6 máquinas", spots: "Quedan 2 máquinas", hint: null },
    ],
  },
  {
    color: "#b07a2a",
    label: "Ocre",
    studio: "Salsa Club",
    classes: [
      { time: "19:30", title: "Salsa en línea", detail: "Nivel 1", spots: "Quedan 4 lugares", hint: "Faltan líderes" },
      { time: "21:00", title: "Bachata sensual", detail: "Nivel 2", spots: "Quedan 7 lugares", hint: null },
      { time: "22:30", title: "Social", detail: "Entrada con pack", spots: "Quedan 30 lugares", hint: null },
    ],
  },
  {
    color: "#a8636e",
    label: "Rosa empolvado",
    studio: "Estudio Pointe",
    classes: [
      { time: "17:00", title: "Ballet infantil", detail: "6 a 9 años", spots: "Quedan 3 lugares", hint: null },
      { time: "18:30", title: "Ballet adultos", detail: "Principiantes", spots: "Quedan 5 lugares", hint: null },
      { time: "20:00", title: "Contemporáneo", detail: "Todos los niveles", spots: "Quedan 8 lugares", hint: null },
    ],
  },
] as const;

export function HeroMockup() {
  const [i, setI] = useState(0);
  const demo = DEMOS[i]!;
  const fg = readableOn(demo.color);

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="w-[280px] rounded-[2.5rem] border-[10px] border-stone-900 bg-stone-900 shadow-2xl shadow-stone-900/20 transition-colors"
        aria-label={`Ejemplo de la app de ${demo.studio}`}
        role="img"
      >
        <div className="overflow-hidden rounded-[1.8rem] bg-[#f6f1ea] text-[#1f1a17]">
          {/* encabezado del estudio */}
          <div className="px-4 pt-6 pb-4 transition-colors duration-300" style={{ backgroundColor: demo.color, color: fg }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-semibold">
                {demo.studio.slice(0, 1)}
              </div>
              <p className="truncate font-semibold">{demo.studio}</p>
            </div>
          </div>

          <div className="space-y-3 p-3.5">
            {/* saldo */}
            <div className="rounded-2xl border-l-4 bg-white p-3 transition-colors duration-300" style={{ borderColor: demo.color }}>
              <p className="text-[11px] text-stone-500">Hola, Ana</p>
              <p className="text-sm font-semibold">Te quedan 5 clases</p>
              <p className="text-[11px] text-stone-500">Vence el 12/11</p>
            </div>

            <p className="pt-1 text-[11px] font-semibold transition-colors" style={{ color: demo.color }}>
              Hoy · Lunes 6/10
            </p>
            {demo.classes.map((c) => (
              <div key={c.time + c.title} className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-stone-500">{c.time}</p>
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-[11px] text-stone-500">
                    {c.spots}
                    {c.hint ? ` · ${c.hint}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-300"
                  style={
                    c.spots === "Completa"
                      ? { border: `1px solid ${demo.color}`, color: demo.color }
                      : { backgroundColor: demo.color, color: fg }
                  }
                >
                  {c.spots === "Completa" ? "Esperar" : "Reservar"}
                </span>
              </div>
            ))}
          </div>

          {/* barra de abajo */}
          <div className="grid grid-cols-4 border-t border-stone-200 bg-white py-2.5 text-center text-[10px] text-stone-400">
            <span className="font-semibold transition-colors" style={{ color: demo.color }}>
              Inicio
            </span>
            <span>Reservar</span>
            <span>Packs</span>
            <span>Mi QR</span>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted">Tu marca, tu color. Probá:</p>
        <div className="flex justify-center gap-2.5">
          {DEMOS.map((d, idx) => (
            <button
              key={d.color}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Ver en ${d.label}`}
              aria-pressed={idx === i}
              className="h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition aria-pressed:ring-2 aria-pressed:ring-foreground"
              style={{ backgroundColor: d.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
