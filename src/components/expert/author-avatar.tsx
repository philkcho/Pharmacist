import Image from "next/image";
import fs from "node:fs";
import path from "node:path";
import { SITE_AUTHOR } from "@/lib/author";

const PHOTO_EXISTS = fs.existsSync(
  path.join(process.cwd(), "public", SITE_AUTHOR.photoPath.replace(/^\//, ""))
);

interface AuthorAvatarProps {
  size?: number;
  className?: string;
  ringClassName?: string;
}

export function AuthorAvatar({
  size = 40,
  className = "",
  ringClassName = "ring-2 ring-background",
}: AuthorAvatarProps) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground ${ringClassName} ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Reviewed by ${SITE_AUTHOR.shortCredit}`}
    >
      {PHOTO_EXISTS ? (
        <Image
          src={SITE_AUTHOR.photoPath}
          alt={SITE_AUTHOR.shortCredit}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-semibold" style={{ fontSize: Math.round(size * 0.4) }}>
          {SITE_AUTHOR.initials}
        </span>
      )}
    </div>
  );
}
