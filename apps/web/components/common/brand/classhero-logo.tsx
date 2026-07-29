import Image from "next/image";
import { cn } from "@/lib/utils";

type ClassHeroLogoProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export function ClassHeroLogo({
  alt = "ClassHero",
  className,
  priority = false,
  sizes = "(max-width: 640px) 10rem, 12rem",
}: ClassHeroLogoProps) {
  return (
    <Image
      src="/images/logo.png"
      alt={alt}
      width={5098}
      height={1412}
      sizes={sizes}
      priority={priority}
      className={cn("block h-auto w-auto shrink-0 object-contain", className)}
    />
  );
}
