import { useRef, useState } from 'react';
import { vibrate } from '../audio';

/**
 * Нативный жест шторки iOS / Android (Pull-down-to-dismiss):
 * плавно тянет шторку за пальцем вниз (когда контент прокручен в самый верх),
 * учитывает инерцию быстрого смахивания (velocity > 0.55 px/ms) и упруго возвращает обратно,
 * если передумали закрывать.
 */
export function useSheetPullToDismiss(onDismiss: () => void) {
  const [offsetY, setOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityYRef = useRef(0);
  const activePtrRef = useRef<number | null>(null);
  const gestureLockedRef = useRef<'undecided' | 'sheet' | 'ignore'>('undecided');

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    // Проверяем как саму шторку, так и любой скроллящийся вложенный блок
    let node = e.target as HTMLElement | null;
    while (node && node !== el) {
      if (node.scrollTop > 2) {
        gestureLockedRef.current = 'ignore';
        return;
      }
      node = node.parentElement;
    }
    if (el.scrollTop > 4) {
      gestureLockedRef.current = 'ignore';
      return;
    }
    activePtrRef.current = e.pointerId;
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityYRef.current = 0;
    gestureLockedRef.current = 'undecided';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (activePtrRef.current !== e.pointerId || gestureLockedRef.current === 'ignore') return;

    const dy = e.clientY - startYRef.current;
    const dx = e.clientX - startXRef.current;

    if (gestureLockedRef.current === 'undecided') {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        gestureLockedRef.current = 'ignore';
        return;
      }
      if (dy > 10) {
        gestureLockedRef.current = 'sheet';
        setIsDraggingSheet(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (dy < -10) {
        gestureLockedRef.current = 'ignore';
        return;
      } else {
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    velocityYRef.current = (e.clientY - lastYRef.current) / dt;
    lastYRef.current = e.clientY;
    lastTimeRef.current = now;

    // Небольшое резиновое сопротивление, если тянут вверх (<0), и 1:1 вниз
    const damped = dy < 0 ? dy * 0.15 : dy;
    setOffsetY(damped);
  };

  const finishGesture = () => {
    if (gestureLockedRef.current !== 'sheet') {
      activePtrRef.current = null;
      gestureLockedRef.current = 'undecided';
      return;
    }
    activePtrRef.current = null;
    gestureLockedRef.current = 'undecided';
    setIsDraggingSheet(false);

    if (offsetY > 96 || (offsetY > 28 && velocityYRef.current > 0.55)) {
      vibrate(8);
      setIsClosing(true);
      setOffsetY(window.innerHeight);
      window.setTimeout(() => {
        onDismiss();
        // Если шторка осталась смонтированной (например, отменили оплату), возвращаем её обратно без soft-lock!
        setIsClosing(false);
        setOffsetY(0);
      }, 220);
    } else {
      setOffsetY(0);
    }
  };

  const sheetStyle: React.CSSProperties = {
    transform: offsetY !== 0 ? `translate3d(0, ${offsetY.toFixed(1)}px, 0)` : undefined,
    transition: isDraggingSheet
      ? 'none'
      : 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
  };

  const backdropOpacity = isClosing
    ? 0
    : Math.max(0.2, 1 - Math.max(0, offsetY) / 420);

  return {
    sheetProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishGesture,
      onPointerCancel: finishGesture,
      style: sheetStyle,
    },
    backdropStyle: {
      opacity: backdropOpacity,
      transition: isDraggingSheet ? 'none' : 'opacity 0.28s ease',
    } as React.CSSProperties,
  };
}
