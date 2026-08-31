import type { ButtonHTMLAttributes } from "react";
import Button from "@/components/ui/Button";

type FormButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface FormButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FormButtonVariant;
}

export default function FormButton({
  variant = "primary",
  type = "button",
  children,
  ...props
}: FormButtonProps) {
  return (
    <Button variant={variant} type={type} {...props}>
      {children}
    </Button>
  );
}
