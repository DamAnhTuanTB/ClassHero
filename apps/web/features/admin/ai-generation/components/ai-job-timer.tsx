"use client";

import { useEffect, useState } from "react";

export function AiJobTimer({
  createdAt,
  prefix,
  suffix = "",
}: {
  createdAt: string;
  prefix: string;
  suffix?: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <>
      {prefix}
      {elapsed}s{suffix}
    </>
  );
}
