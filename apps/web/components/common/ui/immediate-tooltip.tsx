"use client";

import {
  Children,
  cloneElement,
  useState,
  type FocusEventHandler,
  type PointerEventHandler,
  type ReactElement,
} from "react";
import { ImmediateTooltipPortal } from "@/components/common/ui/immediate-tooltip-portal";

type TooltipTriggerProps = {
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
};

export function ImmediateTooltip({
  children,
  content,
}: {
  children: ReactElement<TooltipTriggerProps>;
  content: string;
}) {
  const trigger = Children.only(children);
  const [focusedAnchor, setFocusedAnchor] = useState<HTMLElement | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<HTMLElement | null>(null);
  const anchor = focusedAnchor ?? hoveredAnchor;

  return (
    <>
      {cloneElement(trigger, {
        onBlur: (event) => {
          trigger.props.onBlur?.(event);
          setFocusedAnchor(null);
        },
        onFocus: (event) => {
          trigger.props.onFocus?.(event);
          setFocusedAnchor(event.currentTarget);
        },
        onPointerEnter: (event) => {
          trigger.props.onPointerEnter?.(event);
          setHoveredAnchor(event.currentTarget);
        },
        onPointerLeave: (event) => {
          trigger.props.onPointerLeave?.(event);
          setHoveredAnchor(null);
        },
      })}
      <ImmediateTooltipPortal anchor={anchor} content={content} />
    </>
  );
}
