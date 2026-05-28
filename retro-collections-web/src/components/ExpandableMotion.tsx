import { type ReactElement, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ExpandableMotionProps<P = unknown> = {
  children: ReactElement<P>;
  renderExpanded?: (props: P & { onClose: () => void }) => ReactElement;
};

export function ExpandableMotion<P>({
  children,
  renderExpanded,
}: ExpandableMotionProps<P>) {
  const [expanded, setExpanded] = useState(false);

  const childProps = children.props as P;

  const open = () => setExpanded(true);
  const close = () => setExpanded(false);

  // Inject ONLY expansion behavior, nothing else
  const normal = {
    ...children,
    props: {
      ...childProps,
      onExpand: open,
      isExpanded: expanded,
    },
  };

  const expandedView = renderExpanded
    ? renderExpanded({ ...childProps, onClose: close })
    : children;

  return (
    <>
      {/* NORMAL STATE */}
      {normal}

      {/* MODAL STATE */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              layoutId={`expandable-${(childProps as { item?: { id: string } }).item?.id}`}
              className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-xl bg-base-200 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {expandedView}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
