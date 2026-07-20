import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { theme } from '../theme';
import type { ModuleProgress } from '../types';
import { ModuleTile } from './ModuleTile';

const COLUMNS = 4;
const CELL_HEIGHT = 108;
/** Bu eşiği aşan hareket dokunuş değil sürükleme sayılır. */
const DRAG_THRESHOLD = 8;

type Props = {
  modules: ModuleProgress[];
  onOpen: (module: ModuleProgress) => void;
  onQuickAdd: (module: ModuleProgress) => void;
  onReorder: (keys: string[]) => void;
  activeKey?: string;
};

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Sürükleyerek yeniden sıralanabilen modül ızgarası.
 *
 * Kütüphane yerine PanResponder: sürükleme hem web'de hem cihazda aynı çalışsın
 * ve native derleme zinciri değişmesin diye. Dokunuş/uzun basış davranışı
 * korunur — parmak eşiği aşana kadar hareket sürükleme sayılmaz.
 */
export function DraggableGrid({
  modules,
  onOpen,
  onQuickAdd,
  onReorder,
  activeKey,
}: Props) {
  const [order, setOrder] = useState<ModuleProgress[]>(modules);
  const [dragging, setDragging] = useState<string | null>(null);

  // Sunucudan gelen veri değiştiğinde sırayı tazele; sürükleme sürerken değil,
  // yoksa parmağın altındaki kutucuk yerinden sıçrar.
  const draggingRef = useRef<string | null>(null);
  draggingRef.current = dragging;

  useEffect(() => {
    if (draggingRef.current) return;
    setOrder(modules);
  }, [modules]);

  const cellWidth = useRef(0);
  const orderRef = useRef(order);
  orderRef.current = order;

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const fromIndex = useRef(0);
  const currentIndex = useRef(0);

  const onLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    cellWidth.current = event.nativeEvent.layout.width / COLUMNS;
  }, []);

  const commit = useCallback(() => {
    const keys = orderRef.current.map((m) => m.key);
    onReorder(keys);
  }, [onReorder]);

  const makeResponder = useCallback(
    (key: string) =>
      PanResponder.create({
        // Only claim the gesture once it is clearly a drag, so a plain tap still
        // opens the module and a long press still opens quick add.
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD,

        onPanResponderGrant: () => {
          const index = orderRef.current.findIndex((m) => m.key === key);
          fromIndex.current = index;
          currentIndex.current = index;
          pan.setValue({ x: 0, y: 0 });
          setDragging(key);
        },

        onPanResponderMove: (_evt, gesture) => {
          pan.setValue({ x: gesture.dx, y: gesture.dy });

          const width = cellWidth.current || 1;
          const shiftedColumns = Math.round(gesture.dx / width);
          const shiftedRows = Math.round(gesture.dy / CELL_HEIGHT);
          const target = Math.max(
            0,
            Math.min(
              orderRef.current.length - 1,
              fromIndex.current + shiftedColumns + shiftedRows * COLUMNS,
            ),
          );

          if (target !== currentIndex.current) {
            setOrder((prev) => moveItem(prev, currentIndex.current, target));
            currentIndex.current = target;
          }
        },

        onPanResponderRelease: () => {
          setDragging(null);
          pan.setValue({ x: 0, y: 0 });
          if (currentIndex.current !== fromIndex.current) commit();
        },

        onPanResponderTerminate: () => {
          setDragging(null);
          pan.setValue({ x: 0, y: 0 });
        },
      }),
    [commit, pan],
  );

  // One responder per module, rebuilt only when the set of modules changes.
  const responders = useMemo(() => {
    const map: Record<string, ReturnType<typeof PanResponder.create>> = {};
    for (const module of modules) map[module.key] = makeResponder(module.key);
    return map;
  }, [modules, makeResponder]);

  return (
    <View style={styles.grid} onLayout={onLayout} testID="module-grid">
      {order.map((module) => {
        const isDragging = dragging === module.key;
        return (
          <Animated.View
            key={module.key}
            {...(responders[module.key]?.panHandlers ?? {})}
            style={[
              styles.cell,
              isDragging && {
                transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: 1.08 }],
                zIndex: 10,
                opacity: 0.95,
              },
            ]}
          >
            <ModuleTile
              module={module}
              onPress={onOpen}
              onLongPress={onQuickAdd}
              active={activeKey === module.key}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    height: CELL_HEIGHT,
    alignItems: 'center',
  },
});
