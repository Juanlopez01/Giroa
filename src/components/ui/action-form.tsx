"use client";

import { startTransition, type FormHTMLAttributes } from "react";

/**
 * Formulario para server actions que NO se resetea al enviar.
 * React 19 limpia los campos después de cada envío con `action`, y si hubo un
 * error de validación la persona pierde lo que escribió. Con JavaScript se
 * envía a mano (sin reset); sin JavaScript sigue funcionando con `action`.
 */
export function ActionForm({
  action,
  ...props
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
}) {
  return (
    <form
      {...props}
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
    />
  );
}
