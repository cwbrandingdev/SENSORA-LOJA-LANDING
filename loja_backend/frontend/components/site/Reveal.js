"use client";

import { motion, useReducedMotion } from "framer-motion";

// Wrapper de entrada reutilizável para o site público. Sem `delay` fixo em
// segundos absolutos por item — `index` controla o stagger para que listas
// longas não demorem para revelar os últimos itens.
export function Reveal({
  children,
  className,
  index = 0,
  y = 16,
  duration = 0.6,
  as: Component = motion.div,
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{
        duration,
        delay: Math.min(index * 0.08, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </Component>
  );
}
